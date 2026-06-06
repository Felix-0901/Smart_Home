import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  Animated,
  Alert,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { useAuth, getErrorMessage } from "../../src/features/auth/AuthContext";
import { HomiTarget, useHomiActions } from "../../src/features/assistant/HomiActionProvider";
import { getDeviceGroups, type DeviceGroup } from "../../src/features/devices/device-groups";
import {
  formatReadingTime,
  getDeviceStatus,
  getDeviceSubtitle,
  getDeviceTitle,
  getSeriesColor,
  getSeriesShortLabel
} from "../../src/features/devices/device-format";
import { claimDevice, deleteDevice, getDevices, getHouses, updateDevice } from "../../src/services/api-client";
import { Button } from "../../src/shared/components/Button";
import { EmptyState } from "../../src/shared/components/EmptyState";
import { FormTextField } from "../../src/shared/components/FormTextField";
import { ListRow } from "../../src/shared/components/ListRow";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { SeriesBadge } from "../../src/shared/components/SeriesBadge";
import { StatusDot } from "../../src/shared/components/StatusDot";
import { colors } from "../../src/theme/colors";
import { layout } from "../../src/theme/layout";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Device, House } from "../../src/types/api";

type IconName = ComponentProps<typeof Ionicons>["name"];

export default function DevicesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { accessToken, deviceGroupMode } = useAuth();
  const { actionRevision, consumeDeviceSettings, pendingDeviceSettings } = useHomiActions();
  const [devices, setDevices] = useState<Device[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [productCode, setProductCode] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<"house" | "space" | null>(null);
  const [alias, setAlias] = useState("");
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const selectorBackdropOpacity = useRef(new Animated.Value(0)).current;
  const selectorProgress = useRef(new Animated.Value(0)).current;
  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? null;
  const selectedSpace = selectedHouse?.spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const deviceGroups = getDeviceGroups(devices, deviceGroupMode);
  const groupedDeviceCardWidth = width - spacing.md * 2;

  const loadDevices = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getDevices(accessToken);
      setDevices(response.devices);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadHouses = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      const response = await getHouses(accessToken);
      setHouses(response.houses);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }, [accessToken]);

  useEffect(() => {
    void loadDevices();
    void loadHouses();
  }, [actionRevision, loadDevices, loadHouses]);

  useEffect(() => {
    if (!pendingDeviceSettings || devices.length === 0) {
      return;
    }

    const targetDevice = devices.find((device) => device.id === pendingDeviceSettings.deviceId);
    if (targetDevice) {
      openDeviceSheet(targetDevice);
    }

    consumeDeviceSettings(pendingDeviceSettings.commandId);
  }, [consumeDeviceSettings, devices, pendingDeviceSettings]);

  async function handleClaim() {
    if (!accessToken) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await claimDevice(accessToken, productCode);
      setProductCode("");
      await loadDevices();
    } catch (claimError) {
      setError(getErrorMessage(claimError));
    } finally {
      setSaving(false);
    }
  }

  function openDeviceSheet(device: Device) {
    setSelectedDevice(device);
    setAlias(device.alias ?? "");
    setSelectedHouseId(device.houseId);
    setSelectedSpaceId(device.spaceId);
    setSheetVisible(true);
    backdropOpacity.setValue(0);
    sheetProgress.setValue(0);

    Animated.sequence([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.delay(40),
      Animated.timing(sheetProgress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }

  const closeDeviceSheet = useCallback(() => {
    return new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(sheetProgress, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(() => {
        setSheetVisible(false);
        setSelectedDevice(null);
        resolve();
      });
    });
  }, [backdropOpacity, sheetProgress]);

  function handleCloseDeviceSheet() {
    void closeDeviceSheet();
  }

  function openSelectionMenu(type: "house" | "space") {
    setSelectionMenu(type);
    selectorBackdropOpacity.setValue(0);
    selectorProgress.setValue(0);

    Animated.parallel([
      Animated.timing(selectorBackdropOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(selectorProgress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }

  const closeSelectionMenu = useCallback(() => {
    return new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(selectorProgress, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(selectorBackdropOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(() => {
        setSelectionMenu(null);
        resolve();
      });
    });
  }, [selectorBackdropOpacity, selectorProgress]);

  async function handleSaveDevice() {
    if (!accessToken || !selectedDevice) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateDevice(accessToken, selectedDevice.id, {
        alias: alias.trim() || null,
        houseId: selectedHouseId,
        spaceId: selectedSpaceId
      });
      await closeDeviceSheet();
      await loadDevices();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function openHousesSettings() {
    if (selectionMenu) {
      await closeSelectionMenu();
    }
    await closeDeviceSheet();
    router.push("/houses");
  }

  function confirmDeleteDevice() {
    if (!selectedDevice || saving || deleting) {
      return;
    }

    Alert.alert(
      "移除裝置",
      `確定要從此帳號移除「${getDeviceTitle(selectedDevice)}」嗎？歷史資料會保留，之後仍可用產品編號重新綁定。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "移除",
          style: "destructive",
          onPress: () => void handleDeleteDevice()
        }
      ]
    );
  }

  async function handleDeleteDevice() {
    if (!accessToken || !selectedDevice) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteDevice(accessToken, selectedDevice.id);
      await closeDeviceSheet();
      await loadDevices();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen
      title="裝置"
      subtitle="透過產品編號綁定裝置，讓您可以掌握全局。"
      contentStyle={styles.screenContent}
    >
      <Section title="新增產品">
        <HomiTarget targetId="devices.claimInput">
          <FormTextField
            label="產品編號"
            value={productCode}
            onChangeText={setProductCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="P-DEMO-0001"
            error={error}
          />
        </HomiTarget>
      </Section>

      <HomiTarget targetId="devices.claimButton">
        <Button
          title="綁定裝置"
          icon="add-circle-outline"
          onPress={handleClaim}
          loading={saving}
          disabled={productCode.trim().length < 3}
          style={styles.claimButton}
        />
      </HomiTarget>

      <View style={styles.deviceSection}>
        <Text style={styles.deviceSectionTitle}>我的裝置</Text>
        {devices.length === 0 ? (
          <View style={styles.deviceEmptyCard}>
            <EmptyState
              icon="cube-outline"
              title="尚未綁定產品"
              body="輸入後端預建的產品編號後，這裡會顯示該帳號擁有的裝置。"
            />
          </View>
        ) : (
          <DeviceGroupList
            groups={deviceGroups}
            cardWidth={groupedDeviceCardWidth}
            onOpenDevice={openDeviceSheet}
          />
        )}
        <Text style={styles.deviceSectionFooter}>可在個人頁切換依系列或依空間顯示。</Text>
      </View>

      <Button
        title="重新整理"
        icon="refresh-outline"
        onPress={() => void loadDevices()}
        loading={loading}
        variant="secondary"
        style={styles.refreshButton}
      />

      <Modal
        visible={sheetVisible}
        animationType="none"
        transparent
        onRequestClose={handleCloseDeviceSheet}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseDeviceSheet}>
            <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View
            style={[
              styles.sheet,
              {
                transform: [
                  {
                    translateY: sheetProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [420, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={handleCloseDeviceSheet}
                style={[styles.sheetHeaderButton, styles.sheetHeaderButtonLeft]}
              >
                <Text style={styles.sheetHeaderAction}>取消</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>裝置設定</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleSaveDevice()}
                disabled={saving || deleting}
                style={[styles.sheetHeaderButton, styles.sheetHeaderButtonRight]}
              >
                <HomiTarget targetId="devices.sheet.save" style={styles.sheetTargetProbe} />
                <Text
                  style={[
                    styles.sheetHeaderAction,
                    styles.sheetHeaderActionRight,
                    (saving || deleting) && styles.disabledAction
                  ]}
                >
                  儲存
                </Text>
              </Pressable>
            </View>

            {selectedDevice ? (
              <>
                <Section>
                  <ListRow title="產品編號" value={selectedDevice.productCode} />
                  <ListRow title="裝置 ID" value={selectedDevice.deviceId} />
                </Section>
                <Section>
                  <HomiTarget targetId="devices.sheet.alias">
                    <FormTextField
                      label="裝置暱稱"
                      value={alias}
                      onChangeText={setAlias}
                      placeholder="例如：廚房的小插座"
                    />
                  </HomiTarget>
                </Section>
                <Section title="位置" footer="先選擇房屋後，才能選擇該房屋底下的空間。">
                  <HomiTarget targetId="devices.sheet.house">
                    <ListRow
                      title="房屋"
                      value={selectedHouse?.name ?? "未指定"}
                      icon="home-outline"
                      onPress={() => {
                        if (houses.length > 0) {
                          openSelectionMenu("house");
                          return;
                        }

                        void openHousesSettings();
                      }}
                    />
                  </HomiTarget>
                  <HomiTarget targetId="devices.sheet.space">
                    <ListRow
                      title="空間"
                      subtitle={selectedHouse ? undefined : "請先選擇房屋"}
                      value={selectedHouse ? selectedSpace?.name ?? "未指定" : "尚未可選"}
                      icon="cube-outline"
                      onPress={selectedHouse ? () => openSelectionMenu("space") : undefined}
                    />
                  </HomiTarget>
                </Section>
                <Section footer="移除後只會解除此帳號的綁定，不會刪除產品資料或歷史數據。">
                  <ListRow
                    title={deleting ? "移除中..." : "移除裝置"}
                    subtitle="從目前帳號解除綁定"
                    icon="trash-outline"
                    destructive
                    onPress={confirmDeleteDevice}
                  />
                </Section>
              </>
            ) : null}
          </Animated.View>
          <SelectionMenu
            visible={selectionMenu !== null}
            type={selectionMenu}
            houses={houses}
            selectedHouse={selectedHouse}
            selectedHouseId={selectedHouseId}
            selectedSpaceId={selectedSpaceId}
            backdropOpacity={selectorBackdropOpacity}
            progress={selectorProgress}
            onClose={() => void closeSelectionMenu()}
            onSelectHouse={async (houseId) => {
              setSelectedHouseId(houseId);
              setSelectedSpaceId(null);
              await closeSelectionMenu();
            }}
            onSelectSpace={async (spaceId) => {
              setSelectedSpaceId(spaceId);
              await closeSelectionMenu();
            }}
            onOpenHousesSettings={() => void openHousesSettings()}
          />
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function DeviceGroupList({
  groups,
  cardWidth,
  onOpenDevice
}: {
  groups: DeviceGroup[];
  cardWidth: number;
  onOpenDevice: (device: Device) => void;
}) {
  return (
    <View style={styles.deviceGroupStack}>
      {groups.map((group) => (
        <DeviceGroupRow
          key={group.id}
          group={group}
          cardWidth={cardWidth}
          onOpenDevice={onOpenDevice}
        />
      ))}
    </View>
  );
}

function DeviceGroupRow({
  group,
  cardWidth,
  onOpenDevice
}: {
  group: DeviceGroup;
  cardWidth: number;
  onOpenDevice: (device: Device) => void;
}) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(group.devices.length > 1);
  const snapInterval = cardWidth + spacing.sm;

  useEffect(() => {
    setCanScrollLeft(false);
    setCanScrollRight(group.devices.length > 1);
  }, [group.devices.length]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    const lastIndex = Math.max(group.devices.length - 1, 0);

    setCanScrollLeft(currentIndex > 0);
    setCanScrollRight(currentIndex < lastIndex);
  }

  return (
    <View style={styles.deviceGroupBlock}>
      <View style={styles.deviceGroupHeader}>
        <View style={[styles.deviceGroupAccent, { backgroundColor: group.color }]} />
        <View style={styles.deviceGroupTitleBlock}>
          <Text style={styles.deviceGroupTitle}>{group.title}</Text>
          <Text style={styles.deviceGroupSubtitle}>{group.devices.length} 台裝置 · 左右滑動查看</Text>
        </View>
      </View>
      <View style={styles.deviceGroupScrollerFrame}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deviceGroupScroller}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToAlignment="start"
          snapToInterval={snapInterval}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
        >
          {group.devices.map((device, index) => (
            <HomiTarget
              key={device.id}
              targetId={`devices.device.${device.id}`}
              style={index < group.devices.length - 1 ? styles.deviceGroupScrollerItem : undefined}
            >
              <GroupedDeviceCard
                device={device}
                width={cardWidth}
                onPress={() => onOpenDevice(device)}
              />
            </HomiTarget>
          ))}
        </ScrollView>
        <ScrollArrowHint leftVisible={canScrollLeft} rightVisible={canScrollRight} />
      </View>
    </View>
  );
}

function GroupedDeviceCard({ device, width, onPress }: { device: Device; width: number; onPress: () => void }) {
  const status = getDeviceStatus(device.latestReading);
  const seriesColor = getSeriesColor(device.seriesKey);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getDeviceTitle(device)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.groupedDeviceCard,
        { width },
        pressed && styles.groupedDeviceCardPressed
      ]}
    >
      <View style={styles.groupedDeviceTopRow}>
        <SeriesBadge label={getSeriesShortLabel(device.seriesKey)} color={seriesColor} />
        <StatusDot color={status.color} />
      </View>
      <Text style={styles.groupedDeviceTitle} numberOfLines={1}>{getDeviceTitle(device)}</Text>
      <Text style={styles.groupedDeviceSubtitle} numberOfLines={2}>
        {getDeviceSubtitle(device)}
      </Text>
      <Text style={styles.groupedDeviceTime}>{formatReadingTime(device.latestReading)}</Text>
      <Text style={styles.groupedDeviceId} numberOfLines={1}>{device.deviceId}</Text>
    </Pressable>
  );
}

function ScrollArrowHint({
  leftVisible,
  rightVisible
}: {
  leftVisible: boolean;
  rightVisible: boolean;
}) {
  if (!leftVisible && !rightVisible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.scrollHintLayer}>
      {leftVisible ? (
        <View style={[styles.scrollHint, styles.scrollHintLeft]}>
          <Ionicons name="chevron-back" size={18} color={colors.surface} />
        </View>
      ) : <View />}
      {rightVisible ? (
        <View style={[styles.scrollHint, styles.scrollHintRight]}>
          <Ionicons name="chevron-forward" size={18} color={colors.surface} />
        </View>
      ) : <View />}
    </View>
  );
}

function SelectionMenu({
  visible,
  type,
  houses,
  selectedHouse,
  selectedHouseId,
  selectedSpaceId,
  backdropOpacity,
  progress,
  onClose,
  onSelectHouse,
  onSelectSpace,
  onOpenHousesSettings
}: {
  visible: boolean;
  type: "house" | "space" | null;
  houses: House[];
  selectedHouse: House | null;
  selectedHouseId: string | null;
  selectedSpaceId: string | null;
  backdropOpacity: Animated.Value;
  progress: Animated.Value;
  onClose: () => void;
  onSelectHouse: (houseId: string | null) => void | Promise<void>;
  onSelectSpace: (spaceId: string | null) => void | Promise<void>;
  onOpenHousesSettings: () => void;
}) {
  const isHouseMenu = type === "house";
  const title = isHouseMenu ? "選擇房屋" : "選擇空間";
  const spaces = selectedHouse?.spaces ?? [];
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 0]
  });

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.selectorRoot}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.selectorBackdrop, { opacity: backdropOpacity }]} />
      </Pressable>
      <Animated.View style={[styles.selectorSheet, { transform: [{ translateY }] }]}>
        <View style={styles.selectorHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.selectorHeaderButton, styles.selectorHeaderButtonLeft]}
          >
            <Text style={styles.selectorAction}>取消</Text>
          </Pressable>
          <Text style={styles.selectorTitle}>{title}</Text>
          <View style={[styles.selectorHeaderButton, styles.selectorHeaderButtonRight]} />
        </View>

        <ScrollView style={styles.selectorList} contentContainerStyle={styles.selectorListContent}>
          {isHouseMenu ? (
            <>
              <PickerOption
                title="未指定房屋"
                icon="remove-circle-outline"
                selected={selectedHouseId === null}
                onPress={() => void onSelectHouse(null)}
              />
              {houses.map((house) => (
                <PickerOption
                  key={house.id}
                  title={house.name}
                  subtitle={`${house.spaces.length} 個空間`}
                  icon="home-outline"
                  selected={selectedHouseId === house.id}
                  onPress={() => void onSelectHouse(house.id)}
                />
              ))}
              {houses.length === 0 ? (
                <PickerOption
                  title="前往房屋設定"
                  subtitle="先新增房屋與空間後，回來即可選擇。"
                  icon="home-outline"
                  selected={false}
                  onPress={onOpenHousesSettings}
                />
              ) : null}
            </>
          ) : (
            <>
              <PickerOption
                title="未指定空間"
                icon="remove-circle-outline"
                selected={selectedSpaceId === null}
                onPress={() => void onSelectSpace(null)}
              />
              {spaces.map((space) => (
                <PickerOption
                  key={space.id}
                  title={space.name}
                  icon="cube-outline"
                  selected={selectedSpaceId === space.id}
                  onPress={() => void onSelectSpace(space.id)}
                />
              ))}
              {selectedHouse && spaces.length === 0 ? (
                <PickerOption
                  title="前往房屋設定"
                  subtitle="為這棟房屋新增空間。"
                  icon="add-circle-outline"
                  selected={false}
                  onPress={onOpenHousesSettings}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function PickerOption({
  title,
  subtitle,
  icon,
  selected,
  onPress
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
    >
      <View style={styles.pickerIconBox}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.pickerTextColumn}>
        <Text style={styles.pickerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pickerSubtitle}>{subtitle}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={21} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: layout.tabScreenBottomPadding
  },
  claimButton: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl
  },
  refreshButton: {
    marginHorizontal: spacing.md
  },
  deviceSection: {
    marginBottom: spacing.xl
  },
  deviceSectionTitle: {
    marginBottom: 6,
    marginHorizontal: spacing.lg,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  deviceSectionFooter: {
    marginTop: spacing.xs,
    marginHorizontal: spacing.lg,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  deviceEmptyCard: {
    marginHorizontal: spacing.md,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.surface
  },
  deviceGroupStack: {
    gap: spacing.lg,
    paddingVertical: spacing.sm
  },
  deviceGroupBlock: {
    gap: spacing.sm
  },
  deviceGroupScrollerFrame: {
    position: "relative"
  },
  deviceGroupHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  deviceGroupAccent: {
    width: 4,
    height: 24,
    borderRadius: 4
  },
  deviceGroupTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  deviceGroupTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  deviceGroupSubtitle: {
    marginTop: 2,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  deviceGroupScroller: {
    paddingLeft: spacing.md,
    paddingRight: spacing.md
  },
  deviceGroupScrollerItem: {
    marginRight: spacing.sm
  },
  scrollHintLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  scrollHint: {
    width: 28,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 72, 118, 0.38)"
  },
  scrollHintLeft: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18
  },
  scrollHintRight: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18
  },
  groupedDeviceCard: {
    minHeight: 150,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  groupedDeviceCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  groupedDeviceTopRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  groupedDeviceTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  groupedDeviceSubtitle: {
    minHeight: 36,
    marginTop: 4,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  groupedDeviceTime: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "600",
    letterSpacing: 0
  },
  groupedDeviceId: {
    marginTop: 4,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    letterSpacing: 0
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.32)"
  },
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  sheetHandle: {
    width: 36,
    height: 5,
    alignSelf: "center",
    borderRadius: 5,
    marginBottom: spacing.sm,
    backgroundColor: colors.separator
  },
  sheetHeader: {
    position: "relative",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  sheetHeaderButton: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 96,
    minHeight: 44,
    justifyContent: "center"
  },
  sheetHeaderButtonLeft: {
    left: spacing.md,
    alignItems: "flex-start"
  },
  sheetHeaderButtonRight: {
    right: spacing.md,
    alignItems: "flex-end"
  },
  sheetTargetProbe: {
    ...StyleSheet.absoluteFill,
    zIndex: -1
  },
  sheetHeaderAction: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "600",
    letterSpacing: 0
  },
  sheetHeaderActionRight: {
    textAlign: "right"
  },
  disabledAction: {
    opacity: 0.45
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  selectorRoot: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    flex: 1,
    justifyContent: "flex-end"
  },
  selectorBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.24)"
  },
  selectorSheet: {
    maxHeight: "58%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  selectorHeader: {
    position: "relative",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  selectorHeaderButton: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 96,
    minHeight: 44,
    justifyContent: "center"
  },
  selectorHeaderButtonLeft: {
    left: spacing.md,
    alignItems: "flex-start"
  },
  selectorHeaderButtonRight: {
    right: spacing.md,
    alignItems: "flex-end"
  },
  selectorAction: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "600",
    letterSpacing: 0
  },
  selectorTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  selectorList: {
    maxHeight: 360
  },
  selectorListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  pickerRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface
  },
  pickerRowPressed: {
    backgroundColor: "rgba(0, 0, 0, 0.05)"
  },
  pickerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  pickerTextColumn: {
    flex: 1,
    minWidth: 0
  },
  pickerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    letterSpacing: 0
  },
  pickerSubtitle: {
    marginTop: 2,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  }
});
