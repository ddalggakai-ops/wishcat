import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

function extOf(localUri: string): string {
  const filename = localUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match ? match[1] : 'jpg').toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

// 로컬 사진을 Firebase Storage에 업로드하고 다운로드 URL을 반환.
// folder로 'memories'(추억 사진, 기본값) 또는 'avatars'(프로필 사진)를 고를 수 있어요.
// 두 폴더 모두 storage.rules에 각각의 규칙이 있어야 업로드가 됩니다.
export async function uploadPhoto(localUri: string, uid: string, folder: 'memories' | 'avatars' = 'memories'): Promise<{ url: string }> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = extOf(localUri);
  const path = `${folder}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: `image/${ext}` });
  const url = await getDownloadURL(storageRef);
  return { url };
}
