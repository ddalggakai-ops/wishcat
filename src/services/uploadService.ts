import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { storage } from '../firebase/config';

function extOf(localUri: string): string {
  const filename = localUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = (match ? match[1] : 'jpg').toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

// 요즘 폰 카메라 사진은 가로 3000~4000px가 넘어서 파일 하나가 몇 MB씩 나가요.
// 화면에서 실제로 보이는 크기(가장 큰 곳도 400px 안팎)에 비하면 훨씬 과한 크기라, 업로드 전에
// 가로 1440px로 줄이고 JPEG로 다시 압축해서 보통 수백 KB 수준으로 가볍게 만듭니다.
// (업로드가 느리다는 문제의 실제 원인이 바로 이 "원본 그대로 올리기"였어요)
const MAX_UPLOAD_WIDTH = 1440;

async function shrinkForUpload(localUri: string): Promise<{ uri: string; shrunk: boolean }> {
  try {
    const rendered = await ImageManipulator.manipulate(localUri).resize({ width: MAX_UPLOAD_WIDTH }).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
    return { uri: saved.uri, shrunk: true };
  } catch {
    // 혹시 줄이기 자체가 실패하면(지원 안 하는 형식 등) 원본이라도 그대로 올립니다 —
    // 업로드가 아예 안 되는 것보단 느리더라도 되는 게 나아요.
    return { uri: localUri, shrunk: false };
  }
}

// 로컬 사진을 Firebase Storage에 업로드하고 다운로드 URL을 반환.
// folder로 'memories'(추억 사진, 기본값) 또는 'avatars'(프로필 사진)를 고를 수 있어요.
// 두 폴더 모두 storage.rules에 각각의 규칙이 있어야 업로드가 됩니다.
export async function uploadPhoto(localUri: string, uid: string, folder: 'memories' | 'avatars' = 'memories'): Promise<{ url: string }> {
  const { uri: uploadUri, shrunk } = await shrinkForUpload(localUri);
  const res = await fetch(uploadUri);
  const blob = await res.blob();
  const ext = shrunk ? 'jpeg' : extOf(localUri);
  const path = `${folder}/${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: `image/${ext}` });
  const url = await getDownloadURL(storageRef);
  return { url };
}
