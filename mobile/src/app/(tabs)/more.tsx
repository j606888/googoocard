// 更多：切換教室、網站的其他頁面、通知設定、帳號（登出、刪除帳號）
import { router, useFocusEffect } from 'expo-router';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../../lib/api';
import { API_URL } from '../../lib/config';
import { notificationsAllowed, registerForPush } from '../../lib/push';
import { deleteAccount, signOut, switchClassroom, useSession } from '../../lib/session';
import { colors } from '../../theme';

type Classroom = { id: number; name: string; role: string };
type TodoType = 'UNPAID_CARD' | 'NEEDS_RENEWAL' | 'UNBOUND_ATTENDANCE';
type Me = { name: string; email: string };

// 跟網頁版 src/features/nav/navConfig.ts 的 SECONDARY_LINKS 一致（「帳號」換成這頁）
const PAGES: { title: string; path: string; icon: SFSymbol }[] = [
  { title: '行事曆', path: '/calendar', icon: 'calendar' },
  { title: '課卡', path: '/cards', icon: 'creditcard' },
  { title: '簽到 QR', path: '/checkin-qr', icon: 'qrcode' },
  { title: '老師', path: '/teachers', icon: 'graduationcap' },
  { title: '舞種', path: '/dance-styles', icon: 'music.note' },
  { title: '團隊', path: '/teams', icon: 'person.3' },
];

const NOTIFICATION_TYPES: { type: TodoType; label: string; hint: string }[] = [
  { type: 'UNPAID_CARD', label: '待確認收款', hint: '學生在 LINE 自助購買課卡時' },
  { type: 'NEEDS_RENEWAL', label: '需續約', hint: '學生的課卡剛用完時' },
  { type: 'UNBOUND_ATTENDANCE', label: '出席沒有課卡', hint: '學生自助簽到但沒有可用的課卡時' },
];

const CONFIRM_TEXT = '我確認要刪除';

const openWeb = (path: string) => router.push({ pathname: '/web', params: { path } });

export default function MoreScreen() {
  const { epoch } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [classrooms, setClassrooms] = useState<{ classrooms: Classroom[]; currentClassroomId: number | null } | null>(
    null,
  );
  const [prefs, setPrefs] = useState<Record<TodoType, boolean> | null>(null);
  const [allowed, setAllowed] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void api<Me>('/api/me').then(setMe).catch(() => {});
      void api<typeof classrooms>('/api/classrooms').then(setClassrooms).catch(() => {});
      void api<Record<TodoType, boolean>>('/api/notification-preferences')
        .then(setPrefs)
        .catch(() => setPrefs(null));
      void notificationsAllowed().then(setAllowed);
      // epoch：換了教室，通知設定是每間教室分開的，要重抓
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [epoch]),
  );

  const current = classrooms?.classrooms.find((c) => c.id === classrooms.currentClassroomId);

  const chooseClassroom = (c: Classroom) => {
    if (c.id === classrooms?.currentClassroomId) return;
    switchClassroom(c.id)
      .then(() => setClassrooms((prev) => (prev ? { ...prev, currentClassroomId: c.id } : prev)))
      .catch(() => Alert.alert('切換失敗', '請稍後再試'));
  };

  const togglePref = (type: TodoType, enabled: boolean) => {
    setPrefs((p) => (p ? { ...p, [type]: enabled } : p));
    api('/api/notification-preferences', { method: 'PUT', body: JSON.stringify({ type, enabled }) }).catch(() => {
      setPrefs((p) => (p ? { ...p, [type]: !enabled } : p));
      Alert.alert('儲存失敗', '請稍後再試');
    });
  };

  const enableNotifications = async () => {
    await registerForPush();
    if (await notificationsAllowed()) setAllowed(true);
    else void Linking.openSettings();
  };

  const confirmSignOut = () =>
    Alert.alert('登出', '登出後這支手機不會再收到通知。', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.prompt(
      '刪除帳號',
      `刪除後無法復原。你的名稱、Email 與 LINE 綁定都會清除，所有教室都會把你移出；教室裡的學生、課卡與收入紀錄不受影響。\n\n請輸入「${CONFIRM_TEXT}」`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '刪除',
          style: 'destructive',
          onPress: (text?: string) => {
            if (text?.trim() !== CONFIRM_TEXT) {
              Alert.alert('沒有刪除', `要輸入「${CONFIRM_TEXT}」才會刪除。`);
              return;
            }
            deleteAccount().catch((e) => {
              const owned = (e instanceof ApiError && e.status === 409
                ? (e.body as { classrooms?: { name: string }[] } | null)?.classrooms
                : null) ?? null;
              if (owned) {
                Alert.alert(
                  '還不能刪除',
                  `你還是這些教室的擁有者：${owned.map((c) => `「${c.name}」`).join('、')}。請先到「團隊」把教室轉給其他成員，或刪除教室。`,
                  [
                    { text: '好', style: 'cancel' },
                    { text: '前往團隊', onPress: () => openWeb('/teams') },
                  ],
                );
              } else {
                Alert.alert('刪除失敗', '請稍後再試');
              }
            });
          },
        },
      ],
      'plain-text',
    );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>更多</Text>

        {classrooms && classrooms.classrooms.length > 0 && (
          <Section title="教室">
            {classrooms.classrooms.map((c) => (
              <Row key={c.id} title={c.name} onPress={() => chooseClassroom(c)}>
                {c.id === classrooms.currentClassroomId && (
                  <SymbolView name="checkmark" tintColor={colors.primaryDark} size={18} />
                )}
              </Row>
            ))}
          </Section>
        )}

        <Section title={current ? `「${current.name}」` : '網站'}>
          {PAGES.map((p) => (
            <Row key={p.path} title={p.title} icon={p.icon} onPress={() => openWeb(p.path)} chevron />
          ))}
        </Section>

        <Section title="通知" footer="有事情需要處理時推播到這支手機。每間教室分開設定。">
          {!allowed && <Row title="開啟通知" onPress={enableNotifications} tint={colors.primaryDark} chevron />}
          {NOTIFICATION_TYPES.map(({ type, label, hint }) => (
            <Row key={type} title={label} subtitle={hint}>
              <Switch
                value={prefs?.[type] ?? true}
                disabled={!prefs}
                onValueChange={(v) => togglePref(type, v)}
                trackColor={{ true: colors.primary }}
              />
            </Row>
          ))}
        </Section>

        <Section title="帳號">
          {me && <Row title={me.name} subtitle={me.email} />}
          <Row title="隱私權政策" onPress={() => Linking.openURL(`${API_URL}/privacy`)} chevron />
          <Row title="服務條款" onPress={() => Linking.openURL(`${API_URL}/terms`)} chevron />
          <Row title="登出" onPress={confirmSignOut} tint={colors.danger} />
        </Section>

        <Section>
          <Row title="刪除帳號" onPress={confirmDelete} tint={colors.danger} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

function Row({
  title,
  subtitle,
  icon,
  tint,
  chevron,
  onPress,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: SFSymbol;
  tint?: string;
  chevron?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
    >
      {icon && <SymbolView name={icon} tintColor={colors.primaryDark} size={20} />}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, tint ? { color: tint } : null]}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {children}
      {chevron && <SymbolView name="chevron.right" tintColor={colors.textMuted} size={14} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMuted },
  content: { paddingBottom: 32 },
  header: { fontSize: 28, fontWeight: '700', color: colors.text, paddingHorizontal: 20, paddingTop: 12 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 4 },
  footer: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginLeft: 4 },
  card: { backgroundColor: colors.bg, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.bgMuted },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
});
