import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useAuth, getErrorMessage } from "../../src/features/auth/AuthContext";
import { dashboardPollingIntervalMs } from "../../src/features/dashboard/dashboard-model";
import { getDeviceGroups, type DeviceGroup } from "../../src/features/devices/device-groups";
import {
  formatReadingValue,
  getDeviceStatus,
  getDeviceSubtitle,
  getDeviceTitle,
  getReadingMetricKeys,
  getRelayState,
  getSeriesColor,
  getSeriesShortLabel,
  metricLabels
} from "../../src/features/devices/device-format";
import { getStoredHomeRelayOrder, saveHomeRelayOrder } from "../../src/services/app-settings-storage";
import { getDevices, setDeviceRelay } from "../../src/services/api-client";
import { Button } from "../../src/shared/components/Button";
import { EmptyState } from "../../src/shared/components/EmptyState";
import { MetricTile } from "../../src/shared/components/MetricTile";
import { Screen } from "../../src/shared/components/Screen";
import { SeriesBadge } from "../../src/shared/components/SeriesBadge";
import { StatusDot } from "../../src/shared/components/StatusDot";
import { colors } from "../../src/theme/colors";
import { layout } from "../../src/theme/layout";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Device } from "../../src/types/api";

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { accessToken, user, deviceGroupMode } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [devicesSyncedForUserId, setDevicesSyncedForUserId] = useState<string | null>(null);
  const [relayLoadingId, setRelayLoadingId] = useState<string | null>(null);
  const [relayExpanded, setRelayExpanded] = useState(false);
  const [relayOrderIds, setRelayOrderIds] = useState<string[]>([]);
  const [relayOrderLoadedForUserId, setRelayOrderLoadedForUserId] = useState<string | null>(null);
  const [sortingRelayId, setSortingRelayId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getDevices(accessToken);
      setDevices(response.devices);
      setDevicesSyncedForUserId(user?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    setDevicesSyncedForUserId(null);
    void loadDevices();
    const interval = setInterval(() => {
      void loadDevices();
    }, dashboardPollingIntervalMs);

    return () => clearInterval(interval);
  }, [loadDevices]);

  useEffect(() => {
    let active = true;
    const userId = user?.id;

    setRelayOrderIds([]);
    setRelayExpanded(false);
    setSortingRelayId(null);
    setRelayOrderLoadedForUserId(null);

    if (!userId) {
      return () => {
        active = false;
      };
    }

    void getStoredHomeRelayOrder(userId).then((storedOrderIds) => {
      if (!active) {
        return;
      }

      setRelayOrderIds(storedOrderIds);
      setRelayOrderLoadedForUserId(userId);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleRelayChange(device: Device, relayOn: boolean) {
    if (!accessToken) {
      return;
    }

    setRelayLoadingId(device.id);
    setError(null);

    try {
      await setDeviceRelay(accessToken, device.id, relayOn);
      await loadDevices();
    } catch (relayError) {
      setError(getErrorMessage(relayError));
    } finally {
      setRelayLoadingId(null);
    }
  }

  const pDevices = useMemo(
    () => devices.filter((device) => device.seriesKey === "p_series"),
    [devices]
  );
  const orderedPDevices = useMemo(() => {
    const orderMap = new Map(relayOrderIds.map((id, index) => [id, index]));

    return [...pDevices].sort((firstDevice, secondDevice) => {
      const firstIndex = orderMap.get(firstDevice.id) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = orderMap.get(secondDevice.id) ?? Number.MAX_SAFE_INTEGER;

      if (firstIndex !== secondIndex) {
        return firstIndex - secondIndex;
      }

      return getDeviceTitle(firstDevice).localeCompare(getDeviceTitle(secondDevice), "zh-Hant");
    });
  }, [pDevices, relayOrderIds]);
  const onlineCount = devices.filter((device) => device.latestReading).length;
  const deviceGroups = getDeviceGroups(devices, deviceGroupMode);
  const carouselCardWidth = width - spacing.md * 2;

  useEffect(() => {
    if (
      !user?.id ||
      relayOrderLoadedForUserId !== user.id ||
      devicesSyncedForUserId !== user.id
    ) {
      return;
    }

    setRelayOrderIds((currentOrderIds) => {
      const currentDeviceIds = new Set(pDevices.map((device) => device.id));
      const nextOrderIds = currentOrderIds.filter((id) => currentDeviceIds.has(id));
      const knownDeviceIds = new Set(nextOrderIds);
      const newDeviceIds = pDevices
        .filter((device) => !knownDeviceIds.has(device.id))
        .map((device) => device.id);

      const nextOrder = [...nextOrderIds, ...newDeviceIds];
      const isSameOrder =
        nextOrder.length === currentOrderIds.length &&
        nextOrder.every((deviceId, index) => deviceId === currentOrderIds[index]);

      return isSameOrder ? currentOrderIds : nextOrder;
    });
  }, [devicesSyncedForUserId, pDevices, relayOrderLoadedForUserId, user?.id]);

  useEffect(() => {
    if (
      !user?.id ||
      relayOrderLoadedForUserId !== user.id ||
      devicesSyncedForUserId !== user.id
    ) {
      return;
    }

    const pDeviceIds = new Set(pDevices.map((device) => device.id));
    const orderMatchesDevices =
      relayOrderIds.length === pDevices.length &&
      relayOrderIds.every((deviceId) => pDeviceIds.has(deviceId));

    if (!orderMatchesDevices) {
      return;
    }

    void saveHomeRelayOrder(user.id, relayOrderIds);
  }, [devicesSyncedForUserId, pDevices, relayOrderIds, relayOrderLoadedForUserId, user?.id]);

  function moveRelayDevice(deviceId: string, direction: "down" | "up") {
    setRelayOrderIds((currentOrderIds) => {
      const currentIndex = currentOrderIds.indexOf(deviceId);

      if (currentIndex < 0) {
        return currentOrderIds;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentOrderIds.length) {
        return currentOrderIds;
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const nextOrderIds = [...currentOrderIds];
      [nextOrderIds[currentIndex], nextOrderIds[targetIndex]] = [
        nextOrderIds[targetIndex],
        nextOrderIds[currentIndex]
      ];

      return nextOrderIds;
    });
  }

  return (
    <Screen
      title="首頁"
      subtitle={`${user?.displayName ?? "使用者"}，即時掌握家中狀態與 P 系列插座。`}
      contentStyle={styles.screenContent}
    >
      <View style={styles.metricRow}>
        <MetricTile label="已綁定裝置" value={String(devices.length)} detail="產品線總覽" />
        <MetricTile
          label="穩定回報中"
          value={String(onlineCount)}
          detail={`每 ${Math.round(dashboardPollingIntervalMs / 1000)} 秒更新`}
        />
      </View>

      {error ? (
        <View style={styles.toast}>
          <StatusDot color={colors.danger} />
          <Text style={styles.toastText}>{error}</Text>
        </View>
      ) : null}

      <SectionHeading title="P 系列智慧插座控制" />
      <View style={styles.cardStack}>
        {pDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="power-outline"
              title="尚未綁定 P 系列"
              body="新增產品編號 P-DEMO-0001 後，就能在這裡控制智慧插座。"
              actionLabel="前往裝置"
              onAction={() => router.push("/(tabs)/devices")}
            />
          </View>
        ) : (
          <RelayPlugList
            devices={orderedPDevices}
            expanded={relayExpanded}
            loadingDeviceId={relayLoadingId}
            sortingDeviceId={sortingRelayId}
            onMoveDevice={moveRelayDevice}
            onRelayChange={handleRelayChange}
            onSetExpanded={setRelayExpanded}
            onSetSortingDeviceId={setSortingRelayId}
          />
        )}
      </View>

      <SectionHeading
        title="即時狀態摘要"
        footer="APP 目前輪詢後端 latest API；不直接連 MQTT broker。"
      />
      <View style={styles.cardStack}>
        {devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="hardware-chip-outline"
              title="還沒有裝置"
              body="到裝置頁輸入產品編號後，首頁會開始顯示即時感測資料。"
              actionLabel="新增裝置"
              onAction={() => router.push("/(tabs)/devices")}
            />
          </View>
        ) : (
          <DeviceGroupCarousel groups={deviceGroups} cardWidth={carouselCardWidth} />
        )}
      </View>

      <Button
        title="重新整理"
        icon="refresh-outline"
        onPress={() => void loadDevices()}
        loading={loading}
        variant="secondary"
        style={styles.refreshButton}
      />
    </Screen>
  );
}

function DeviceGroupCarousel({ groups, cardWidth }: { groups: DeviceGroup[]; cardWidth: number }) {
  return (
    <View style={styles.groupStack}>
      {groups.map((group) => (
        <DeviceGroupCarouselRow key={group.id} group={group} cardWidth={cardWidth} />
      ))}
    </View>
  );
}

function RelayPlugList({
  devices,
  expanded,
  loadingDeviceId,
  sortingDeviceId,
  onMoveDevice,
  onRelayChange,
  onSetExpanded,
  onSetSortingDeviceId
}: {
  devices: Device[];
  expanded: boolean;
  loadingDeviceId: string | null;
  sortingDeviceId: string | null;
  onMoveDevice: (deviceId: string, direction: "down" | "up") => void;
  onRelayChange: (device: Device, relayOn: boolean) => void | Promise<void>;
  onSetExpanded: (expanded: boolean) => void;
  onSetSortingDeviceId: (deviceId: string | null) => void;
}) {
  const visibleDevices = expanded ? devices : devices.slice(0, 3);
  const canToggleExpanded = devices.length > 3;

  function handleToggleExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSetExpanded(!expanded);
  }

  function handleSetSortingDeviceId(deviceId: string | null) {
    if (deviceId && canToggleExpanded && !expanded) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onSetExpanded(true);
    }

    onSetSortingDeviceId(deviceId);
  }

  return (
    <View style={styles.relayList}>
      {visibleDevices.map((device) => (
        <RelayPlugCard
          key={device.id}
          device={device}
          loading={loadingDeviceId === device.id}
          sorting={sortingDeviceId === device.id}
          onMove={onMoveDevice}
          onRelayChange={onRelayChange}
          onSetSorting={handleSetSortingDeviceId}
        />
      ))}

      {canToggleExpanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "收合智慧插座清單" : "展開更多智慧插座"}
          onPress={handleToggleExpanded}
          style={({ pressed }) => [
            styles.relayExpandButton,
            pressed && styles.relayExpandButtonPressed
          ]}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={22}
            color={colors.primary}
          />
          <Text style={styles.relayExpandText}>
            {expanded ? "收合插座" : `查看其餘 ${devices.length - 3} 個插座`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RelayPlugCard({
  device,
  loading,
  sorting,
  onMove,
  onRelayChange,
  onSetSorting
}: {
  device: Device;
  loading: boolean;
  sorting: boolean;
  onMove: (deviceId: string, direction: "down" | "up") => void;
  onRelayChange: (device: Device, relayOn: boolean) => void | Promise<void>;
  onSetSorting: (deviceId: string | null) => void;
}) {
  const lastMoveAtRef = useRef(0);
  const status = getDeviceStatus(device.latestReading);
  const relayOn = getRelayState(device.latestReading);
  const locationLabel = getRelayLocationLabel(device);
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: () => sorting,
      onPanResponderMove: (_event, gestureState) => {
        if (!sorting) {
          return;
        }

        const now = Date.now();

        if (now - lastMoveAtRef.current < 170) {
          return;
        }

        if (gestureState.dy > 34) {
          lastMoveAtRef.current = now;
          onMove(device.id, "down");
          return;
        }

        if (gestureState.dy < -34) {
          lastMoveAtRef.current = now;
          onMove(device.id, "up");
        }
      },
      onPanResponderRelease: () => onSetSorting(null),
      onPanResponderTerminate: () => onSetSorting(null)
    }),
    [device.id, onMove, onSetSorting, sorting]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${getDeviceTitle(device)}，長按後可拖曳排序`}
      delayLongPress={260}
      onLongPress={() => {
        lastMoveAtRef.current = 0;
        onSetSorting(device.id);
      }}
      style={({ pressed }) => [
        styles.relayCard,
        sorting && styles.relayCardSorting,
        pressed && styles.relayCardPressed
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.relayHeader}>
        <View style={styles.relayTitleBlock}>
          <Text style={styles.relayTitle} numberOfLines={1}>
            {getDeviceTitle(device)}
          </Text>
          <View style={styles.relayMeta}>
            <StatusDot color={status.color} label={status.label} />
            <Text style={styles.metaText} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
        <View style={styles.relayActions}>
          {sorting ? (
            <View style={styles.relaySortBadge}>
              <Ionicons name="swap-vertical" size={17} color={colors.primary} />
            </View>
          ) : null}
          <Switch
            accessibilityLabel={`${getDeviceTitle(device)} 開關`}
            value={relayOn}
            onValueChange={(value) => void onRelayChange(device, value)}
            disabled={loading}
            trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.surfaceSecondary}
          />
        </View>
      </View>
    </Pressable>
  );
}

function DeviceGroupCarouselRow({ group, cardWidth }: { group: DeviceGroup; cardWidth: number }) {
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
    <View style={styles.groupBlock}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupAccent, { backgroundColor: group.color }]} />
        <View style={styles.groupTitleBlock}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.groupSubtitle}>{group.subtitle} · {group.devices.length} 台裝置</Text>
        </View>
      </View>
      <View style={styles.groupScrollerFrame}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupScroller}
          decelerationRate="fast"
          disableIntervalMomentum
          snapToAlignment="start"
          snapToInterval={snapInterval}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
        >
          {group.devices.map((device, index) => (
            <View
              key={device.id}
              style={index < group.devices.length - 1 ? styles.groupScrollerItem : undefined}
            >
              <DeviceDataCard
                device={device}
                style={[styles.carouselDeviceCard, { width: cardWidth }]}
              />
            </View>
          ))}
        </ScrollView>
        <ScrollArrowHint leftVisible={canScrollLeft} rightVisible={canScrollRight} />
      </View>
    </View>
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

function SectionHeading({ title, footer }: { title: string; footer?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

function DeviceDataCard({ device, style }: { device: Device; style?: StyleProp<ViewStyle> }) {
  const status = getDeviceStatus(device.latestReading);
  const metricKeys = getReadingMetricKeys(device.latestReading).slice(0, 4);
  const seriesColor = getSeriesColor(device.seriesKey);

  return (
    <View style={[styles.deviceCard, style]}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceTitleBlock}>
          <Text style={styles.deviceTitle}>{getDeviceTitle(device)}</Text>
          <Text style={styles.deviceSubtitle}>{getDeviceSubtitle(device)}</Text>
        </View>
        <View style={styles.deviceBadges}>
          <SeriesBadge label={getSeriesShortLabel(device.seriesKey)} color={seriesColor} />
          <StatusDot color={status.color} label={status.label} />
        </View>
      </View>

      {metricKeys.length === 0 ? (
        <Text style={styles.noReading}>尚無讀值，等待硬體上傳資料。</Text>
      ) : (
        <View style={styles.metricGrid}>
          {metricKeys.map((key) => (
            <View key={key} style={styles.metricCell}>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMetricValue(device, key)}
              </Text>
              <Text style={styles.metricLabel}>{metricLabels[key] ?? key}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatMetricValue(device: Device, key: string) {
  return formatReadingValue(device.latestReading?.values[key] ?? null, key);
}

function getRelayLocationLabel(device: Device) {
  const spaceName = device.spaceName ?? device.roomName;

  if (device.houseName && spaceName) {
    return `${device.houseName} · ${spaceName}`;
  }

  if (device.houseName) {
    return `${device.houseName} · 未指定空間`;
  }

  if (spaceName) {
    return `未指定房屋 · ${spaceName}`;
  }

  return "尚未設定房屋與空間";
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: layout.tabScreenBottomPadding
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl
  },
  toast: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dangerSoft
  },
  toastText: {
    flex: 1,
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  sectionHeading: {
    marginHorizontal: spacing.lg,
    marginBottom: 6
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  sectionFooter: {
    marginTop: 4,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  cardStack: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md
  },
  groupStack: {
    gap: spacing.lg
  },
  groupBlock: {
    gap: spacing.sm
  },
  groupScrollerFrame: {
    position: "relative"
  },
  groupHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs
  },
  groupAccent: {
    width: 4,
    height: 24,
    borderRadius: 4
  },
  groupTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  groupTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  groupSubtitle: {
    marginTop: 2,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  groupScroller: {
    paddingHorizontal: 0
  },
  groupScrollerItem: {
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
  emptyCard: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.surface
  },
  relayList: {
    gap: spacing.sm
  },
  relayCard: {
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  relayCardPressed: {
    opacity: 0.82
  },
  relayCardSorting: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 16
  },
  relayHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  relayActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  relaySortBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  relayTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  relayTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  relayMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 4
  },
  relayExpandButton: {
    minHeight: 44,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primarySoft
  },
  relayExpandButtonPressed: {
    opacity: 0.72
  },
  relayExpandText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  relaySubtitle: {
    marginTop: spacing.sm,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  metaText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote
  },
  deviceCard: {
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  carouselDeviceCard: {
    minHeight: 184
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  deviceTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  deviceTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  deviceSubtitle: {
    marginTop: 3,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  deviceBadges: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  noReading: {
    marginTop: spacing.md,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    lineHeight: 21
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    overflow: "hidden"
  },
  metricCell: {
    width: "50%",
    minHeight: 72,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator
  },
  metricValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.title3,
    fontWeight: "800",
    letterSpacing: 0
  },
  metricLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700"
  },
  refreshButton: {
    marginHorizontal: spacing.md
  }
});
