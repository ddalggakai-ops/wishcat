import * as XLSX from 'xlsx';
import { CATEGORIES, EMOJIS } from '../theme';
import type { Region } from '../api/types';

export interface ParsedRow {
  title: string;
  emoji: string;
  note: string;
  categories: string[];
  location: { name: string; region: Region } | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: number; // 제목이 비어 있어서 건너뛴 줄 수
  totalRows: number;
  sheetName: string;
}

// 헤더 이름이 한글/영문 어느 쪽으로 와도 알아볼 수 있도록 후보들을 넉넉히 둡니다.
const HEADER_ALIASES: Record<keyof Omit<ParsedRow, 'location'> | 'location' | 'region', string[]> = {
  title: ['제목', '이름', '꿈', 'title', 'name'],
  emoji: ['이모지', '아이콘', 'emoji', 'icon'],
  note: ['메모', '설명', '내용', 'note', 'memo', 'description'],
  categories: ['카테고리', '분류', 'category'],
  location: ['장소', '위치', 'location', 'place'],
  region: ['국내해외', '지역', 'region', '국내/해외'],
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase().replace(/[\s/_-]/g, '');
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((h) => normalizedAliases.includes(normalizeHeader(h)));
}

function toRegion(raw: unknown): Region | null {
  const v = normalizeHeader(raw);
  if (!v) return null;
  if (['해외', 'overseas', '국외'].includes(v)) return 'overseas';
  if (['국내', 'domestic'].includes(v)) return 'domestic';
  return null;
}

export type WorkbookSource =
  | { kind: 'base64'; data: string } // .xlsx/.xls 같은 바이너리 파일
  | { kind: 'text'; data: string }; // .csv 같은 순수 텍스트 파일

/**
 * 엑셀(.xlsx/.xls) 또는 CSV 파일 내용을 파싱합니다. 첫 번째 시트, 첫 번째 줄을 헤더로 간주합니다.
 *
 * CSV는 반드시 kind: 'text' 로(파일을 UTF-8 문자열로 읽어서) 넘겨야 합니다. base64로 넘기면
 * SheetJS가 디코딩된 바이트를 "바이너리 문자열"로 취급해서, 한글이나 이모지처럼 3~4바이트를
 * 쓰는 UTF-8 글자가 깨집니다(예: 🏃 → 잘못된 글자). .xlsx/.xls는 자체 포맷 안에 인코딩 정보가
 * 있어서 base64로 읽어도 문제없습니다.
 */
export function parseWorkbook(source: WorkbookSource): ParseResult {
  const wb = source.kind === 'text'
    ? XLSX.read(source.data, { type: 'string' })
    : XLSX.read(source.data, { type: 'base64' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], skipped: 0, totalRows: 0, sheetName: '' };

  const sheet = wb.Sheets[sheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (grid.length === 0) return { rows: [], skipped: 0, totalRows: 0, sheetName };

  const headers = (grid[0] as unknown[]).map((h) => String(h ?? ''));
  const dataRows = grid.slice(1);

  const idx = {
    title: findColumn(headers, HEADER_ALIASES.title),
    emoji: findColumn(headers, HEADER_ALIASES.emoji),
    note: findColumn(headers, HEADER_ALIASES.note),
    categories: findColumn(headers, HEADER_ALIASES.categories),
    location: findColumn(headers, HEADER_ALIASES.location),
    region: findColumn(headers, HEADER_ALIASES.region),
  };

  // 제목 칸을 못 찾으면(헤더가 없거나 첫 칸이 바로 데이터인 경우) 그냥 첫 번째 열을 제목으로 씁니다.
  const titleIdx = idx.title >= 0 ? idx.title : 0;

  const rows: ParsedRow[] = [];
  let skipped = 0;

  dataRows.forEach((row, i) => {
    const title = String(row[titleIdx] ?? '').trim();
    if (!title) { skipped++; return; }

    const rawEmoji = idx.emoji >= 0 ? String(row[idx.emoji] ?? '').trim() : '';
    const emoji = rawEmoji || EMOJIS[i % EMOJIS.length];

    const note = idx.note >= 0 ? String(row[idx.note] ?? '').trim() : '';

    // 카테고리 칸에 쉼표/슬래시/가운뎃점으로 여러 개를 적어도 각각 인식합니다. (예: "여행,자연")
    const rawCategory = idx.categories >= 0 ? String(row[idx.categories] ?? '').trim() : '';
    const categories = rawCategory
      ? rawCategory.split(/[,/·]/).map((c) => c.trim()).filter((c) => CATEGORIES.includes(c))
      : [];

    const locName = idx.location >= 0 ? String(row[idx.location] ?? '').trim() : '';
    const region = (idx.region >= 0 ? toRegion(row[idx.region]) : null) || 'domestic';
    const location = locName ? { name: locName, region } : null;

    rows.push({ title: title.slice(0, 60), emoji, note: note.slice(0, 80), categories, location });
  });

  return { rows, skipped, totalRows: dataRows.length, sheetName };
}
