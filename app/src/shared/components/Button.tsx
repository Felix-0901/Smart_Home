import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type IconName = ComponentProps<typeof Ionicons>["name"];

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  variant?: "primary" | "secondary" | "destructive" | "plain";
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = "primary",
  style
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.surface : colors.primary} />
      ) : (
        <View style={styles.labelRow}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={getLabelColor(variant)}
            />
          ) : null}
          <Text style={[styles.label, { color: getLabelColor(variant) }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

function getLabelColor(variant: NonNullable<ButtonProps["variant"]>) {
  if (variant === "primary") {
    return colors.surface;
  }

  if (variant === "destructive") {
    return colors.danger;
  }

  return colors.primary;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.primarySoft
  },
  destructive: {
    backgroundColor: colors.dangerSoft
  },
  plain: {
    backgroundColor: "transparent"
  },
  disabled: {
    opacity: 0.48
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.88
  },
  labelRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    fontWeight: "600",
    letterSpacing: 0
  }
});
