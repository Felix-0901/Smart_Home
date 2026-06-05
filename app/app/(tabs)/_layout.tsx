import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/theme/colors";
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

export default function TabsLayout() {
  return (
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
  );
}

function PillTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const bottomOffset = Math.max(insets.bottom, 10);
  const pillWidth = width - 24;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View style={[styles.tabBarRoot, { height: bottomOffset + 96 }]} pointerEvents="box-none">
      <View style={[styles.pillShell, { bottom: bottomOffset }]}>
        <PillBackground width={pillWidth} />
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
            <Pressable
              key={route.key}
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
              <Ionicons
                name={focused ? tabItems.assistant.activeIcon : tabItems.assistant.icon}
                size={30}
                color={colors.surface}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PillBackground({ width }: { width: number }) {
  const height = 70;
  const radius = 35;
  const notchCenterX = width / 2;
  const notchWidth = 104;
  const notchDepth = 32;
  const notchStartX = notchCenterX - notchWidth / 2;
  const notchEndX = notchCenterX + notchWidth / 2;
  const pillPath = [
    `M ${radius} 0`,
    `H ${notchStartX}`,
    `C ${notchStartX + 16} 0 ${notchStartX + 13} ${notchDepth - 9} ${notchCenterX - 30} ${notchDepth}`,
    `C ${notchCenterX - 18} ${notchDepth + 8} ${notchCenterX + 18} ${notchDepth + 8} ${notchCenterX + 30} ${notchDepth}`,
    `C ${notchEndX - 13} ${notchDepth - 9} ${notchEndX - 16} 0 ${notchEndX} 0`,
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
  pillSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 12
  },
  tabItemRow: {
    position: "relative",
    zIndex: 2,
    flex: 1,
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
  centerButton: {
    position: "absolute",
    zIndex: 5,
    top: -28,
    left: "50%",
    width: 70,
    height: 70,
    marginLeft: -35,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.background,
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
