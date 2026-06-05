import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
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
  formatReadingTime,
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
import { getDevices, setDeviceRelay } from "../../src/services/api-client";
import { Button } from "../../src/shared/components/Button";
import { EmptyState } from "../../src/shared/components/EmptyState";
import { MetricTile } from "../../src/shared/components/MetricTile";
import { Screen } from "../../src/shared/components/Screen";
import { SeriesBadge } from "../../src/shared/components/SeriesBadge";
import { StatusDot } from "../../src/shared/components/StatusDot";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Device } from "../../src/types/api";

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { accessToken, user, deviceGroupMode } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [relayLoadingId, setRelayLoadingId] = useState<string | null>(null);
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
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadDevices();
    const interval = setInterval(() => {
      void loadDevices();
    }, dashboardPollingIntervalMs);

    return () => clearInterval(interval);
  }, [loadDevices]);

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

  const pDevices = devices.filter((device) => device.seriesKey === "p_series");
  const onlineCount = devices.filter((device) => device.latestReading).length;
  const deviceGroups = getDeviceGroups(devices, deviceGroupMode);
  const carouselCardWidth = width - spacing.md * 2;

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
          pDevices.map((device) => {
            const status = getDeviceStatus(device.latestReading);
            const relayOn = getRelayState(device.latestReading);
            return (
              <View key={device.id} style={styles.relayCard}>
                <View style={styles.relayHeader}>
                  <View style={styles.relayTitleBlock}>
                    <Text style={styles.relayTitle}>{getDeviceTitle(device)}</Text>
                    <View style={styles.relayMeta}>
                      <StatusDot color={status.color} label={status.label} />
                      <Text style={styles.metaText}>{formatReadingTime(device.latestReading)}</Text>
                    </View>
                  </View>
                  <Switch
                    accessibilityLabel={`${getDeviceTitle(device)} 開關`}
                    value={relayOn}
                    onValueChange={(value) => void handleRelayChange(device, value)}
                    disabled={relayLoadingId === device.id}
                    trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                    thumbColor={colors.surface}
                    ios_backgroundColor={colors.surfaceSecondary}
                  />
                </View>
                <Text style={styles.relaySubtitle}>{getDeviceSubtitle(device)}</Text>
              </View>
            );
          })
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
          {group.devices.map((device) => (
            <DeviceDataCard
              key={device.id}
              device={device}
              style={[styles.carouselDeviceCard, { width: cardWidth }]}
            />
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

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl
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
    gap: spacing.sm,
    paddingRight: spacing.md
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
  relayCard: {
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  relayHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
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
