import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  claimDevice,
  createHouse,
  createHouseSpace,
  getErrorMessage,
  postHomiActionResult,
  setDeviceRelay,
  updateDevice,
  updateHouse,
  updateHouseSpace
} from "../../services/api-client";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import type { HomiAction, HomiDisplayMode, HomiRangeMode } from "../../types/api";
import { useAuth } from "../auth/AuthContext";

type TargetLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TargetRegistration = {
  layout?: TargetLayout;
  measure?: () => Promise<TargetLayout | null>;
};

type TargetPreparer = () => Promise<void> | void;

export type HomiDataQueryCommand = {
  commandId: string;
  deviceId: string;
  metric: string;
  rangeMode: HomiRangeMode;
  customFrom?: string;
  customTo?: string;
  displayMode: HomiDisplayMode;
  autoRun: boolean;
};

export type HomiHomeRelayFocusCommand = {
  commandId: string;
  deviceId: string;
  expandRelayList: boolean;
};

export type HomiDeviceSettingsCommand = {
  commandId: string;
  deviceId: string;
};

type HomiToast = {
  id: number;
  message: string;
  tone: "info" | "success" | "warning" | "error";
};

type HomiActionContextValue = {
  actionRevision: number;
  pendingDataQuery: HomiDataQueryCommand | null;
  pendingDeviceSettings: HomiDeviceSettingsCommand | null;
  pendingHomeRelayFocus: HomiHomeRelayFocusCommand | null;
  consumeDataQuery: (commandId: string) => void;
  consumeDeviceSettings: (commandId: string) => void;
  consumeHomeRelayFocus: (commandId: string) => void;
  registerTarget: (
    targetId: string,
    layout: TargetLayout,
    measure?: () => Promise<TargetLayout | null>
  ) => void;
  registerTargetPreparer: (targetId: string, prepare: TargetPreparer) => () => void;
  runActions: (actions: HomiAction[], threadId?: string) => Promise<void>;
  unregisterTarget: (targetId: string) => void;
};

const HomiActionContext = createContext<HomiActionContextValue | null>(null);
const homiCursorPreviewMode = false;
const homiCursorSize = 32;
const homiCursorHotspotX = 0;
const homiCursorHotspotY = 0;
const homiCursorPando = require("../../../assets/homi-cursor-pando.png");

