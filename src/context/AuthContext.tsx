import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserProfile, fetchMe, updateMyProfile } from '../services/usersService';
import { authErrorMessage } from '../firebase/authErrors';
import type { MeUser } from '../api/types';

interface AuthState {
  ready: boolean; // Firebase Auth 초기 상태 복원 완료 여부
  user: MeUser | null;
  loading: boolean;
  error: string | null;
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
  const [justRegistered, setJustRegistered] = useState(false);
  const userRef = useRef<MeUser | null>(null);
  userRef.current = user;
  // register()가 프로필 생성 + fetchMe를 직접 처리하는 동안, onAuthStateChanged가
  // 아직 프로필 문서가 없는 상태로 fetchMe를 먼저 실행해 이름을 덮어쓰지 않도록 막는 가드
  const registeringRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (registeringRef.current) return;
      try {
        if (fbUser) {
          const me = await fetchMe(fbUser.uid, fbUser.email || '');
          setUser(me);
        } else {
          setUser(null);
        }
      } finally {
        setReady(true);
      }
    });
    return unsub;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    registeringRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(cred.user.uid, name);
      const me = await fetchMe(cred.user.uid, email);
      setUser(me);
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
      setReady(true);
    } catch (e) {
      setError(authErrorMessage(e, '로그인 중 문제가 발생했어요'));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
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
    <AuthContext.Provider value={{ ready, user, loading, error, register, login, logout, updateMe, clearError, justRegistered, clearJustRegistered }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
