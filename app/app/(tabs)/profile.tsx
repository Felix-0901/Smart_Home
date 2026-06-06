import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { API_BASE_URL } from "../../src/config/env";
import { HomiTarget } from "../../src/features/assistant/HomiActionProvider";
import { useAuth } from "../../src/features/auth/AuthContext";
import { profileSecurityNote } from "../../src/features/profile/profile-model";
import { ListRow } from "../../src/shared/components/ListRow";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { SegmentedControl } from "../../src/shared/components/SegmentedControl";
import { colors } from "../../src/theme/colors";
import { layout } from "../../src/theme/layout";
import { spacing } from "../../src/theme/spacing";
import type { DeviceGroupMode } from "../../src/features/devices/device-groups";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    signOut,
    developerMode,
    setDeveloperMode,
    deviceGroupMode,
    setDeviceGroupMode
  } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="個人" subtitle="管理帳號資料、APP 連線設定與展示用狀態。" contentStyle={styles.screenContent}>
      <Section title="帳號">
        <HomiTarget targetId="profile.account">
          <ListRow
            title="帳號管理"
            subtitle={user ? `${user.displayName} · ${user.email}` : "管理登入資料、顯示名稱與帳號狀態。"}
            icon="person-circle-outline"
            onPress={() => router.push("/account")}
          />
        </HomiTarget>
      </Section>

      <Section title="生活空間">
        <HomiTarget targetId="profile.houses">
          <ListRow
            title="房屋"
            subtitle="管理房屋與每棟房屋底下的空間。"
            icon="home-outline"
            onPress={() => router.push("/houses")}
          />
        </HomiTarget>
      </Section>

      <Section title="裝置顯示">
        <HomiTarget targetId="profile.deviceGroupMode">
          <View style={styles.preferenceRow}>
            <SegmentedControl
              value={deviceGroupMode}
              options={[
                { label: "系列", value: "series" },
                { label: "空間", value: "space" }
              ]}
              onChange={(value) => void setDeviceGroupMode(value as DeviceGroupMode)}
            />
          </View>
        </HomiTarget>
      </Section>

      <Section title="系統">
        <ListRow title="API 端點" subtitle={API_BASE_URL} icon="server-outline" />
        <ListRow title="資料安全" subtitle={profileSecurityNote} icon="shield-checkmark-outline" />
        <HomiTarget targetId="profile.developerMode">
          <ListRow
            title="開發者模式"
            subtitle="開啟後，數據頁會顯示 raw、ADC、腳位與診斷欄位。"
            icon="construct-outline"
            trailing={
              <Switch
                accessibilityLabel="開發者模式"
                value={developerMode}
                onValueChange={(value) => void setDeveloperMode(value)}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.surfaceSecondary}
              />
            }
          />
        </HomiTarget>
      </Section>

      <Section title="Homi 預覽功能">
        <ListRow
          title="智慧家庭 Agent"
          subtitle="Homi 會依照資料與受控 action 協助導頁、查詢與插座確認操作。"
          icon="sparkles-outline"
        />
      </Section>

      <Section>
        <ListRow title="登出" icon="log-out-outline" destructive onPress={() => void handleSignOut()} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: layout.tabScreenBottomPadding
  },
  preferenceRow: {
    padding: spacing.md,
    backgroundColor: colors.surface
  }
});
