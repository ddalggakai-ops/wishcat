// 위경도 ↔ OSM 슬리피맵 타일 좌표 변환 유틸.
// 지도 API 키 없이(구글/네이버 키 없이도) OpenStreetMap 표준 타일 서버를 그대로 그려서
// "지도에서 위치 고르기" 와 "위치 작게 미리보기" 를 구현하기 위한 순수 계산 함수들입니다.
// 참고: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

export const TILE_SIZE = 256;

/** 위경도 → 해당 줌레벨에서의 (소수 포함) 타일 좌표 */
export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** (소수 포함) 타일 좌표 → 위경도 */
export function tileToLonLat(x: number, y: number, zoom: number): { lon: number; lat: number } {
  const n = 2 ** zoom;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat: clampLat(lat) };
}

export function tileUrl(x: number, y: number, z: number): string {
  const n = 2 ** z;
  // 드래그로 경도가 한 바퀴를 넘어가도 타일 인덱스가 순환하도록 보정
  const wrapped = ((x % n) + n) % n;
  return `https://tile.openstreetmap.org/${z}/${wrapped}/${y}.png`;
}

function clampLat(lat: number): number {
  // 메르카토르 투영 한계(±85.0511°) 밖은 좌표가 발산하므로 잘라줍니다.
  return Math.max(-85.05, Math.min(85.05, lat));
}

export const REGION_DEFAULT_CENTER: Record<'domestic' | 'overseas', { lon: number; lat: number; zoom: number }> = {
  domestic: { lon: 126.978, lat: 37.5665, zoom: 12 }, // 서울
  overseas: { lon: 2.3522, lat: 48.8566, zoom: 11 }, // 파리
};
