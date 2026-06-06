import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { getErrorMessage, useAuth } from "../src/features/auth/AuthContext";
import { HomiTarget, useHomiActions } from "../src/features/assistant/HomiActionProvider";
import { createHouse, getHouses } from "../src/services/api-client";
import { Button } from "../src/shared/components/Button";
import { EmptyState } from "../src/shared/components/EmptyState";
import { FormTextField } from "../src/shared/components/FormTextField";
import { ListRow } from "../src/shared/components/ListRow";
import { Screen } from "../src/shared/components/Screen";
import { Section } from "../src/shared/components/Section";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import type { House } from "../src/types/api";

export default function HousesScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { actionRevision } = useHomiActions();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseName, setHouseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHouses = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getHouses(accessToken);
      setHouses(response.houses);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadHouses();
  }, [actionRevision, loadHouses]);

  async function handleCreateHouse() {
    if (!accessToken || !houseName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await createHouse(accessToken, houseName);
      setHouseName("");
      setHouses((current) => [...current, response.house]);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="房屋" subtitle="管理帳號底下的房屋與每棟房屋的空間。" contentStyle={styles.screenContent}>
      <BackButton label="個人" onPress={() => router.back()} />

      <Section title="新增房屋">
        <FormTextField
          label="房屋名稱"
          value={houseName}
          onChangeText={setHouseName}
          placeholder="例如：家裡"
          error={error}
        />
      </Section>

      <HomiTarget targetId="houses.create">
        <Button
          title="新增房屋"
          icon="add-circle-outline"
          onPress={() => void handleCreateHouse()}
          loading={saving}
          disabled={!houseName.trim()}
          style={styles.primaryButton}
        />
      </HomiTarget>

      <Section title="我的房屋">
        {houses.length === 0 ? (
          <EmptyState
            icon="home-outline"
            title="尚未新增房屋"
            body="新增房屋後，就能在每棟房屋底下建立客廳、廚房或房間等空間。"
          />
        ) : (
          houses.map((house) => (
            <HomiTarget key={house.id} targetId={`houses.house.${house.id}`}>
              <ListRow
              key={house.id}
              title={house.name}
              subtitle={`${house.spaces.length} 個空間`}
              icon="home-outline"
              onPress={() => router.push({ pathname: "/houses/[houseId]", params: { houseId: house.id } })}
              />
            </HomiTarget>
          ))
        )}
      </Section>

      <Button
        title="重新整理"
        icon="refresh-outline"
        onPress={() => void loadHouses()}
        loading={loading}
        variant="secondary"
        style={styles.refreshButton}
      />
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
  },
  refreshButton: {
    marginHorizontal: spacing.md
  }
});
