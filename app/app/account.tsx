import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { getErrorMessage, useAuth } from "../src/features/auth/AuthContext";
import { Button } from "../src/shared/components/Button";
import { FormTextField } from "../src/shared/components/FormTextField";
import { ListRow } from "../src/shared/components/ListRow";
import { Screen } from "../src/shared/components/Screen";
import { Section } from "../src/shared/components/Section";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

export default function AccountScreen() {
  const router = useRouter();
  const { user, changePassword, deleteAccount } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const canSubmitPassword =
    currentPassword.trim().length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    !savingPassword &&
    !deletingAccount;

  async function handleChangePassword() {
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("新密碼與確認新密碼不一致");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword,
        newPassword
      });
      Alert.alert("密碼已更新", "請使用新密碼重新登入。");
    } catch (changeError) {
      setPasswordError(getErrorMessage(changeError));
      setSavingPassword(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "註銷帳號",
      "註銷後會移除帳號、房屋、空間與裝置綁定；硬體裝置資料與歷史感測資料會保留在系統資料庫中。確定要繼續嗎？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "註銷帳號",
          style: "destructive",
          onPress: () => void handleDeleteAccount()
        }
      ]
    );
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setPasswordError(null);

    try {
      await deleteAccount();
    } catch (deleteError) {
      setPasswordError(getErrorMessage(deleteError));
      setDeletingAccount(false);
    }
  }

  return (
    <Screen title="帳號管理" subtitle="管理登入密碼與帳號狀態。" contentStyle={styles.screenContent}>
      <BackButton label="個人" onPress={() => router.back()} />

      <Section title="帳號資訊">
        <ListRow title="Email" subtitle={user?.email ?? "尚未登入"} icon="mail-outline" />
      </Section>

      <Section title="修改密碼" footer="密碼更新後會登出此裝置，請用新密碼重新登入。">
        <FormTextField
          label="舊密碼"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="輸入舊密碼"
        />
        <FormTextField
          label="新密碼"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          textContentType="newPassword"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="至少 8 位"
        />
        <FormTextField
          label="確認新密碼"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="再次輸入"
          error={passwordError}
        />
      </Section>

      <Button
        title="更新密碼"
        icon="key-outline"
        onPress={() => void handleChangePassword()}
        loading={savingPassword}
        disabled={!canSubmitPassword}
        style={styles.primaryButton}
      />

      <Section title="危險操作" footer="註銷帳號不會刪除硬體歷史資料，但會解除目前帳號的所有個人設定與裝置綁定。">
        <ListRow
          title={deletingAccount ? "註銷中..." : "註銷帳號"}
          subtitle="永久移除此 App 帳號"
          icon="trash-outline"
          destructive
          onPress={deletingAccount ? undefined : confirmDeleteAccount}
        />
      </Section>
    </Screen>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`返回${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 110
  },
  backButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md
  },
  backButtonPressed: {
    opacity: 0.55
  },
  backText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    letterSpacing: 0
  },
  primaryButton: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl
  }
});
