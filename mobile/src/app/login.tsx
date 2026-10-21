import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from '../lib/config';
import { type LoginError, signIn } from '../lib/session';
import { colors } from '../theme';

const MESSAGES: Record<LoginError, string> = {
  EMAIL_NOT_FOUND: '找不到這個 Email',
  INVALID_PASSWORD: '密碼不對',
  RATE_LIMITED: '嘗試太多次，請過幾分鐘再試',
  NETWORK: '連不上伺服器，請檢查網路',
  UNKNOWN: '登入失敗，請稍後再試',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    setError(await signIn(email, password));
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.hero}>
        <Text style={styles.heroTitle}>Googoocard</Text>
        <Text style={styles.heroSub}>讓你的教學更輕鬆</Text>
      </SafeAreaView>
      <KeyboardAvoidingView behavior="padding" style={styles.panel}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
        />
        <Text style={styles.label}>密碼</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.error}>{MESSAGES[error]}</Text>}
        <Pressable
          style={[styles.button, (!email || !password) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!email || !password || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>登入</Text>}
        </Pressable>
        <Text style={styles.hint}>
          還沒有帳號？請先到網站註冊，再回來登入。
        </Text>
        <View style={styles.links}>
          <Text style={styles.link} onPress={() => Linking.openURL(`${API_URL}/signup`)}>
            前往註冊
          </Text>
          <Text style={styles.link} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>
            隱私權政策
          </Text>
          <Text style={styles.link} onPress={() => Linking.openURL(`${API_URL}/terms`)}>
            服務條款
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  hero: { height: '34%', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '700' },
  heroSub: { color: '#fff', fontSize: 16, opacity: 0.9 },
  panel: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: colors.text,
  },
  error: { color: colors.danger, marginBottom: 12 },
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { marginTop: 20, color: colors.textMuted, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  link: { color: colors.primaryDark, fontWeight: '600' },
});
