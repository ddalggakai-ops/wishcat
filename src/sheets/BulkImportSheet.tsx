import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Sheet from '../components/Sheet';
import BubbleButton from '../components/Button';
import { colors, radius } from '../theme';
import { parseWorkbook, type ParseResult } from '../services/bulkImportService';
import { useApp } from '../context/AppContext';

type Stage = 'pick' | 'preview' | 'importing' | 'done';

/**
 * 엑셀(.xlsx/.xls) 또는 CSV 파일을 골라 여러 개의 꿈을 한 번에 추가하는 시트.
 * 헤더 이름은 "제목/이모지/메모/카테고리/장소/국내해외" 또는 영문(title/emoji/note/category/location/region)
 * 어느 쪽이든 알아서 찾아서 읽습니다. 제목 칸만 필수이고 나머지는 비워둬도 됩니다.
 */
export default function BulkImportSheet({ visible, onClose, onImported }: {
  visible: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const { bulkAddItems } = useApp();
  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');
  const [addedCount, setAddedCount] = useState(0);

  const reset = () => {
    setStage('pick'); setFileName(''); setParsed(null); setError(''); setAddedCount(0);
  };

  const close = () => { reset(); onClose(); };

  const pickFile = async () => {
    setError('');
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv',
          'text/comma-separated-values',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setFileName(asset.name || '엑셀 파일');

      // CSV는 순수 텍스트라 UTF-8 문자열로 그대로 읽어야 한글/이모지가 안 깨집니다.
      // .xlsx/.xls는 자체 포맷(zip) 안에 인코딩 정보가 있는 바이너리라 base64로 읽습니다.
      const isCsv = /\.csv$/i.test(asset.name || '') || /csv/i.test(asset.mimeType || '');
      const file = new File(asset.uri);
      const result = isCsv
        ? parseWorkbook({ kind: 'text', data: await file.text() })
        : parseWorkbook({ kind: 'base64', data: await file.base64() });
      if (result.rows.length === 0) {
        setError('읽을 수 있는 줄을 찾지 못했어요. 첫 번째 줄이 "제목" 같은 헤더인지, 그 아래에 내용이 있는지 확인해주세요.');
        return;
      }
      setParsed(result);
      setStage('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 읽는 중 문제가 생겼어요');
    }
  };

  const confirmImport = async () => {
    if (!parsed) return;
    setStage('importing');
    try {
      const count = await bulkAddItems(parsed.rows);
      setAddedCount(count);
      setStage('done');
      onImported(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가하는 중 문제가 생겼어요');
      setStage('preview');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="📊 엑셀로 여러 개 추가"
      subtitle="엑셀(.xlsx) 또는 CSV 파일을 골라 여러 개의 꿈을 한 번에 만들어요."
    >
      {stage === 'pick' && (
        <>
          <View style={styles.helpBox}>
            <Text style={styles.helpTitle}>이런 형식으로 준비해주세요</Text>
            <Text style={styles.helpText}>
              첫 번째 줄은 제목(헤더)이에요. 꼭 필요한 칸은 <Text style={styles.bold}>제목</Text> 하나뿐이고,{'\n'}
              이모지 · 메모 · 카테고리 · 장소 · 국내해외 칸은 있으면 쓰고 없으면 비워도 돼요.
            </Text>
            <View style={styles.table}>
              <View style={styles.tRow}>
                {['제목', '이모지', '메모', '카테고리', '장소', '국내해외'].map((h) => (
                  <Text key={h} style={styles.tHeadCell}>{h}</Text>
                ))}
              </View>
              <View style={styles.tRow}>
                {['오로라 보기', '🌌', '아이슬란드에서', '여행', '아이슬란드', '해외'].map((h, i) => (
                  <Text key={i} style={styles.tCell}>{h}</Text>
                ))}
              </View>
            </View>
            <Text style={styles.helpText}>카테고리는 여행 · 액티비티 · 취미 · 음식 · 관계 · 자연 · 성장 · 도전 중에서 골라 적으면 색깔이 입혀져요. 다르게 적어도 오류는 안 나요, 카테고리만 비워둘 뿐이에요.</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <BubbleButton title="엑셀/CSV 파일 선택" onPress={pickFile} full style={{ marginTop: 18 }} />
        </>
      )}

      {stage === 'preview' && parsed && (
        <>
          <Text style={styles.fileName}>📄 {fileName}</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLine}>✅ 추가될 줄: <Text style={styles.bold}>{parsed.rows.length}개</Text></Text>
            {parsed.skipped > 0 && (
              <Text style={styles.summaryLine}>⏭ 제목이 없어서 건너뛴 줄: {parsed.skipped}개</Text>
            )}
          </View>
          <Text style={styles.previewLabel}>미리보기 (앞 5개)</Text>
          {parsed.rows.slice(0, 5).map((r, i) => (
            <View key={i} style={styles.previewRow}>
              <Text style={styles.previewEmoji}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={1}>{r.title}</Text>
                {(r.note || r.location) ? (
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {[r.categories.join('/'), r.note, r.location?.name].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {parsed.rows.length > 5 ? <Text style={styles.previewMore}>외 {parsed.rows.length - 5}개 더</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <BubbleButton
            title={`${parsed.rows.length}개 추가하기`}
            onPress={confirmImport}
            full
            style={{ marginTop: 18 }}
          />
          <BubbleButton title="다른 파일 선택" onPress={reset} variant="ghost" full style={{ marginTop: 10 }} />
        </>
      )}

      {stage === 'importing' && (
        <View style={styles.centerBox}>
          <BubbleButton title="추가하는 중…" onPress={() => {}} loading full />
        </View>
      )}

      {stage === 'done' && (
        <>
          <View style={styles.doneBox}>
            <Text style={{ fontSize: 34 }}>🎉</Text>
            <Text style={styles.doneTitle}>{addedCount}개의 꿈을 추가했어요</Text>
            <Text style={styles.doneSub}>내 목록에서 바로 확인할 수 있어요.</Text>
          </View>
          <BubbleButton title="닫기" onPress={close} full style={{ marginTop: 8 }} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  helpBox: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, gap: 10 },
  helpTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  helpText: { fontSize: 12.5, color: colors.ink2, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.ink },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' },
  tRow: { flexDirection: 'row' },
  tHeadCell: { flex: 1, fontSize: 10.5, fontWeight: '700', color: colors.ink2, backgroundColor: colors.surface, paddingVertical: 7, paddingHorizontal: 4, textAlign: 'center' },
  tCell: { flex: 1, fontSize: 10, color: colors.ink2, backgroundColor: colors.surface, paddingVertical: 7, paddingHorizontal: 4, textAlign: 'center' },
  error: { fontSize: 12.5, color: colors.like, marginTop: 12, lineHeight: 18 },
  fileName: { fontSize: 13.5, fontWeight: '600', color: colors.ink, marginBottom: 10 },
  summaryBox: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, gap: 4 },
  summaryLine: { fontSize: 13, color: colors.ink2 },
  previewLabel: { fontSize: 12, fontWeight: '700', color: colors.ink2, marginTop: 16, marginBottom: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  previewEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  previewTitle: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  previewSub: { fontSize: 11.5, color: colors.ink3, marginTop: 1 },
  previewMore: { fontSize: 12, color: colors.ink3, marginTop: 4 },
  centerBox: { alignItems: 'center', paddingVertical: 20 },
  doneBox: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  doneTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  doneSub: { fontSize: 13, color: colors.ink2 },
});
