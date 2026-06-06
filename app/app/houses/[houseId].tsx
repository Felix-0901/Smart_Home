import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { getErrorMessage, useAuth } from "../../src/features/auth/AuthContext";
import { HomiTarget, useHomiActions } from "../../src/features/assistant/HomiActionProvider";
import {
  createHouseSpace,
  deleteHouse,
  deleteHouseSpace,
  getHouse,
  updateHouse,
  updateHouseSpace
} from "../../src/services/api-client";
import { Button } from "../../src/shared/components/Button";
import { EmptyState } from "../../src/shared/components/EmptyState";
import { FormTextField } from "../../src/shared/components/FormTextField";
import { ListRow } from "../../src/shared/components/ListRow";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { House, HouseSpace } from "../../src/types/api";

export default function HouseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ houseId?: string }>();
  const houseId = Array.isArray(params.houseId) ? params.houseId[0] : params.houseId;
  const { accessToken } = useAuth();
  const { actionRevision } = useHomiActions();
  const [house, setHouse] = useState<House | null>(null);
  const [houseName, setHouseName] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingSpace = useMemo(() => {
    return house?.spaces.find((space) => space.id === editingSpaceId) ?? null;
  }, [editingSpaceId, house]);

  const loadHouse = useCallback(async () => {
    if (!accessToken || !houseId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getHouse(accessToken, houseId);
      setHouse(response.house);
      setHouseName(response.house.name);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, houseId]);

  useEffect(() => {
    void loadHouse();
  }, [actionRevision, loadHouse]);

  function replaceSpace(updatedSpace: HouseSpace) {
    setHouse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        spaces: current.spaces.map((space) => (
          space.id === updatedSpace.id ? updatedSpace : space
        ))
      };
    });
  }

  async function handleSaveHouse() {
    if (!accessToken || !houseId || !houseName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await updateHouse(accessToken, houseId, houseName);
      setHouse(response.house);
      setHouseName(response.house.name);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSpace() {
    if (!accessToken || !houseId || !spaceName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await createHouseSpace(accessToken, houseId, spaceName);
      setSpaceName("");
      setHouse((current) => (
        current ? { ...current, spaces: [...current.spaces, response.space] } : current
      ));
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSpace() {
    if (!accessToken || !houseId || !editingSpace || !editingSpaceName.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await updateHouseSpace(accessToken, houseId, editingSpace.id, editingSpaceName);
      replaceSpace(response.space);
      setEditingSpaceId(null);
      setEditingSpaceName("");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteSpace() {
    if (!editingSpace || saving) {
      return;
    }

    Alert.alert(
      "刪除空間",
      `確定要刪除「${editingSpace.name}」嗎？使用此空間的裝置會回到未指定空間。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => void handleDeleteSpace()
        }
      ]
    );
  }

  async function handleDeleteSpace() {
    if (!accessToken || !houseId || !editingSpace) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteHouseSpace(accessToken, houseId, editingSpace.id);
      setHouse((current) => (
        current
          ? { ...current, spaces: current.spaces.filter((space) => space.id !== editingSpace.id) }
          : current
      ));
      setEditingSpaceId(null);
      setEditingSpaceName("");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteHouse() {
    if (!house || saving) {
      return;
    }

    Alert.alert(
      "刪除房屋",
      `確定要刪除「${house.name}」嗎？房屋底下的空間會一起刪除，裝置會回到未指定空間。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => void handleDeleteHouse()
        }
      ]
    );
  }

  async function handleDeleteHouse() {
    if (!accessToken || !houseId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteHouse(accessToken, houseId);
      router.back();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title={house?.name ?? "房屋"}
      subtitle="管理這棟房屋的名稱與空間。"
      contentStyle={styles.screenContent}
    >
      <BackButton label="房屋" onPress={() => router.back()} />

      <Section title="房屋設定">
        <FormTextField
          label="房屋名稱"
          value={houseName}
          onChangeText={setHouseName}
          placeholder="例如：家裡"
          error={error}
        />
      </Section>

      <HomiTarget targetId="houses.house.rename">
        <Button
          title="儲存房屋名稱"
          icon="checkmark-circle-outline"
          onPress={() => void handleSaveHouse()}
          loading={saving}
          disabled={!houseName.trim()}
          style={styles.primaryButton}
        />
      </HomiTarget>

      <Section title="新增空間">
        <FormTextField
          label="空間"
          value={spaceName}
          onChangeText={setSpaceName}
          placeholder="例如：客廳"
        />
      </Section>

      <HomiTarget targetId="houses.space.create">
        <Button
          title="新增空間"
          icon="add-circle-outline"
          onPress={() => void handleCreateSpace()}
          loading={saving}
          disabled={!spaceName.trim()}
          style={styles.primaryButton}
        />
      </HomiTarget>

      <Section title="空間">
        {house && house.spaces.length > 0 ? (
          house.spaces.map((space) => (
            <HomiTarget key={space.id} targetId={`houses.space.${space.id}`}>
              <ListRow
              key={space.id}
              title={space.name}
              icon="cube-outline"
              onPress={() => {
                setEditingSpaceId(space.id);
                setEditingSpaceName(space.name);
              }}
              />
            </HomiTarget>
          ))
        ) : (
          <EmptyState icon="cube-outline" title="尚未新增空間" body="新增空間後，裝置設定就能選擇它。" />
        )}
      </Section>

      {editingSpace ? (
        <>
          <Section title="編輯空間">
            <FormTextField
              label="空間"
              value={editingSpaceName}
              onChangeText={setEditingSpaceName}
              placeholder="例如：主臥"
            />
          </Section>

          <HomiTarget targetId="houses.space.rename">
            <Button
              title="儲存空間"
              icon="checkmark-circle-outline"
              onPress={() => void handleSaveSpace()}
              loading={saving}
              disabled={!editingSpaceName.trim()}
              style={styles.primaryButton}
            />
          </HomiTarget>

          <Button
            title="刪除空間"
            icon="trash-outline"
            onPress={confirmDeleteSpace}
            loading={saving}
            variant="destructive"
            style={styles.primaryButton}
          />
        </>
      ) : null}

      <Section footer="刪除房屋只會移除房屋與空間設定，不會刪除裝置或歷史數據。">
        <ListRow title="刪除房屋" icon="trash-outline" destructive onPress={confirmDeleteHouse} />
      </Section>

      <Button
        title="重新整理"
        icon="refresh-outline"
        onPress={() => void loadHouse()}
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
