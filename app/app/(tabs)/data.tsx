import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useAuth, getErrorMessage } from "../../src/features/auth/AuthContext";
import {
  fromDateTimeInputValue,
  getRangeStart,
  toDateTimeInputValue,
  type RangeMode
} from "../../src/features/data/date-range";
import { getDeviceGroups, type DeviceGroup, type DeviceGroupMode } from "../../src/features/devices/device-groups";
import {
  formatReadingTime,
  formatReadingValue,
  getDeviceMetricOptions,
  getMetricUnit,
  getDeviceSubtitle,
  getDeviceTitle,
  metricLabels
} from "../../src/features/devices/device-format";
import {
  HomiTarget,
  useHomiActions,
  type HomiDataQueryCommand
} from "../../src/features/assistant/HomiActionProvider";
import { getDeviceReadings, getDevices } from "../../src/services/api-client";
import { Button } from "../../src/shared/components/Button";
import { EmptyState } from "../../src/shared/components/EmptyState";
import { Screen } from "../../src/shared/components/Screen";
import { Section } from "../../src/shared/components/Section";
import { SegmentedControl } from "../../src/shared/components/SegmentedControl";
import { colors } from "../../src/theme/colors";
import { layout } from "../../src/theme/layout";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Device, Reading, ReadingValue } from "../../src/types/api";

type DisplayMode = "chart" | "table" | "raw";
type PickerTarget = "from" | "to";
type PickerMode = "date" | "time";
type ChartPoint<TValue extends ReadingValue = ReadingValue> = {
  id: string;
  value: TValue;
  time: string;
  timestamp: number | null;
};
type NumericPoint = ChartPoint<number>;