export function HomiActionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken, setDeveloperMode, setDeviceGroupMode } = useAuth();
  const { height, width } = useWindowDimensions();
  const targetsRef = useRef(new Map<string, TargetRegistration>());
  const targetPreparersRef = useRef(new Map<string, Set<TargetPreparer>>());
  const cursorX = useRef(new Animated.Value(width / 2 - homiCursorHotspotX)).current;
  const cursorY = useRef(new Animated.Value(height / 2 - homiCursorHotspotY)).current;
  const cursorOpacity = useRef(new Animated.Value(homiCursorPreviewMode ? 1 : 0)).current;
  const cursorScale = useRef(new Animated.Value(homiCursorPreviewMode ? 1 : 0.01)).current;
  const [pendingDataQuery, setPendingDataQuery] = useState<HomiDataQueryCommand | null>(null);
  const [pendingDeviceSettings, setPendingDeviceSettings] = useState<HomiDeviceSettingsCommand | null>(null);
  const [pendingHomeRelayFocus, setPendingHomeRelayFocus] = useState<HomiHomeRelayFocusCommand | null>(null);
  const [actionRevision, setActionRevision] = useState(0);
  const [toast, setToast] = useState<HomiToast | null>(null);
  const toastCounterRef = useRef(0);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (homiCursorPreviewMode) {
      cursorX.setValue(width / 2 - homiCursorHotspotX);
      cursorY.setValue(height / 2 - homiCursorHotspotY);
      cursorOpacity.setValue(1);
      cursorScale.setValue(1);
      return;
    }

    cursorOpacity.setValue(0);
    cursorScale.setValue(0.01);
  }, [cursorOpacity, cursorScale, cursorX, cursorY, height, width]);

  const registerTarget = useCallback((
    targetId: string,
    layout: TargetLayout,
    measure?: () => Promise<TargetLayout | null>
  ) => {
    if (layout.width <= 0 || layout.height <= 0) {
      return;
    }

    const current = targetsRef.current.get(targetId) ?? {};
    targetsRef.current.set(targetId, { ...current, layout, measure: measure ?? current.measure });
  }, []);

  const unregisterTarget = useCallback((targetId: string) => {
    targetsRef.current.delete(targetId);
  }, []);

  const registerTargetPreparer = useCallback((targetId: string, prepare: TargetPreparer) => {
    const preparers = targetPreparersRef.current.get(targetId) ?? new Set<TargetPreparer>();
    preparers.add(prepare);
    targetPreparersRef.current.set(targetId, preparers);

    return () => {
      const currentPreparers = targetPreparersRef.current.get(targetId);
      currentPreparers?.delete(prepare);

      if (currentPreparers?.size === 0) {
        targetPreparersRef.current.delete(targetId);
      }
    };
  }, []);

  const showToast = useCallback((message: string, tone: HomiToast["tone"] = "info") => {
    toastCounterRef.current += 1;
    setToast({ id: toastCounterRef.current, message, tone });
  }, []);

  const markDataChanged = useCallback(() => {
    setActionRevision((current) => current + 1);
  }, []);

  const reportActionResult = useCallback(
    async (
      action: HomiAction,
      threadId: string | undefined,
      status: "succeeded" | "failed" | "canceled",
      result?: unknown,
      error?: string
    ) => {
      if (!accessToken) {
        return;
      }

      try {
        await postHomiActionResult(accessToken, {
          threadId,
          actionId: action.id,
          status,
          result,
          error
        });
      } catch {
        // Action result logging should never break the user's interaction.
      }
    },
    [accessToken]
  );

  const prepareAndMeasureTarget = useCallback(async (targetId: string) => {
    const preparers = Array.from(targetPreparersRef.current.get(targetId) ?? []);

    for (const prepare of preparers) {
      await prepare();
    }

    if (preparers.length > 0) {
      await wait(120);
    }

    const registration = targetsRef.current.get(targetId);
    const measuredLayout = await registration?.measure?.();
    return measuredLayout ?? registration?.layout ?? null;
  }, []);

  const playCursorHints = useCallback(
    async (hints: HomiAction["cursorHints"]) => {
      if (homiCursorPreviewMode) {
        cursorX.setValue(width / 2 - homiCursorHotspotX);
        cursorY.setValue(height / 2 - homiCursorHotspotY);
        cursorOpacity.setValue(1);
        cursorScale.setValue(1);
        return;
      }

      if (hints.length === 0) {
        return;
      }

      cursorScale.setValue(1);
      await animateValue(cursorOpacity, 1, 120, Easing.out(Easing.quad));

      for (const hint of hints) {
        const target = await prepareAndMeasureTarget(hint.target);
        await moveCursorToTarget({
          cursorX,
          cursorY,
          height,
          target: target ?? undefined,
          width
        });

        if (hint.gesture === "tap" || hint.gesture === "press" || hint.gesture === "confirm") {
          await pulseCursor(cursorScale, hint.gesture === "press" ? 1.34 : 1.22);
        }
      }
    },
    [cursorOpacity, cursorScale, cursorX, cursorY, height, prepareAndMeasureTarget, width]
  );

  const hideCursor = useCallback(async () => {
    if (homiCursorPreviewMode) {
      cursorX.setValue(width / 2 - homiCursorHotspotX);
      cursorY.setValue(height / 2 - homiCursorHotspotY);
      cursorOpacity.setValue(1);
      cursorScale.setValue(1);
      return;
    }

    await animateValue(cursorOpacity, 0, 180, Easing.out(Easing.quad));
    cursorScale.setValue(0.01);
  }, [cursorOpacity, cursorScale, cursorX, cursorY, height, width]);

  const executeAction = useCallback(
    async (action: HomiAction, threadId?: string, previousAction?: HomiAction) => {
      try {
        switch (action.type) {
          case "say":
            await reportActionResult(action, threadId, "succeeded");
            return;
          case "ask_clarification":
            await playCursorHints(action.cursorHints);
            showToast(action.question, "info");
            await reportActionResult(action, threadId, "succeeded", { shown: true });
            return;
          case "navigate":
            await playCursorHints(action.cursorHints);
            router.push(routePathForAction(action.route));
            await wait(360);
            await reportActionResult(action, threadId, "succeeded", { route: action.route });
            return;
          case "set_data_query":
            if (!isNavigateToRoute(previousAction, "data")) {
              await playCursorHints([{ target: "tab.data", gesture: "tap" }]);
            }
            router.push("/(tabs)/data");
            setPendingDataQuery({
              commandId: action.id,
              deviceId: action.deviceId,
              metric: action.metric,
              rangeMode: action.rangeMode,
              customFrom: action.customFrom,
              customTo: action.customTo,
              displayMode: action.displayMode,
              autoRun: action.autoRun
            });
            await wait(420);
            await playCursorHints(withoutTabHints(action.cursorHints));
            await reportActionResult(action, threadId, "succeeded", {
              deviceId: action.deviceId,
              metric: action.metric
            });
            return;
          case "focus_home_relay":
            if (!isNavigateToRoute(previousAction, "home")) {
              await playCursorHints([{ target: "tab.home", gesture: "tap" }]);
            }
            router.push("/(tabs)");
            setPendingHomeRelayFocus({
              commandId: action.id,
              deviceId: action.deviceId,
              expandRelayList: action.expandRelayList
            });
            await wait(420);
            await playCursorHints(focusRelayCursorHints(action));
            await reportActionResult(action, threadId, "succeeded", { deviceId: action.deviceId });
            return;
          case "focus_home_device":
            if (!isNavigateToRoute(previousAction, "home")) {
              await playCursorHints([{ target: "tab.home", gesture: "tap" }]);
            }
            router.push("/(tabs)");
            await wait(420);
            await playCursorHints(focusHomeDeviceCursorHints(action));
            await reportActionResult(action, threadId, "succeeded", { deviceId: action.deviceId });
            return;
          case "request_relay_confirmation":
            await playCursorHints([{ target: `home.relay.${action.deviceId}`, gesture: "tap" }]);
            if (!accessToken) {
              showToast("請先登入後再控制插座", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }

            await setDeviceRelay(accessToken, action.deviceId, action.relayOn);
            markDataChanged();
            showToast(
              `${action.deviceName} 已送出${action.relayOn ? "開啟" : "關閉"}指令`,
              "success"
            );
            await reportActionResult(action, threadId, "succeeded", {
              relayOn: action.relayOn,
              direct: true
            });
            return;
          case "set_preference":
            await playCursorHints(action.cursorHints);
            if (typeof action.developerMode === "boolean") {
              await setDeveloperMode(action.developerMode);
            }
            if (action.deviceGroupMode) {
              await setDeviceGroupMode(action.deviceGroupMode);
            }
            showToast("偏好設定已更新", "success");
            await reportActionResult(action, threadId, "succeeded", {
              developerMode: action.developerMode,
              deviceGroupMode: action.deviceGroupMode
            });
            return;
          case "open_device_settings":
            if (!isNavigateToRoute(previousAction, "devices")) {
              await playCursorHints([{ target: "tab.devices", gesture: "tap" }]);
            }
            router.push("/(tabs)/devices");
            await wait(420);
            await playCursorHints(withoutTabHints(action.cursorHints));
            setPendingDeviceSettings({
              commandId: action.id,
              deviceId: action.deviceId
            });
            await reportActionResult(action, threadId, "succeeded", { deviceId: action.deviceId });
            return;
          case "set_device_profile":
            await playCursorHints(action.cursorHints);
            if (!accessToken) {
              showToast("請先登入後再修改裝置設定", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            await updateDevice(accessToken, action.deviceId, {
              alias: action.alias,
              houseId: action.houseId,
              spaceId: action.spaceId
            });
            markDataChanged();
            showToast("裝置設定已更新", "success");
            await reportActionResult(action, threadId, "succeeded", {
              deviceId: action.deviceId,
              alias: action.alias,
              houseId: action.houseId,
              spaceId: action.spaceId
            });
            return;
          case "claim_device":
            if (!isNavigateToRoute(previousAction, "devices")) {
              await playCursorHints([{ target: "tab.devices", gesture: "tap" }]);
            }
            router.push("/(tabs)/devices");
            await wait(260);
            await playCursorHints(withoutTabHints(action.cursorHints));
            if (!accessToken) {
              showToast("請先登入後再綁定裝置", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            await claimDevice(accessToken, action.productCode);
            markDataChanged();
            showToast(`已綁定 ${action.productCode}`, "success");
            await reportActionResult(action, threadId, "succeeded", { productCode: action.productCode });
            return;
          case "open_house_detail":
            router.push({ pathname: "/houses/[houseId]", params: { houseId: action.houseId } });
            await wait(420);
            await playCursorHints(action.cursorHints);
            await reportActionResult(action, threadId, "succeeded", { houseId: action.houseId });
            return;
          case "create_house":
            router.push("/houses");
            await wait(360);
            await playCursorHints(action.cursorHints);
            if (!accessToken) {
              showToast("請先登入後再新增房屋", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            {
              const response = await createHouse(accessToken, action.name);
              markDataChanged();
              showToast(`已新增房屋「${response.house.name}」`, "success");
              await reportActionResult(action, threadId, "succeeded", { houseId: response.house.id });
            }
            return;
          case "create_space":
            router.push({ pathname: "/houses/[houseId]", params: { houseId: action.houseId } });
            await wait(420);
            await playCursorHints(action.cursorHints);
            if (!accessToken) {
              showToast("請先登入後再新增空間", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            {
              const response = await createHouseSpace(accessToken, action.houseId, action.name);
              markDataChanged();
              showToast(`已新增空間「${response.space.name}」`, "success");
              await reportActionResult(action, threadId, "succeeded", { spaceId: response.space.id });
            }
            return;
          case "rename_house":
            router.push({ pathname: "/houses/[houseId]", params: { houseId: action.houseId } });
            await wait(420);
            await playCursorHints(action.cursorHints);
            if (!accessToken) {
              showToast("請先登入後再修改房屋", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            {
              const response = await updateHouse(accessToken, action.houseId, action.name);
              markDataChanged();
              showToast(`房屋已改名為「${response.house.name}」`, "success");
              await reportActionResult(action, threadId, "succeeded", { houseId: response.house.id });
            }
            return;
          case "rename_space":
            router.push({ pathname: "/houses/[houseId]", params: { houseId: action.houseId } });
            await wait(420);
            await playCursorHints(action.cursorHints);
            if (!accessToken) {
              showToast("請先登入後再修改空間", "error");
              await reportActionResult(action, threadId, "failed", undefined, "missing access token");
              return;
            }
            {
              const response = await updateHouseSpace(
                accessToken,
                action.houseId,
                action.spaceId,
                action.name
              );
              markDataChanged();
              showToast(`空間已改名為「${response.space.name}」`, "success");
              await reportActionResult(action, threadId, "succeeded", { spaceId: response.space.id });
            }
            return;
          case "show_toast":
            await playCursorHints(action.cursorHints);
            showToast(action.message, action.tone);
            await reportActionResult(action, threadId, "succeeded", { shown: true });
            return;
        }
      } catch (error) {
        showToast(getErrorMessage(error), "error");
        await reportActionResult(action, threadId, "failed", undefined, getErrorMessage(error));
      }
    },
    [
      accessToken,
      markDataChanged,
      playCursorHints,
      reportActionResult,
      router,
      setDeveloperMode,
      setDeviceGroupMode,
      showToast
    ]
  );

  const runActions = useCallback(
    async (actions: HomiAction[], threadId?: string) => {
      if (actions.some((action) =>
        action.cursorHints.length > 0 ||
        action.type === "set_data_query" ||
        action.type === "focus_home_relay" ||
        action.type === "focus_home_device"
      )) {
        cursorX.setValue(width / 2 - homiCursorHotspotX);
        cursorY.setValue(height / 2 - homiCursorHotspotY);
        cursorScale.setValue(1);
      }

      for (const [index, action] of actions.entries()) {
        await executeAction(action, threadId, actions[index - 1]);
      }

      await wait(240);
      await hideCursor();
    },
    [cursorScale, cursorX, cursorY, executeAction, height, hideCursor, width]
  );

  const consumeDataQuery = useCallback((commandId: string) => {
    setPendingDataQuery((currentCommand) =>
      currentCommand?.commandId === commandId ? null : currentCommand
    );
  }, []);

  const consumeDeviceSettings = useCallback((commandId: string) => {
    setPendingDeviceSettings((currentCommand) =>
      currentCommand?.commandId === commandId ? null : currentCommand
    );
  }, []);

  const consumeHomeRelayFocus = useCallback((commandId: string) => {
    setPendingHomeRelayFocus((currentCommand) =>
      currentCommand?.commandId === commandId ? null : currentCommand
    );
  }, []);

  const value = useMemo(
    () => ({
      actionRevision,
      pendingDataQuery,
      pendingDeviceSettings,
      pendingHomeRelayFocus,
      consumeDataQuery,
      consumeDeviceSettings,
      consumeHomeRelayFocus,
      registerTarget,
      registerTargetPreparer,
      runActions,
      unregisterTarget
    }),
    [
      actionRevision,
      consumeDataQuery,
      consumeDeviceSettings,
      consumeHomeRelayFocus,
      pendingDataQuery,
      pendingDeviceSettings,
      pendingHomeRelayFocus,
      registerTarget,
      registerTargetPreparer,
      runActions,
      unregisterTarget
    ]
  );
  const previewCursorX = width / 2 - homiCursorHotspotX;
  const previewCursorY = height / 2 - homiCursorHotspotY;

  return (
    <HomiActionContext.Provider value={value}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cursor,
          {
            opacity: homiCursorPreviewMode ? 1 : cursorOpacity,
            transform: [
              { translateX: homiCursorPreviewMode ? previewCursorX : cursorX },
              { translateY: homiCursorPreviewMode ? previewCursorY : cursorY },
              { scale: homiCursorPreviewMode ? 1 : cursorScale }
            ]
          }
        ]}
      >
        <HomiPointerCursor />
      </Animated.View>
      {toast ? <ToastBanner toast={toast} top={Math.max(insets.top + 10, spacing.lg)} /> : null}
    </HomiActionContext.Provider>
  );
}

export function HomiTarget({
  children,
  style,
  targetId
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  targetId: string;
}) {
  const { registerTarget, unregisterTarget } = useHomiActions();
  const ref = useRef<View>(null);

  const measureNow = useCallback(() => {
    return new Promise<TargetLayout | null>((resolve) => {
      requestAnimationFrame(() => {
        if (!ref.current) {
          resolve(null);
          return;
        }

        ref.current?.measureInWindow((x, y, width, height) => {
          const layout = { x, y, width, height };
          registerTarget(targetId, layout, measureNow);
          resolve(width > 0 && height > 0 ? layout : null);
        });
      });
    });
  }, [registerTarget, targetId]);

  const measure = useCallback(() => {
    void measureNow();
  }, [measureNow]);

  useEffect(() => {
    measure();
    const timeout = setTimeout(measure, 350);

    return () => {
      clearTimeout(timeout);
      unregisterTarget(targetId);
    };
  }, [measure, targetId, unregisterTarget]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style}>
      {children}
    </View>
  );
}

export function useHomiActions() {
  const context = useContext(HomiActionContext);
  if (!context) {
    throw new Error("useHomiActions must be used inside HomiActionProvider");
  }

  return context;
}

function ToastBanner({ toast, top }: { toast: HomiToast; top: number }) {
  return (
    <View style={[styles.toast, styles[`${toast.tone}Toast`], { top }]}>
      <Ionicons name={toastIcon(toast.tone)} size={17} color={toastIconColor(toast.tone)} />
      <Text style={styles.toastText}>{toast.message}</Text>
    </View>
  );
}

function HomiPointerCursor() {
  return <Image source={homiCursorPando} resizeMode="contain" style={styles.cursorPointer} />;
}

function routePathForAction(route: string) {
  switch (route) {
    case "devices":
      return "/(tabs)/devices" as const;
    case "data":
      return "/(tabs)/data" as const;
    case "profile":
      return "/(tabs)/profile" as const;
    case "houses":
      return "/houses" as const;
    case "account":
      return "/account" as const;
    default:
      return "/(tabs)" as const;
  }
}

function isNavigateToRoute(action: HomiAction | undefined, route: string) {
  return action?.type === "navigate" && action.route === route;
}

function withoutTabHints(hints: HomiAction["cursorHints"]) {
  return hints.filter((hint) => !hint.target.startsWith("tab."));
}

function focusRelayCursorHints(action: Extract<HomiAction, { type: "focus_home_relay" }>) {
  const relayTarget = `home.relay.${action.deviceId}`;
  const moveHints = action.cursorHints.filter((hint) =>
    hint.target === relayTarget && hint.gesture === "move"
  );

  return moveHints.length > 0 ? moveHints.slice(0, 1) : [{ target: relayTarget, gesture: "move" as const }];
}

function focusHomeDeviceCursorHints(action: Extract<HomiAction, { type: "focus_home_device" }>) {
  const deviceTarget = `home.device.${action.deviceId}`;
  const targetHints = action.cursorHints.filter((hint) => hint.target === deviceTarget);

  return targetHints.length > 0 ? targetHints.slice(0, 1) : [{ target: deviceTarget, gesture: "move" as const }];
}

function moveCursorToTarget({
  cursorX,
  cursorY,
  height,
  target,
  width
}: {
  cursorX: Animated.Value;
  cursorY: Animated.Value;
  height: number;
  target?: TargetLayout;
  width: number;
}) {
  const x = target
    ? target.x + target.width / 2 - homiCursorHotspotX
    : width / 2 - homiCursorHotspotX;
  const y = target
    ? target.y + target.height / 2 - homiCursorHotspotY
    : height / 2 - homiCursorHotspotY;

  return Promise.all([
    animateValue(cursorX, x, 460, Easing.out(Easing.cubic)),
    animateValue(cursorY, y, 460, Easing.out(Easing.cubic))
  ]);
}

async function pulseCursor(cursorScale: Animated.Value, scale: number) {
  await animateValue(cursorScale, scale, 120, Easing.out(Easing.cubic));
  await animateValue(cursorScale, 1, 150, Easing.out(Easing.cubic));
}

function animateValue(value: Animated.Value, toValue: number, duration: number, easing: (value: number) => number) {
  return new Promise<void>((resolve) => {
    Animated.timing(value, {
      toValue,
      duration,
      easing,
      useNativeDriver: true
    }).start(() => resolve());
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toastIcon(tone: HomiToast["tone"]) {
  switch (tone) {
    case "success":
      return "checkmark-circle";
    case "warning":
      return "alert-circle";
    case "error":
      return "close-circle";
    default:
      return "sparkles";
  }
}

function toastIconColor(tone: HomiToast["tone"]) {
  switch (tone) {
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "error":
      return colors.danger;
    default:
      return colors.primary;
  }
}

const styles = StyleSheet.create({
  cursor: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    width: homiCursorSize,
    height: homiCursorSize,
    alignItems: "center",
    justifyContent: "center"
  },
  cursorPointer: {
    width: homiCursorSize,
    height: homiCursorSize,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12
  },
  toast: {
    position: "absolute",
    right: spacing.md,
    left: spacing.md,
    zIndex: 130,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18
  },
  infoToast: {
    borderColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth
  },
  successToast: {
    borderColor: colors.successSoft,
    borderWidth: StyleSheet.hairlineWidth
  },
  warningToast: {
    borderColor: colors.warningSoft,
    borderWidth: StyleSheet.hairlineWidth
  },
  errorToast: {
    borderColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth
  },
  toastText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    lineHeight: 18,
    letterSpacing: 0
  }
});
