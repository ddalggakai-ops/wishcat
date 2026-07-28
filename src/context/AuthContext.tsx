import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, firebaseReady, firebaseInitError } from '../firebase/config';
import { createUserProfile, fetchMe, updateMyProfile } from '../services/usersService';
import { authErrorMessage } from '../firebase/authErrors';
import type { MeUser } from '../api/types';

interface AuthState {
  ready: boolean; // Firebase Auth 초기 상태 복원 완료 여부
  user: MeUser | null;
  loading: boolean;
  error: string | null;
  /** 로그인은 됐는데 프로필을 못 불러온 상태(네트워크/권한 문제)의 사유 */
  startupError: string | null;
  retryStartup: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateMe: (patch: Partial<Pick<MeUser, 'name' | 'bio' | 'listPublic'>>) => Promise<void>;
  clearError: () => void;
  justRegistered: boolean;
  clearJustRegistered: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const userRef = useRef<MeUser | null>(null);
  userRef.current = user;
  // register()가 프로필 생성 + fetchMe를 직접 처리하는 동안, onAuthStateChanged가
  // 아직 프로필 문서가 없는 상태로 fetchMe를 먼저 실행해 이름을 덮어쓰지 않도록 막는 가드
  const registeringRef = useRef(false);

  useEffect(() => {
    // Firebase 초기화 자체가 실패했다면 여기서 멈추지 않고 바로 화면을 띄웁니다.
    // (App.tsx가 startupError를 보고 원인이 적힌 안내 화면을 보여줍니다)
    if (!firebaseReady) {
      setStartupError(firebaseInitError || 'Firebase 초기화에 실패했어요.');
      setReady(true);
      return;
    }

    let cancelled = false;
    const unsub = onAuthStateChanged(
      auth,
      (fbUser) => {
        if (registeringRef.current) return;
        if (!fbUser) {
          if (cancelled) return;
          setUser(null);
          setStartupError(null);
          setReady(true);
          return;
        }
        // 로그인 세션이 복원됨 → 프로필을 불러온다.
        // fetchMe에는 타임아웃이 걸려 있어서 어떤 경우에도 여기서 영원히 멈추지 않습니다.
        (async () => {
          try {
            const me = await fetchMe(fbUser.uid, fbUser.email || '');
            if (cancelled) return;
            setUser(me);
            setStartupError(null);
          } catch (e) {
            if (cancelled) return;
            setUser(null);
            setStartupError(authErrorMessage(e, '프로필을 불러오지 못했어요'));
          } finally {
            if (!cancelled) setReady(true);
          }
        })();
      },
      (e) => {
        // onAuthStateChanged 자체가 실패하는 경우(거의 없지만) 대비
        if (cancelled) return;
        setStartupError(authErrorMessage(e, '로그인 상태를 확인하지 못했어요'));
        setReady(true);
      }
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [retryTick]);

  const retryStartup = useCallback(() => {
    setReady(false);
    setStartupError(null);
    setRetryTick((n) => n + 1);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    registeringRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(cred.user.uid, name);
      const me = await fetchMe(cred.user.uid, email, name);
      setUser(me);
      setStartupError(null);
      setReady(true);
      setJustRegistered(true);
    } catch (e) {
      setError(authErrorMessage(e, '가입 중 문제가 발생했어요'));
      throw e;
    } finally {
      setLoading(false);
      registeringRef.current = false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const me = await fetchMe(cred.user.uid, cred.user.email || email);
      setUser(me);
      setStartupError(null);
      setReady(true);
    } catch (e) {
      setError(authErrorMessage(e, '로그인 중 문제가 발생했어요'));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setStartupError(null);
      setReady(true);
    }
  }, []);

  const updateMe = useCallback(async (patch: Partial<Pick<MeUser, 'name' | 'bio' | 'listPublic'>>) => {
    const current = userRef.current;
    if (!current) return;
    await updateMyProfile(current.id, patch);
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearJustRegistered = useCallback(() => setJustRegistered(false), []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        user,
        loading,
        error,
        startupError,
        retryStartup,
        register,
        login,
        logout,
        updateMe,
        clearError,
        justRegistered,
        clearJustRegistered,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
