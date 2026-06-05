import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import {
  AssistantChatProvider,
  assistantQuickActions,
  useAssistantChat
} from "../../src/features/assistant/assistant-chat";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type IconName = ComponentProps<typeof Ionicons>["name"];

type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

type TabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigation: {
    emit: (event: {
      canPreventDefault?: boolean;
      target: string;
      type: "tabLongPress" | "tabPress";
    }) => unknown;
    navigate: (name: string, params?: object) => void;
  };
};

const tabItems: Record<
  string,
  {
    activeIcon: IconName;
    accessibilityLabel: string;
    icon: IconName;
    label: string;
  }
> = {
  index: {
    activeIcon: "home",
    accessibilityLabel: "首頁",
    icon: "home-outline",
    label: "首頁"
  },
  devices: {
    activeIcon: "hardware-chip",
    accessibilityLabel: "裝置",
    icon: "hardware-chip-outline",
    label: "裝置"
  },
  assistant: {
    activeIcon: "sparkles",
    accessibilityLabel: "Sense AI 助理",
    icon: "sparkles-outline",
    label: "助理"
  },
  data: {
    activeIcon: "stats-chart",
    accessibilityLabel: "數據",
    icon: "stats-chart-outline",
    label: "數據"
  },
  profile: {
    activeIcon: "person-circle",
    accessibilityLabel: "個人",
    icon: "person-circle-outline",
    label: "個人"
  }
};

const assistantRainbowPalette = [
  "#FF2D55",
  "#FF3B30",
  "#FF9500",
  "#FFD60A",
  "#30D158",
  "#64D2FF",
  "#0A84FF",
  "#BF5AF2",
  "#FF2D55"
] as const;

const assistantRainbowSegmentCount = 168;
const assistantRainbowFrameMs = 48;
const assistantRainbowCycleMs = 4200;

export default function TabsLayout() {
  return (
    <AssistantChatProvider>
      <Tabs
        tabBar={(props) => <PillTabBar {...props} />}
        screenOptions={{
          headerShown: false
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "首頁" }}
        />
        <Tabs.Screen
          name="devices"
          options={{ title: "裝置" }}
        />
        <Tabs.Screen
          name="assistant"
          options={{ title: "助理" }}
        />
        <Tabs.Screen
          name="data"
          options={{ title: "數據" }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "個人" }}
        />
      </Tabs>
    </AssistantChatProvider>
  );
}

function PillTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const bottomOffset = Math.max(insets.bottom, 10);
  const currentRouteName = state.routes[state.index]?.name;
  const assistantFocused = currentRouteName === "assistant";
  const [assistantDockMounted, setAssistantDockMounted] = useState(assistantFocused);
  const assistantReturningToTabs = assistantDockMounted && !assistantFocused;
  const effectiveBottomOffset = bottomOffset + (assistantFocused ? keyboardHeight : 0);
  const pillWidth = width - 24;
  const [notchProgress, setNotchProgress] = useState(assistantFocused ? 1 : 0);
  const expansionProgress = useRef(new Animated.Value(assistantFocused ? 1 : 0)).current;
  const dropletProgress = useRef(new Animated.Value(assistantFocused ? 1 : 0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (assistantFocused) {
      setAssistantDockMounted(true);
      Animated.parallel([
        Animated.timing(expansionProgress, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false
        }),
        Animated.sequence([
          Animated.timing(dropletProgress, {
            toValue: 0.46,
            duration: 170,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(dropletProgress, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ])
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(expansionProgress, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.timing(dropletProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setAssistantDockMounted(false);
      }
    });
  }, [assistantFocused, dropletProgress, expansionProgress]);

  useEffect(() => {
    const listenerId = expansionProgress.addListener(({ value }) => {
      const nextProgress = Math.min(Math.max(value / 0.36, 0), 1);
      const roundedProgress = Math.round(nextProgress * 100) / 100;

      setNotchProgress((previousProgress) =>
        Math.abs(previousProgress - roundedProgress) > 0.005
          ? roundedProgress
          : previousProgress
      );
    });

    return () => expansionProgress.removeListener(listenerId);
  }, [expansionProgress]);

  if (keyboardVisible && !assistantFocused && !assistantDockMounted) {
    return null;
  }

  const rootHeight = expansionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [bottomOffset + 96, effectiveBottomOffset + 224]
  });
  const shellHeight = expansionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [70, 198]
  });
  const panelOpacity = expansionProgress.interpolate({
    inputRange: [0, 0.42, 1],
    outputRange: [0, 0.18, 1]
  });
  const returningPanelOpacity = expansionProgress.interpolate({
    inputRange: [0, 0.58, 1],
    outputRange: [0, 0.04, 1]
  });
  const expandedPanelOpacity = assistantReturningToTabs ? returningPanelOpacity : panelOpacity;
  const inputOutlineScaleX = Math.max((pillWidth - spacing.md * 2) / 70, 1);
  const notchedPillOpacity = expansionProgress.interpolate({
    inputRange: [0, 0.36, 0.82, 1],
    outputRange: [1, 1, 0, 0]
  });
  const pillSurfaceOpacity = assistantReturningToTabs ? 1 : notchedPillOpacity;
  const dropletOpacity = dropletProgress.interpolate({
    inputRange: [0, 0.46, 0.78, 1],
    outputRange: [1, 1, 0.18, 0]
  });
  const dropletTranslateY = dropletProgress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [0, -44, -44]
  });
  const dropletScaleX = dropletProgress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [1, 1, inputOutlineScaleX]
  });
  const dropletScaleY = dropletProgress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [1, 1, 0.82]
  });
  const dropletIconOpacity = dropletProgress.interpolate({
    inputRange: [0, 0.46, 0.62],
    outputRange: [1, 1, 0]
  });
  return (
    <Animated.View style={[styles.tabBarRoot, { height: rootHeight }]} pointerEvents="box-none">
      <Animated.View style={[styles.pillShell, { bottom: effectiveBottomOffset, height: shellHeight }]}>
        <Animated.View style={[styles.expandedPanel, { opacity: expandedPanelOpacity }]} />
        <Animated.View
          pointerEvents="none"
          style={[styles.pillSvgLayer, { width: pillWidth, opacity: pillSurfaceOpacity }]}
        >
          <PillBackground width={pillWidth} notchProgress={notchProgress} />
        </Animated.View>
        {assistantDockMounted ? (
          <AssistantDock
            interactive={assistantFocused}
            morphProgress={dropletProgress}
            progress={expansionProgress}
          />
        ) : null}
        <View style={styles.tabItemRow}>
          {state.routes.map((route, index) => {
            if (route.name === "assistant") {
              return <View key={route.key} style={styles.centerSpacer} />;
            }

            const focused = state.index === index;

            return (
              <PillTabItem
                key={route.key}
                focused={focused}
                onLongPress={() => {
                  navigation.emit({ type: "tabLongPress", target: route.key });
                }}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true
                  });

                  if (!focused && !isDefaultPrevented(event)) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                routeName={route.name}
              />
            );
          })}
        </View>
        {state.routes.map((route, index) => {
          if (route.name !== "assistant") {
            return null;
          }

          const focused = state.index === index;

          return (
            <Animated.View
              key={route.key}
              pointerEvents={assistantFocused ? "none" : "auto"}
              style={[
                styles.centerButtonMotion,
                {
                  opacity: dropletOpacity,
                  transform: [
                    { translateY: dropletTranslateY },
                    { scaleX: dropletScaleX },
                    { scaleY: dropletScaleY }
                  ]
                }
              ]}
            >
              <Pressable
                accessibilityLabel={tabItems.assistant.accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                hitSlop={10}
                onLongPress={() => {
                  navigation.emit({ type: "tabLongPress", target: route.key });
                }}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true
                  });

                  if (!focused && !isDefaultPrevented(event)) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={({ pressed }) => [
                  styles.centerButton,
                  focused && styles.centerButtonFocused,
                  pressed && styles.centerButtonPressed
                ]}
              >
                <Animated.View pointerEvents="none" style={{ opacity: dropletIconOpacity }}>
                  <Ionicons
                    name={focused ? tabItems.assistant.activeIcon : tabItems.assistant.icon}
                    size={30}
                    color={colors.surface}
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

function AssistantDock({
  interactive,
  morphProgress,
  progress
}: {
  interactive: boolean;
  morphProgress: Animated.Value;
  progress: Animated.Value;
}) {
  const { inputValue, sendMessage, setInputValue } = useAssistantChat();
  const { width } = useWindowDimensions();
  const inputFrameWidth = width - 24 - spacing.md * 2;
  const dockOpacity = progress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0, 1, 1]
  });
  const dockTranslateY = progress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [30, 8, 0]
  });
  const outlineOpacity = morphProgress.interpolate({
    inputRange: [0, 0.46, 0.66, 1],
    outputRange: [0, 0, 1, 1]
  });
  const outlineScaleX = morphProgress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [0.18, 0.18, 1]
  });
  const outlineScaleY = morphProgress.interpolate({
    inputRange: [0, 0.46, 1],
    outputRange: [0.82, 0.82, 1]
  });
  const inputContentOpacity = morphProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0, 0, 1]
  });
  const quickActionOpacity = morphProgress.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [0, 0, 1]
  });
  const quickActionTranslateY = morphProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0]
  });

  return (
    <Animated.View
      pointerEvents={interactive ? "box-none" : "none"}
      style={[
        styles.assistantDock,
        {
          opacity: dockOpacity,
          transform: [{ translateY: dockTranslateY }]
        }
      ]}
    >
      <Animated.View
        style={{
          opacity: quickActionOpacity,
          transform: [{ translateY: quickActionTranslateY }]
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assistantQuickActionList}
          keyboardShouldPersistTaps="handled"
        >
          {assistantQuickActions.map((action) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={action}
              onPress={() => sendMessage(action)}
              style={({ pressed }) => [
                styles.assistantQuickAction,
                pressed && styles.assistantQuickActionPressed
              ]}
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
              <Text style={styles.assistantQuickActionText}>{action}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.assistantInputFrame}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.assistantInputOutline,
            {
              opacity: outlineOpacity,
              transform: [
                { scaleX: outlineScaleX },
                { scaleY: outlineScaleY }
              ]
            }
          ]}
        >
          <AssistantRainbowBorder width={inputFrameWidth} />
          <View style={styles.assistantInputSurface} />
        </Animated.View>
        <Animated.View style={[styles.assistantInputContent, { opacity: inputContentOpacity }]}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="輸入想詢問的內容"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={240}
            style={styles.assistantInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="送出訊息"
            disabled={!inputValue.trim()}
            onPress={() => sendMessage()}
            style={({ pressed }) => [
              styles.assistantSendButton,
              !inputValue.trim() && styles.assistantSendButtonDisabled,
              pressed && inputValue.trim() && styles.assistantSendButtonPressed
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.surface} />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function AssistantRainbowBorder({ width }: { width: number }) {
  const [colorOffset, setColorOffset] = useState(0);
  const borderWidth = Math.max(width, 120);
  const borderHeight = 56;
  const segments = useMemo(
    () => buildRoundedRainbowSegments(borderWidth, borderHeight),
    [borderWidth]
  );

  useEffect(() => {
    let animationFrame = 0;
    let startTime = 0;
    let previousFrame = 0;

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      if (timestamp - previousFrame >= assistantRainbowFrameMs) {
        previousFrame = timestamp;
        setColorOffset(((timestamp - startTime) % assistantRainbowCycleMs) / assistantRainbowCycleMs);
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${borderWidth} ${borderHeight}`}
      preserveAspectRatio="none"
      style={styles.assistantRainbowSvg}
      pointerEvents="none"
    >
      {segments.map((segment) => (
        <Path
          key={`glow-${segment.key}`}
          d={segment.d}
          fill="transparent"
          stroke={getRainbowBorderColor(segment.colorProgress - colorOffset)}
          strokeLinecap="round"
          strokeWidth={8}
          opacity={0.14}
        />
      ))}
      {segments.map((segment) => (
        <Path
          key={segment.key}
          d={segment.d}
          fill="transparent"
          stroke={getRainbowBorderColor(segment.colorProgress - colorOffset)}
          strokeLinecap="round"
          strokeWidth={3.4}
        />
      ))}
    </Svg>
  );
}

function PillBackground({
  notchProgress = 0,
  width
}: {
  notchProgress?: number;
  width: number;
}) {
  const height = 70;
  const radius = 35;
  const notchCenterX = width / 2;
  const cutoutRadius = 43;
  const cutoutCenterY = 7;
  const cutoutStartAngle = Math.PI + Math.asin(cutoutCenterY / cutoutRadius);
  const cutoutMidAngle = Math.PI / 2;
  const cutoutEndAngle = -Math.asin(cutoutCenterY / cutoutRadius);
  const leftCutout = getCircularCutoutSegment(
    notchCenterX,
    cutoutCenterY,
    cutoutRadius,
    cutoutStartAngle,
    cutoutMidAngle
  );
  const rightCutout = getCircularCutoutSegment(
    notchCenterX,
    cutoutCenterY,
    cutoutRadius,
    cutoutMidAngle,
    cutoutEndAngle
  );
  const flattenedLeftCutout = flattenCutoutSegment(leftCutout, notchProgress);
  const flattenedRightCutout = flattenCutoutSegment(rightCutout, notchProgress);
  const pillPath = [
    `M ${radius} 0`,
    `H ${flattenedLeftCutout.startX}`,
    `C ${flattenedLeftCutout.c1x} ${flattenedLeftCutout.c1y} ${flattenedLeftCutout.c2x} ${flattenedLeftCutout.c2y} ${flattenedLeftCutout.endX} ${flattenedLeftCutout.endY}`,
    `C ${flattenedRightCutout.c1x} ${flattenedRightCutout.c1y} ${flattenedRightCutout.c2x} ${flattenedRightCutout.c2y} ${flattenedRightCutout.endX} ${flattenedRightCutout.endY}`,
    `H ${width - radius}`,
    `Q ${width} 0 ${width} ${radius}`,
    `V ${height - radius}`,
    `Q ${width} ${height} ${width - radius} ${height}`,
    `H ${radius}`,
    `Q 0 ${height} 0 ${height - radius}`,
    `V ${radius}`,
    `Q 0 0 ${radius} 0`,
    "Z"
  ].join(" ");

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={styles.pillSvg}
      pointerEvents="none"
    >
      <Path d={pillPath} fill="rgba(255, 255, 255, 0.88)" />
      <Path
        d={pillPath}
        fill="transparent"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth={1}
      />
    </Svg>
  );
}

function buildRoundedRainbowSegments(width: number, height: number) {
  const radius = Math.min(26, height / 2 - 2, width / 2 - 2);

  return Array.from({ length: assistantRainbowSegmentCount }, (_, index) => {
    const start = index / assistantRainbowSegmentCount;
    const end = (index + 1) / assistantRainbowSegmentCount;
    const startPoint = getRoundedRectPoint(start, width, height, radius);
    const endPoint = getRoundedRectPoint(end, width, height, radius);

    return {
      key: `${index}-${startPoint.x}-${startPoint.y}`,
      colorProgress: (index + 0.5) / assistantRainbowSegmentCount,
      d: `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`
    };
  });
}

function getRoundedRectPoint(progress: number, width: number, height: number, radius: number) {
  const topHalfLength = width / 2 - radius;
  const horizontalLength = width - radius * 2;
  const verticalLength = height - radius * 2;
  const arcLength = (Math.PI * radius) / 2;
  const perimeter = horizontalLength * 2 + verticalLength * 2 + arcLength * 4;
  let distance = progress * perimeter;

  const consumeLine = (
    length: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    if (distance > length) {
      distance -= length;
      return null;
    }

    const ratio = length === 0 ? 0 : distance / length;
    return {
      x: roundPathValue(fromX + (toX - fromX) * ratio),
      y: roundPathValue(fromY + (toY - fromY) * ratio)
    };
  };

  const consumeArc = (
    length: number,
    centerX: number,
    centerY: number,
    startAngle: number,
    endAngle: number
  ) => {
    if (distance > length) {
      distance -= length;
      return null;
    }

    const ratio = length === 0 ? 0 : distance / length;
    const angle = startAngle + (endAngle - startAngle) * ratio;
    return {
      x: roundPathValue(centerX + radius * Math.cos(angle)),
      y: roundPathValue(centerY + radius * Math.sin(angle))
    };
  };

  return (
    consumeLine(topHalfLength, width / 2, 0, width - radius, 0) ??
    consumeArc(arcLength, width - radius, radius, -Math.PI / 2, 0) ??
    consumeLine(verticalLength, width, radius, width, height - radius) ??
    consumeArc(arcLength, width - radius, height - radius, 0, Math.PI / 2) ??
    consumeLine(horizontalLength, width - radius, height, radius, height) ??
    consumeArc(arcLength, radius, height - radius, Math.PI / 2, Math.PI) ??
    consumeLine(verticalLength, 0, height - radius, 0, radius) ??
    consumeArc(arcLength, radius, radius, Math.PI, (Math.PI * 3) / 2) ??
    consumeLine(topHalfLength, radius, 0, width / 2, 0) ?? {
      x: roundPathValue(width / 2),
      y: 0
    }
  );
}

function getRainbowBorderColor(progress: number) {
  const normalizedProgress = ((progress % 1) + 1) % 1;
  const scaledProgress = normalizedProgress * (assistantRainbowPalette.length - 1);
  const startIndex = Math.floor(scaledProgress);
  const endIndex = Math.min(startIndex + 1, assistantRainbowPalette.length - 1);
  const localProgress = scaledProgress - startIndex;

  return interpolateHexColor(
    assistantRainbowPalette[startIndex],
    assistantRainbowPalette[endIndex],
    localProgress
  );
}

function interpolateHexColor(from: string, to: string, progress: number) {
  const fromRgb = parseHexColor(from);
  const toRgb = parseHexColor(to);
  const nextRgb = fromRgb.map((channel, index) =>
    Math.round(channel + (toRgb[index] - channel) * progress)
  );

  return `rgb(${nextRgb[0]}, ${nextRgb[1]}, ${nextRgb[2]})`;
}

function parseHexColor(hexColor: string) {
  return [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16)
  ];
}

function flattenCutoutSegment(
  segment: ReturnType<typeof getCircularCutoutSegment>,
  progress: number
) {
  const flatProgress = Math.min(Math.max(progress, 0), 1);
  const flattenY = (value: number) => roundPathValue(value * (1 - flatProgress));

  return {
    ...segment,
    startY: flattenY(segment.startY),
    c1y: flattenY(segment.c1y),
    c2y: flattenY(segment.c2y),
    endY: flattenY(segment.endY)
  };
}

function getCircularCutoutSegment(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const control = (4 / 3) * Math.tan((endAngle - startAngle) / 4);
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY + radius * Math.sin(endAngle);
  const startTangentX = -radius * Math.sin(startAngle);
  const startTangentY = radius * Math.cos(startAngle);
  const endTangentX = -radius * Math.sin(endAngle);
  const endTangentY = radius * Math.cos(endAngle);

  return {
    startX: roundPathValue(startX),
    startY: roundPathValue(startY),
    c1x: roundPathValue(startX + control * startTangentX),
    c1y: roundPathValue(startY + control * startTangentY),
    c2x: roundPathValue(endX - control * endTangentX),
    c2y: roundPathValue(endY - control * endTangentY),
    endX: roundPathValue(endX),
    endY: roundPathValue(endY)
  };
}

function roundPathValue(value: number) {
  return Number(value.toFixed(3));
}

function isDefaultPrevented(event: unknown) {
  return (
    typeof event === "object" &&
    event !== null &&
    "defaultPrevented" in event &&
    event.defaultPrevented === true
  );
}

function PillTabItem({
  focused,
  onLongPress,
  onPress,
  routeName
}: {
  focused: boolean;
  onLongPress: (event: GestureResponderEvent) => void;
  onPress: (event: GestureResponderEvent) => void;
  routeName: string;
}) {
  const item = tabItems[routeName];
  const glassProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(glassProgress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 130
    }).start();
  }, [focused, glassProgress]);

  if (!item) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel={item.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      hitSlop={8}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabItem,
        pressed && styles.tabItemPressed
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabActiveGlass,
          {
            opacity: glassProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1]
            }),
            transform: [
              {
                scale: glassProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.82, 1]
                })
              },
              {
                translateY: glassProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 0]
                })
              }
            ]
          }
        ]}
      />
      <Ionicons
        name={focused ? item.activeIcon : item.icon}
        size={23}
        style={styles.tabIcon}
        color={focused ? colors.primary : colors.textTertiary}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBarRoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent"
  },
  pillShell: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 70
  },
  expandedPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.86)",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 12
  },
  pillSvg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 12
  },
  pillSvgLayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 70
  },
  tabItemRow: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8
  },
  tabItem: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    position: "relative"
  },
  tabItemPressed: {
    opacity: 0.72
  },
  centerSpacer: {
    flex: 0,
    width: 82,
    minHeight: 56
  },
  tabActiveGlass: {
    position: "absolute",
    width: 58,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.68)",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  tabIcon: {
    zIndex: 2
  },
  tabLabel: {
    zIndex: 2,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0
  },
  tabLabelFocused: {
    color: colors.primary
  },
  assistantDock: {
    position: "absolute",
    right: spacing.md,
    bottom: 74,
    left: spacing.md,
    zIndex: 4,
    gap: spacing.sm
  },
  assistantQuickActionList: {
    gap: spacing.xs,
    paddingHorizontal: 2
  },
  assistantQuickAction: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primarySoft
  },
  assistantQuickActionPressed: {
    opacity: 0.75
  },
  assistantQuickActionText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  assistantInputFrame: {
    minHeight: 56,
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "transparent",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  assistantInputOutline: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.surface
  },
  assistantRainbowSvg: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  assistantInputSurface: {
    position: "absolute",
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 25,
    backgroundColor: colors.surface
  },
  assistantInputContent: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: 28
  },
  assistantInput: {
    flex: 1,
    maxHeight: 104,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    lineHeight: 22,
    letterSpacing: 0
  },
  assistantSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  assistantSendButtonDisabled: {
    backgroundColor: colors.surfaceSecondary
  },
  assistantSendButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.96 }]
  },
  centerButtonMotion: {
    position: "absolute",
    zIndex: 5,
    bottom: 28,
    left: "50%",
    width: 70,
    height: 70,
    marginLeft: -35,
    borderRadius: 35
  },
  centerButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8
  },
  centerButtonFocused: {
    backgroundColor: colors.primaryPressed
  },
  centerButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }]
  }
});
