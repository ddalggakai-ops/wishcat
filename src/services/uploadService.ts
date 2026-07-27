import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

function extOf(localUri: string): string {
  const filename = localUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match ? match[1] : 'jpg').toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

// 로컬 사진을 Firebase Storage에 업로드하고 다운로드 URL을 반환
export async function uploadPhoto(localUri: string, uid: string): Promise<{ url: string }> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = extOf(localUri);
  const path = `memories/${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: `image/${ext}` });
  const url = await getDownloadURL(storageRef);
  return { url };
}
