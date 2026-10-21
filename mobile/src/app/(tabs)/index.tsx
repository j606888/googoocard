// 「待處理」：事情沒處理完就一直列著，處理完自動消失（不是通知紀錄）
import { router } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../lib/api';
import { formatCardSerial, formatMoney, useTodos } from '../../lib/todos';
import { colors } from '../../theme';

type Row = { key: string; title: string; detail: string; path: string };

const openWeb = (path: string) => router.push({ pathname: '/web', params: { path } });

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function TodosScreen() {
  const { todos, error, refreshing, refresh } = useTodos();

  const sections = todos
    ? [
        {
          title: '待確認收款',
          data: todos.unpaidCards.map<Row>((c) => ({
            key: `unpaid-${c.id}`,
            title: c.student.name,
            detail: `${c.cardName} ${formatCardSerial(c.serialNumber)}・NT$${formatMoney(c.finalPrice)}`,
            path: `/students/${c.student.id}`,
          })),
        },
        {
          title: '需續約',
          data: todos.needsRenewal.map<Row>((r) => ({
            key: `renewal-${r.student.id}`,
            title: r.student.name,
            detail: `課卡在 ${formatDate(r.since)} 用完`,
            path: `/students/${r.student.id}`,
          })),
        },
        {
          title: '出席沒有課卡',
          data: todos.unboundAttendance.map<Row>((a) => ({
            key: `unbound-${a.id}`,
            title: a.student.name,
            detail: `${a.lessonName}・${formatDate(a.lessonPeriodStartTime)}`,
            path: `/lessons/${a.lessonId}/periods/${a.lessonPeriodId}/check-success`,
          })),
        },
      ].filter((s) => s.data.length > 0)
    : [];

  const noClassroom = error instanceof ApiError && error.status === 401;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <Text style={styles.header}>待處理</Text>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {section.title}　{section.data.length}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => openWeb(item.path)}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowDetail}>{item.detail}</Text>
          </Pressable>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            {noClassroom ? (
              <>
                <Text style={styles.emptyTitle}>還沒有教室</Text>
                <Text style={[styles.emptyText, styles.link]} onPress={() => openWeb('/onboarding')}>
                  建立或加入一間教室
                </Text>
              </>
            ) : error && !todos ? (
              <>
                <Text style={styles.emptyTitle}>載入失敗</Text>
                <Text style={styles.emptyText}>下拉重新整理</Text>
              </>
            ) : todos ? (
              <>
                <Text style={styles.emptyTitle}>都處理完了</Text>
                <Text style={styles.emptyText}>有學生要確認收款、續約或補綁課卡時會出現在這裡</Text>
              </>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMuted },
  header: { fontSize: 28, fontWeight: '700', color: colors.text, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  row: {
    backgroundColor: colors.bg,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  rowPressed: { opacity: 0.6 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 14, color: colors.textMuted },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  link: { color: colors.primaryDark, fontWeight: '600' },
});
