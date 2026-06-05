import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth, getErrorMessage } from "../../src/features/auth/AuthContext";
import { Button } from "../../src/shared/components/Button";
import { FormTextField } from "../../src/shared/components/FormTextField";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }

    setLoading(true);

    try {
      await signUp({ displayName, email, password });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(auth)/login");
  }

  return (
    <Screen keyboard scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          建立帳號
        </Text>
        <Text style={styles.subtitle}>
          建立帳號，讓生活更智能{"\n"}
          也讓每個空間的狀態都能被安心掌握
        </Text>
      </View>

      <Section>
        <FormTextField
          label="顯示名稱"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="例如：Felix"
        />
        <FormTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <FormTextField
          label="密碼"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="至少 8 碼"
        />
        <FormTextField
          label="確認密碼"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="再次輸入密碼"
          error={error}
        />
      </Section>

      <Button
        title="註冊並登入"
        onPress={handleSubmit}
        loading={loading}
        disabled={!displayName || !email || password.length < 8 || confirmPassword.length < 8}
        style={styles.primaryButton}
      />
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={handleBackToLogin} style={styles.footerButton}>
          <Text style={styles.footerLink}>回到登入</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingBottom: spacing.xxl
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.largeTitle,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center"
  },
  subtitle: {
    marginTop: spacing.md,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    lineHeight: 23,
    textAlign: "center"
  },
  primaryButton: {
    marginHorizontal: spacing.md
  },
  footer: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  footerButton: {
    minHeight: 44,
    justifyContent: "center"
  },
  footerLink: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    fontWeight: "700"
  }
});
