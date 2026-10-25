// 「待處理」：事情沒處理完就一直列著，處理完自動消失（不是通知紀錄）
import { router } from 'expo-router';
import { Image, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SymbolView } from 'expo-symbols';

import { ApiError } from '../../lib/api';
import { API_URL } from '../../lib/config';
import { formatCardSerial, formatMoney, useTodos } from '../../lib/todos';
import { colors } from '../../theme';

type Row = { key: string; title: string; avatarUrl: string; detail: string; amount?: string; path: string };

// 預設頭像是網站上的相對路徑（/images/avatars/…），上傳的照片是 Cloudinary 的完整網址
const avatarSource = (url: string) => ({ uri: url.startsWith('/') ? `${API_URL}${url}` : url });

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
            avatarUrl: c.student.avatarUrl,
            detail: `${c.cardName} ${formatCardSerial(c.serialNumber)}${
              c.usedSessions ? `・已用 ${c.usedSessions} 堂` : ''
            }`,
            amount: `NT$${formatMoney(c.finalPrice)}`,
            path: `/students/${c.student.id}`,
          })),
        },
        {
          title: '出席沒有課卡',
          data: todos.unboundAttendance.map<Row>((a) => ({
            key: `unbound-${a.id}`,
            title: a.student.name,
            avatarUrl: a.student.avatarUrl,
            detail: `${a.lessonName}・${formatDate(a.lessonPeriodStartTime)}`,
            path: `/lessons/${a.lessonId}/periods/${a.lessonPeriodId}/check-success`,
          })),
        },
        {
          title: '需續約',
          data: todos.needsRenewal.map<Row>((r) => ({
            key: `renewal-${r.student.id}`,
            title: r.student.name,
            avatarUrl: r.student.avatarUrl,
            detail: `課卡在 ${formatDate(r.since)} 用完`,
            path: `/students/${r.student.id}`,
          })),
        },
        {
          title: '可能重複',
          data: (todos.possibleDuplicates ?? []).map<Row>((group) => {
            // 最新的那位多半是門口自助登記的，打開它、預選最早那位當合併對象
            const newest = group.students[group.students.length - 1];
            const oldest = group.students[0];
            return {
              key: `dup-${newest.id}`,
              title: newest.name,
              avatarUrl: newest.avatarUrl,
              detail: `${group.students.length} 位同名，確認後合併`,
              path: `/students/${newest.id}?mergeInto=${oldest.id}`,
            };
          }),
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
            <Image source={avatarSource(item.avatarUrl)} style={styles.avatar} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowDetail} numberOfLines={1}>
                {item.detail}
              </Text>
            </View>
            {item.amount && <Text style={styles.amount}>{item.amount}</Text>}
            <SymbolView name="chevron.right" tintColor="#A3A3A3" size={14} />
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgMuted },
  rowText: { flex: 1, gap: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.warning },
  rowPressed: { opacity: 0.6 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 14, color: colors.textMuted },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  link: { color: colors.primaryDark, fontWeight: '600' },
});