export default function DataScreen() {
  const { accessToken, developerMode, deviceGroupMode } = useAuth();
  const { actionRevision, consumeDataQuery, pendingDataQuery } = useHomiActions();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [metric, setMetric] = useState("");
  const [rangeMode, setRangeMode] = useState<RangeMode>("24h");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("chart");
  const [customFrom, setCustomFrom] = useState(toDateTimeInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [customTo, setCustomTo] = useState(toDateTimeInputValue(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<PickerTarget | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? null;
  const deviceGroups = useMemo(() => getDeviceGroups(devices, deviceGroupMode), [devices, deviceGroupMode]);
  const selectedDeviceGroup = useMemo(
    () => deviceGroups.find((group) => group.devices.some((device) => device.id === selectedDeviceId))
      ?? deviceGroups[0]
      ?? null,
    [deviceGroups, selectedDeviceId]
  );

  const loadDevices = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setError(null);
    const response = await getDevices(accessToken);
    setDevices(response.devices);

    const nextSelectedDevice = response.devices.find((device) => device.id === selectedDeviceId)
      ?? response.devices[0];
    setSelectedDeviceId(nextSelectedDevice?.id ?? "");
  }, [accessToken, selectedDeviceId]);

  useEffect(() => {
    void loadDevices().catch((loadError) => setError(getErrorMessage(loadError)));
  }, [actionRevision, loadDevices]);

  const metricOptions = useMemo(() => {
    return getDeviceMetricOptions(selectedDevice, {
      includeHidden: developerMode,
      limit: developerMode ? 64 : 10
    });
  }, [developerMode, selectedDevice]);

  useEffect(() => {
    if ((!metric || !metricOptions.includes(metric)) && metricOptions[0]) {
      setMetric(metricOptions[0]);
    }
  }, [metric, metricOptions]);

  const queryReadings = useCallback(async (overrides: Partial<HomiDataQueryCommand> = {}) => {
    if (!accessToken) {
      return;
    }

    const targetDeviceId = overrides.deviceId ?? selectedDeviceId;
    const targetDevice = devices.find((device) => device.id === targetDeviceId);
    if (!targetDevice) {
      return;
    }

    setLoading(true);
    setError(null);

    const targetRangeMode = overrides.rangeMode ?? rangeMode;
    const targetCustomFrom = overrides.customFrom ?? customFrom;
    const targetCustomTo = overrides.customTo ?? customTo;
    const targetMetric = overrides.metric ?? metric;
    const from = targetRangeMode === "custom"
      ? fromDateTimeInputValue(targetCustomFrom)
      : getRangeStart(targetRangeMode);
    const to = targetRangeMode === "custom" ? fromDateTimeInputValue(targetCustomTo) : undefined;

    try {
      const response = await getDeviceReadings(accessToken, targetDevice.id, {
        from,
        to,
        metric: targetMetric || undefined,
        limit: 200
      });
      setReadings(response.readings);
    } catch (queryError) {
      setError(getErrorMessage(queryError));
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    customFrom,
    customTo,
    devices,
    metric,
    rangeMode,
    selectedDevice,
    selectedDeviceId
  ]);

  async function handleQuery() {
    await queryReadings();
  }

  useEffect(() => {
    if (!pendingDataQuery || devices.length === 0) {
      return;
    }

    const targetDevice = devices.find((device) => device.id === pendingDataQuery.deviceId);
    if (!targetDevice) {
      consumeDataQuery(pendingDataQuery.commandId);
      return;
    }

    const targetMetricOptions = getDeviceMetricOptions(targetDevice, {
      includeHidden: developerMode,
      limit: developerMode ? 64 : 10
    });
    const nextMetric = targetMetricOptions.includes(pendingDataQuery.metric)
      ? pendingDataQuery.metric
      : targetMetricOptions[0] ?? pendingDataQuery.metric;

    setSelectedDeviceId(pendingDataQuery.deviceId);
    setMetric(nextMetric);
    setRangeMode(pendingDataQuery.rangeMode);
    setDisplayMode(pendingDataQuery.displayMode);

    if (pendingDataQuery.customFrom) {
      setCustomFrom(toDateTimeInputValue(new Date(pendingDataQuery.customFrom)));
    }

    if (pendingDataQuery.customTo) {
      setCustomTo(toDateTimeInputValue(new Date(pendingDataQuery.customTo)));
    }

    if (pendingDataQuery.autoRun) {
      void queryReadings({ ...pendingDataQuery, metric: nextMetric });
    }

    consumeDataQuery(pendingDataQuery.commandId);
  }, [consumeDataQuery, developerMode, devices, pendingDataQuery, queryReadings]);

  function handleSelectDevice(deviceId: string) {
    if (deviceId === selectedDeviceId) {
      return;
    }

    setSelectedDeviceId(deviceId);
    setReadings([]);
  }

  function handleSelectDeviceGroup(groupId: string) {
    const group = deviceGroups.find((item) => item.id === groupId);
    const nextDevice = group?.devices.find((device) => device.id === selectedDeviceId)
      ?? group?.devices[0];

    if (nextDevice) {
      handleSelectDevice(nextDevice.id);
    }
  }

  return (
    <Screen
      title="數據"
      subtitle="依裝置、感測欄位與時間區間查詢長期資料。"
      contentStyle={styles.screenContent}
    >
      <Section title="查詢條件">
        {devices.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="尚無可查詢裝置"
            body="先到裝置頁綁定產品後，這裡會提供歷史資料查詢。"
          />
        ) : (
          <View style={styles.queryPanel}>
            <View style={styles.devicePickerHeader}>
              <Text style={styles.fieldLabel}>裝置</Text>
              <Text style={styles.devicePickerMode}>
                依{deviceGroupMode === "space" ? "空間" : "系列"}顯示
              </Text>
            </View>
            <HomiTarget targetId="data.devicePicker">
              <DeviceGroupPicker
                groups={deviceGroups}
                selectedGroupId={selectedDeviceGroup?.id ?? ""}
                selectedDeviceId={selectedDeviceId}
                mode={deviceGroupMode}
                onSelectGroup={handleSelectDeviceGroup}
                onSelectDevice={handleSelectDevice}
              />
            </HomiTarget>

            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>感測欄位</Text>
              {developerMode ? <Text style={styles.developerBadge}>開發者模式</Text> : null}
            </View>
            <HomiTarget targetId="data.metricPicker">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {metricOptions.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: metric === option }}
                    onPress={() => setMetric(option)}
                    style={[styles.metricChip, metric === option && styles.metricChipSelected]}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        metric === option && styles.metricChipTextSelected
                      ]}
                    >
                      {metricLabels[option] ?? option}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </HomiTarget>

            <HomiTarget targetId="data.timeRange">
              <View style={styles.segmentBlock}>
                <SegmentedControl
                  value={rangeMode}
                  onChange={(value) => setRangeMode(value as RangeMode)}
                  options={[
                    { label: "24 小時", value: "24h" },
                    { label: "7 天", value: "7d" },
                    { label: "自訂", value: "custom" }
                  ]}
                />
              </View>

              {rangeMode === "custom" ? (
                <View style={styles.inlineGroup}>
                  <DateTimeSelectionRow
                    label="開始時間"
                    value={customFrom}
                    onPress={() => setDatePickerTarget("from")}
                  />
                  <View style={styles.inlineSeparator} />
                  <DateTimeSelectionRow
                    label="結束時間"
                    value={customTo}
                    onPress={() => setDatePickerTarget("to")}
                  />
                </View>
              ) : null}
            </HomiTarget>

            <HomiTarget targetId="data.displayMode">
              <View style={styles.segmentBlock}>
                <SegmentedControl
                  value={displayMode}
                  onChange={(value) => setDisplayMode(value as DisplayMode)}
                  options={[
                    { label: "圖表", value: "chart" },
                    { label: "表格", value: "table" },
                    { label: "原始", value: "raw" }
                  ]}
                />
              </View>
            </HomiTarget>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <HomiTarget targetId="data.queryButton">
              <Button title="查詢資料" icon="search-outline" onPress={handleQuery} loading={loading} />
            </HomiTarget>
          </View>
        )}
      </Section>

      <Section title="查詢結果" footer={selectedDevice ? getDeviceSubtitle(selectedDevice) : undefined}>
        {readings.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title="目前沒有資料"
            body="硬體尚未上傳或所選時間區間內沒有符合欄位的資料。"
          />
        ) : (
          renderReadings(displayMode, readings, metric, rangeMode)
        )}
      </Section>

      <DateTimePickerSheet
        target={datePickerTarget}
        value={datePickerTarget === "to" ? customTo : customFrom}
        onCancel={() => setDatePickerTarget(null)}
        onConfirm={(date) => {
          const nextValue = toDateTimeInputValue(date);
          if (datePickerTarget === "to") {
            setCustomTo(nextValue);
          } else {
            setCustomFrom(nextValue);
          }
          setDatePickerTarget(null);
        }}
      />
    </Screen>
  );
}

