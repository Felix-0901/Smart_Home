import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth, getErrorMessage } from "../../src/features/auth/AuthContext";
import { AppMark } from "../../src/shared/components/AppMark";
import { Button } from "../../src/shared/components/Button";
import { FormTextField } from "../../src/shared/components/FormTextField";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.hero}>
        <AppMark />
        <Text style={styles.title} accessibilityRole="header">
          Smart Home
        </Text>
        <Text style={styles.subtitle}>
          歡迎回來，從即時資料到智慧插座控制{"\n"}
          讓家的狀態一目了然
        </Text>
      </View>

      <Section>
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
          autoComplete="password"
          textContentType="password"
          placeholder="至少 8 碼"
          error={error}
        />
      </Section>

      <Button
        title="登入"
        onPress={handleSubmit}
        loading={loading}
        disabled={!email || !password}
        style={styles.primaryButton}
      />
      <View style={styles.footer}>
        <Link href="/(auth)/register" style={styles.footerLink}>
          建立新帳號
        </Link>
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
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl
  },
  title: {
    marginTop: spacing.lg,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.largeTitle,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center"
  },
  subtitle: {
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
  footerLink: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    fontWeight: "700"
  }
});