function DateTimeSelectionRow({
  label,
  value,
  onPress
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}，${formatDateTimeDisplay(value)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateSelectionRow,
        pressed && styles.dateSelectionRowPressed
      ]}
    >
      <View>
        <Text style={styles.dateSelectionLabel}>{label}</Text>
        <Text style={styles.dateSelectionValue}>{formatDateTimeDisplay(value)}</Text>
      </View>
      <View style={styles.dateSelectionIcon}>
        <Ionicons name="calendar-outline" size={19} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function DeviceGroupPicker({
  groups,
  selectedGroupId,
  selectedDeviceId,
  mode,
  onSelectGroup,
  onSelectDevice
}: {
  groups: DeviceGroup[];
  selectedGroupId: string;
  selectedDeviceId: string;
  mode: DeviceGroupMode;
  onSelectGroup: (groupId: string) => void;
  onSelectDevice: (deviceId: string) => void;
}) {
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;

  return (
    <View style={styles.devicePickerStack}>
      <View style={styles.devicePickerRowBlock}>
        <Text style={styles.devicePickerRowLabel}>{mode === "space" ? "選擇空間" : "選擇系列"}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.devicePickerChipScroll}
          contentContainerStyle={styles.devicePickerChipRow}
        >
          {groups.map((group) => (
            <DevicePickerGroupChip
              key={group.id}
              group={group}
              selected={group.id === selectedGroup?.id}
              onPress={() => onSelectGroup(group.id)}
            />
          ))}
        </ScrollView>
      </View>

      {selectedGroup ? (
        <View style={styles.devicePickerRowBlock}>
          <Text style={styles.devicePickerRowLabel}>選擇裝置</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.devicePickerChipScroll}
            contentContainerStyle={styles.devicePickerChipRow}
          >
            {selectedGroup.devices.map((device) => (
              <DevicePickerChip
                key={device.id}
                device={device}
                selected={selectedDeviceId === device.id}
                onPress={() => onSelectDevice(device.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function DevicePickerGroupChip({
  group,
  selected,
  onPress
}: {
  group: DeviceGroup;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${selected ? "已選擇，" : ""}${group.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.devicePickerChip,
        selected && styles.devicePickerChipSelected,
        pressed && styles.devicePickerChipPressed
      ]}
    >
      <View style={[styles.devicePickerGroupDot, { backgroundColor: selected ? colors.surface : group.color }]} />
      <Text
        style={[styles.devicePickerChipText, selected && styles.devicePickerChipTextSelected]}
        numberOfLines={1}
      >
        {group.title}
      </Text>
    </Pressable>
  );
}

function DevicePickerChip({
  device,
  selected,
  onPress
}: {
  device: Device;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${selected ? "已選擇，" : ""}${getDeviceTitle(device)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.devicePickerChip,
        selected && styles.devicePickerChipSelected,
        pressed && styles.devicePickerChipPressed
      ]}
    >
      <Text
        style={[styles.devicePickerChipText, selected && styles.devicePickerChipTextSelected]}
        numberOfLines={1}
      >
        {getDeviceTitle(device)}
      </Text>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.surface} /> : null}
    </Pressable>
  );
}

function DateTimePickerSheet({
  target,
  value,
  onCancel,
  onConfirm
}: {
  target: PickerTarget | null;
  value: string;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeTarget, setActiveTarget] = useState<PickerTarget | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>("date");
  const initialDate = useMemo(() => dateFromPickerValue(value), [value]);
  const [draftDate, setDraftDate] = useState(initialDate);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (target) {
      setMounted(true);
      setActiveTarget(target);
      setDraftDate(initialDate);
      setPickerMode("date");
      backdropOpacity.setValue(0);
      sheetProgress.setValue(0);

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(sheetProgress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]).start();
      });
      return;
    }

    if (mounted) {
      Animated.parallel([
        Animated.timing(sheetProgress, {
          toValue: 0,
          duration: 170,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 110,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(() => {
        setMounted(false);
        setActiveTarget(null);
      });
    }
  }, [target]);

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 0]
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={mounted}
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.pickerModalRoot}>
        <Animated.View style={[styles.pickerBackdrop, { opacity: backdropOpacity }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉日期時間選擇器"
            style={styles.pickerBackdropPressable}
            onPress={onCancel}
          />
        </Animated.View>
        <Animated.View style={[styles.pickerSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.pickerHeaderButton,
                pressed && styles.pickerHeaderButtonPressed
              ]}
            >
              <Text style={styles.pickerCancelText}>取消</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{activeTarget === "to" ? "結束時間" : "開始時間"}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(draftDate)}
              style={({ pressed }) => [
                styles.pickerHeaderButton,
                styles.pickerHeaderButtonRight,
                pressed && styles.pickerHeaderButtonPressed
              ]}
            >
              <Text style={styles.pickerDoneText}>完成</Text>
            </Pressable>
          </View>
          <View style={styles.pickerModeBlock}>
            <SegmentedControl
              value={pickerMode}
              onChange={(mode) => setPickerMode(mode as PickerMode)}
              options={[
                { label: "日期", value: "date" },
                { label: "時間", value: "time" }
              ]}
            />
          </View>
          <View style={styles.pickerPreview}>
            <Text style={styles.pickerPreviewLabel}>已選擇</Text>
            <Text style={styles.pickerPreviewValue}>{formatDateTimeDisplayFromDate(draftDate)}</Text>
          </View>
          <View style={styles.nativeDatePickerFrame}>
            <DateTimePicker
              key={pickerMode}
              value={draftDate}
              mode={pickerMode}
              display={Platform.OS === "ios" ? getIosPickerDisplay(pickerMode) : "default"}
              locale="zh-Hant-TW"
              accentColor={colors.primary}
              themeVariant="light"
              onChange={(_event, selectedDate) => {
                if (selectedDate) {
                  setDraftDate((currentDate) => mergePickerDate(currentDate, selectedDate, pickerMode));
                }
              }}
              style={[
                styles.nativeDatePicker,
                pickerMode === "date" ? styles.nativeCalendarPicker : styles.nativeTimePicker
              ]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function renderReadings(displayMode: DisplayMode, readings: Reading[], metric: string, rangeMode: RangeMode) {
  if (displayMode === "chart") {
    return <ChartResult readings={readings} metric={metric} rangeMode={rangeMode} />;
  }

  if (displayMode === "raw") {
    return (
      <View style={styles.rawBox}>
        <Text style={styles.rawText}>{JSON.stringify(readings.slice(0, 20), null, 2)}</Text>
      </View>
    );
  }

  return (
    <View>
      {readings.map((reading) => (
        <View key={reading.id} style={styles.tableRow}>
          <Text style={styles.tableTime}>{formatReadingTime(reading)}</Text>
          <Text style={styles.tableValue}>{formatReadingValue(reading.values[metric] ?? null, metric)}</Text>
        </View>
      ))}
    </View>
  );
}

function ChartResult({ readings, metric, rangeMode }: { readings: Reading[]; metric: string; rangeMode: RangeMode }) {
  const points = readings
    .slice()
    .reverse()
    .map((reading) => ({
      id: reading.id,
      value: reading.values[metric] ?? null,
      time: formatReadingTime(reading),
      timestamp: getReadingTimestamp(reading)
    }))
    .filter((point) => point.value !== null);

  if (points.length === 0) {
    return (
      <View style={styles.resultPanel}>
        <Text style={styles.resultTitle}>{metricLabels[metric] ?? metric}</Text>
        <Text style={styles.resultBody}>這個欄位目前沒有可視化資料。</Text>
      </View>
    );
  }

  const firstValue = points[0]?.value;
  if (typeof firstValue === "number") {
    return <NumericChart points={points as NumericPoint[]} metric={metric} rangeMode={rangeMode} />;
  }

  if (typeof firstValue === "boolean") {
    return <BooleanTimeline points={points as ChartPoint<boolean>[]} metric={metric} rangeMode={rangeMode} />;
  }

  return <CategoryChart points={points} metric={metric} />;
}

function NumericChart({
  points,
  metric,
  rangeMode
}: {
  points: NumericPoint[];
  metric: string;
  rangeMode: RangeMode;
}) {
  const { width } = useWindowDimensions();
  const numericValues = points.map((point) => point.value);
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const avg = numericValues.reduce((total, value) => total + value, 0) / numericValues.length;
  const range = Math.max(max - min, 0.0001);
  const mid = min + range / 2;
  const displayPoints = points.slice(-28);
  const chartWidth = Math.max(Math.min(width - 146, 320), 214);
  const chartHeight = 148;
  const yAxisUnit = getMetricUnit(metric) ?? "數值";
  const xAxisLabels = getAdaptiveTimeLabels(displayPoints, rangeMode);
  const rangeLabel = formatPointRange(points, rangeMode);
  const plottedPoints = displayPoints.map((point, index) => {
    const x = displayPoints.length <= 1 ? chartWidth / 2 : (index / (displayPoints.length - 1)) * chartWidth;
    const y = chartHeight - ((point.value - min) / range) * chartHeight;
    return { ...point, x, y };
  });
  const segments = plottedPoints.slice(1).map((point, index) => {
    const previous = plottedPoints[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    return {
      id: `${previous.id}-${point.id}`,
      length,
      angle,
      left: previous.x + dx / 2 - length / 2,
      top: previous.y + dy / 2
    };
  });

  return (
    <View style={styles.chartPanel}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.resultTitle}>{metricLabels[metric] ?? metric}</Text>
          <Text style={styles.resultBody}>{rangeLabel}</Text>
        </View>
        <Text style={styles.chartValue}>{formatSummaryNumber(points[points.length - 1].value, metric)}</Text>
      </View>

      <View style={styles.lineChartOuter}>
        <View style={styles.axisMetaRow}>
          <Text style={styles.axisMetaText}>Y 軸：{metricLabels[metric] ?? metric} ({yAxisUnit})</Text>
          <Text style={styles.axisMetaText}>X 軸：時間</Text>
        </View>
        <View style={styles.lineChartRow}>
          <View style={[styles.yAxisLabels, { height: chartHeight }]}>
            <Text style={styles.axisText}>{formatSummaryNumber(max, metric)}</Text>
            <Text style={styles.axisText}>{formatSummaryNumber(mid, metric)}</Text>
            <Text style={styles.axisText}>{formatSummaryNumber(min, metric)}</Text>
          </View>
          <View>
            <View style={[styles.lineChart, { width: chartWidth, height: chartHeight }]}>
              <View style={[styles.lineGrid, { top: 0 }]} />
              <View style={[styles.lineGrid, { top: chartHeight / 2 }]} />
              <View style={[styles.lineGrid, { top: chartHeight }]} />
              {segments.map((segment) => (
                <View
                  key={segment.id}
                  style={[
                    styles.lineSegment,
                    {
                      width: segment.length,
                      left: segment.left,
                      top: segment.top,
                      transform: [{ rotateZ: `${segment.angle}rad` }]
                    }
                  ]}
                />
              ))}
              {plottedPoints.map((point) => (
                <View key={point.id} style={[styles.linePoint, { left: point.x - 4, top: point.y - 4 }]} />
              ))}
            </View>
            <View style={[styles.xAxisLabels, { width: chartWidth }]}>
              {xAxisLabels.map((label) => (
                <Text key={label.key} style={styles.axisText} numberOfLines={1}>{label.text}</Text>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.chartAxis}>
        <Text style={styles.axisText}>最低 {formatSummaryNumber(min, metric)}</Text>
        <Text style={styles.axisText}>最高 {formatSummaryNumber(max, metric)}</Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryMetric label="資料筆數" value={String(points.length)} />
        <SummaryMetric label="平均值" value={formatSummaryNumber(avg, metric)} />
        <SummaryMetric label="最小值" value={formatSummaryNumber(min, metric)} />
        <SummaryMetric label="最大值" value={formatSummaryNumber(max, metric)} />
      </View>
    </View>
  );
}

function BooleanTimeline({
  points,
  metric,
  rangeMode
}: {
  points: ChartPoint<boolean>[];
  metric: string;
  rangeMode: RangeMode;
}) {
  const activeCount = points.filter((point) => point.value).length;
  const activeRatio = activeCount / points.length;
  const displayPoints = points.slice(-48);
  const xAxisLabels = getAdaptiveTimeLabels(displayPoints, rangeMode);

  return (
    <View style={styles.chartPanel}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.resultTitle}>{metricLabels[metric] ?? metric}</Text>
          <Text style={styles.resultBody}>狀態時間軸</Text>
        </View>
        <Text style={styles.chartValue}>{Math.round(activeRatio * 100)}%</Text>
      </View>

      <View style={styles.axisMetaRowPadded}>
        <Text style={styles.axisMetaText}>Y 軸：狀態</Text>
        <Text style={styles.axisMetaText}>X 軸：時間</Text>
      </View>

      <View style={styles.timeline}>
        {displayPoints.map((point) => (
          <View
            key={point.id}
            style={[
              styles.timelineSegment,
              point.value ? styles.timelineActive : styles.timelineInactive
            ]}
          />
        ))}
      </View>

      <View style={styles.timelineAxis}>
        {xAxisLabels.map((label) => (
          <Text key={label.key} style={styles.axisText} numberOfLines={1}>{label.text}</Text>
        ))}
      </View>

      <View style={styles.legendRow}>
        <LegendDot color={colors.primary} label={formatReadingValue(true, metric)} />
        <LegendDot color={colors.surfaceSecondary} label={formatReadingValue(false, metric)} />
      </View>

      <View style={styles.summaryGrid}>
        <SummaryMetric label="資料筆數" value={String(points.length)} />
        <SummaryMetric label="觸發比例" value={`${Math.round(activeRatio * 100)}%`} />
        <SummaryMetric label="觸發次數" value={String(activeCount)} />
        <SummaryMetric label="目前狀態" value={formatReadingValue(points[points.length - 1].value, metric)} />
      </View>
    </View>
  );
}

function CategoryChart({
  points,
  metric
}: {
  points: Array<{ id: string; value: ReadingValue; time: string }>;
  metric: string;
}) {
  const counts = new Map<string, number>();
  for (const point of points) {
    const label = formatReadingValue(point.value, metric);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const rows = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <View style={styles.chartPanel}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.resultTitle}>{metricLabels[metric] ?? metric}</Text>
          <Text style={styles.resultBody}>類別分布</Text>
        </View>
        <Text style={styles.chartValue}>{points.length}</Text>
      </View>

      <View style={styles.axisMetaRowPadded}>
        <Text style={styles.axisMetaText}>Y 軸：類別</Text>
        <Text style={styles.axisMetaText}>X 軸：次數 (筆)</Text>
      </View>

      <View style={styles.categoryList}>
        {rows.map((row) => (
          <View key={row.label} style={styles.categoryRow}>
            <View style={styles.categoryRowHeader}>
              <Text style={styles.categoryLabel}>{row.label}</Text>
              <Text style={styles.categoryCount}>{row.count}</Text>
            </View>
            <View style={styles.categoryTrack}>
              <View style={[styles.categoryFill, { width: `${(row.count / max) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function getReadingTimestamp(reading: Reading) {
  const timestamp = new Date(reading.received_at).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getAdaptiveTimeLabels(points: Array<Pick<ChartPoint, "id" | "time" | "timestamp">>, rangeMode: RangeMode) {
  if (points.length === 0) {
    return [];
  }

  const timestamps = points
    .map((point) => point.timestamp)
    .filter((timestamp): timestamp is number => typeof timestamp === "number" && Number.isFinite(timestamp));

  if (timestamps.length === 0) {
    return [
      { key: `${points[0].id}-start`, text: points[0].time },
      ...(points.length > 1 ? [{ key: `${points[points.length - 1].id}-end`, text: points[points.length - 1].time }] : [])
    ];
  }

  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps[timestamps.length - 1];
  const spanMs = Math.max(lastTimestamp - firstTimestamp, 0);
  const tickCount = getTimeTickCount(points.length, rangeMode, spanMs);

  if (tickCount <= 1) {
    return [{
      key: points[0].id,
      text: formatAxisTimestamp(points[0].timestamp ?? firstTimestamp, rangeMode, spanMs)
    }];
  }

  const labels: Array<{ key: string; text: string }> = [];
  const usedIndices = new Set<number>();

  for (let tickIndex = 0; tickIndex < tickCount; tickIndex += 1) {
    const pointIndex = Math.round((tickIndex / (tickCount - 1)) * (points.length - 1));
    if (usedIndices.has(pointIndex)) {
      continue;
    }

    const point = points[pointIndex];
    usedIndices.add(pointIndex);
    labels.push({
      key: `${point.id}-${tickIndex}`,
      text: formatAxisTimestamp(point.timestamp ?? firstTimestamp, rangeMode, spanMs)
    });
  }

  return labels;
}

function getTimeTickCount(pointCount: number, rangeMode: RangeMode, spanMs: number) {
  if (pointCount <= 2) {
    return pointCount;
  }

  const dayMs = 24 * 60 * 60 * 1000;

  if (rangeMode === "24h") {
    return Math.min(pointCount, 4);
  }

  if (rangeMode === "7d") {
    return Math.min(pointCount, 4);
  }

  if (spanMs <= dayMs) {
    return Math.min(pointCount, 4);
  }

  if (spanMs <= 8 * dayMs) {
    return Math.min(pointCount, 3);
  }

  return Math.min(pointCount, 4);
}

function formatPointRange(points: Array<Pick<ChartPoint, "time" | "timestamp">>, rangeMode: RangeMode) {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) {
    return "";
  }

  if (firstPoint.timestamp === null || lastPoint.timestamp === null) {
    return `${firstPoint.time} - ${lastPoint.time}`;
  }

  const spanMs = Math.max(lastPoint.timestamp - firstPoint.timestamp, 0);
  return `${formatAxisTimestamp(firstPoint.timestamp, rangeMode, spanMs)} - ${formatAxisTimestamp(lastPoint.timestamp, rangeMode, spanMs)}`;
}

function formatAxisTimestamp(timestamp: number, rangeMode: RangeMode, spanMs: number) {
  const date = new Date(timestamp);
  const dayMs = 24 * 60 * 60 * 1000;

  if (rangeMode === "24h" || spanMs <= dayMs) {
    return formatHourMinute(date);
  }

  if (rangeMode === "7d") {
    return formatMonthDay(date);
  }

  if (spanMs <= 8 * dayMs) {
    return `${formatMonthDay(date)} ${formatHourMinute(date)}`;
  }

  if (spanMs <= 365 * dayMs) {
    return formatMonthDay(date);
  }

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatHourMinute(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function dateFromPickerValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateTimeDisplay(value: string) {
  const date = dateFromPickerValue(value);
  return formatDateTimeDisplayFromDate(date);
}

function formatDateTimeDisplayFromDate(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function mergePickerDate(currentDate: Date, selectedDate: Date, pickerMode: PickerMode) {
  const nextDate = new Date(currentDate);

  if (pickerMode === "date") {
    nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    return nextDate;
  }

  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}

function getIosPickerDisplay(pickerMode: PickerMode) {
  return pickerMode === "date" ? "inline" : "spinner";
}

function formatSummaryNumber(value: number, metric: string) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const unit = getMetricUnit(metric);
  return unit ? `${formatted} ${unit}` : formatted;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricValue}>{value}</Text>
      <Text style={styles.summaryMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: layout.tabScreenBottomPadding
  },
  queryPanel: {
    gap: spacing.md,
    padding: spacing.md
  },
  fieldLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  fieldHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  devicePickerHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  devicePickerMode: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700"
  },
  devicePickerStack: {
    gap: spacing.md
  },
  devicePickerRowBlock: {
    gap: 0
  },
  devicePickerRowLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 16
  },
  devicePickerChipScroll: {
    marginTop: spacing.sm
  },
  devicePickerChipRow: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
    paddingBottom: 1
  },
  devicePickerChip: {
    minHeight: 38,
    maxWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background
  },
  devicePickerGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  devicePickerChipSelected: {
    backgroundColor: colors.primary
  },
  devicePickerChipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  devicePickerChipText: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "800",
    letterSpacing: 0
  },
  devicePickerChipTextSelected: {
    color: colors.surface
  },
  developerBadge: {
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "800",
    backgroundColor: colors.primarySoft
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.md
  },
  deviceChip: {
    minHeight: 46,
    maxWidth: 210,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface
  },
  deviceChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  deviceChipText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    fontWeight: "600"
  },
  deviceChipTextSelected: {
    color: colors.primary
  },
  metricChip: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSecondary
  },
  metricChipSelected: {
    backgroundColor: colors.primary
  },
  metricChipText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700"
  },
  metricChipTextSelected: {
    color: colors.surface
  },
  segmentBlock: {
    paddingVertical: spacing.xs
  },
  inlineGroup: {
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.surface
  },
  inlineSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md,
    backgroundColor: colors.separator
  },
  dateSelectionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  dateSelectionRowPressed: {
    backgroundColor: colors.surfaceSecondary
  },
  dateSelectionLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  dateSelectionValue: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "600",
    letterSpacing: 0
  },
  dateSelectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.primarySoft
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  pickerBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.28)"
  },
  pickerBackdropPressable: {
    flex: 1
  },
  pickerSheet: {
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.xs,
    paddingBottom: Platform.select({ ios: 34, default: spacing.lg }),
    backgroundColor: colors.background,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12
  },
  pickerHandle: {
    alignSelf: "center",
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.separator
  },
  pickerHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator
  },
  pickerModeBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  pickerPreview: {
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  pickerPreviewLabel: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  pickerPreviewValue: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.title3,
    fontWeight: "800",
    letterSpacing: 0
  },
  pickerHeaderButton: {
    minWidth: 72,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  pickerHeaderButtonRight: {
    alignItems: "flex-end"
  },
  pickerHeaderButtonPressed: {
    opacity: 0.58
  },
  pickerCancelText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "500"
  },
  pickerDoneText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "800"
  },
  pickerTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700",
    letterSpacing: 0
  },
  nativeDatePicker: {
    alignSelf: "center",
    width: "100%"
  },
  nativeCalendarPicker: {
    height: Platform.select({ ios: 336, default: 132 })
  },
  nativeTimePicker: {
    width: 320,
    height: Platform.select({ ios: 216, default: 132 })
  },
  nativeDatePickerFrame: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  resultPanel: {
    padding: spacing.md,
    gap: spacing.xs
  },
  resultTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700"
  },
  resultBody: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    lineHeight: 23
  },
  chartPanel: {
    backgroundColor: colors.surface
  },
  chartHeader: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator
  },
  chartValue: {
    maxWidth: 150,
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.title2,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right"
  },
  lineChartOuter: {
    alignItems: "stretch",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm
  },
  axisMetaRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  axisMetaRowPadded: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  axisMetaText: {
    flexShrink: 1,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0
  },
  lineChartRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm
  },
  yAxisLabels: {
    width: 72,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 0
  },
  lineChart: {
    position: "relative"
  },
  lineGrid: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator
  },
  lineSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary
  },
  xAxisLabels: {
    minHeight: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  chartAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  axisText: {
    flexShrink: 1,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "600"
  },
  timeline: {
    height: 72,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  timelineAxis: {
    minHeight: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  timelineSegment: {
    flex: 1,
    minWidth: 3,
    borderRadius: 4
  },
  timelineActive: {
    backgroundColor: colors.primary
  },
  timelineInactive: {
    backgroundColor: colors.surfaceSecondary
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  legendItem: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendLabel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "600"
  },
  categoryList: {
    gap: spacing.md,
    padding: spacing.md
  },
  categoryRow: {
    gap: spacing.xs
  },
  categoryRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  categoryLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    fontWeight: "700"
  },
  categoryCount: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700"
  },
  categoryTrack: {
    height: 9,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: colors.surfaceSecondary
  },
  categoryFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  summaryMetric: {
    width: "50%",
    minHeight: 92,
    justifyContent: "center",
    padding: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator
  },
  summaryMetricValue: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.title1,
    fontWeight: "800",
    letterSpacing: 0
  },
  summaryMetricLabel: {
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700"
  },
  rawBox: {
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  rawText: {
    color: colors.text,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: typography.caption,
    lineHeight: 18
  },
  tableRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator
  },
  tableTime: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead
  },
  tableValue: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "700"
  }
});
