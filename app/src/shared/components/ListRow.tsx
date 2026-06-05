import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type IconName = ComponentProps<typeof Ionicons>["name"];

type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  trailing?: ReactNode;
  leading?: ReactNode;
  destructive?: boolean;
};

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  onPress,
  trailing,
  leading,
  destructive = false
}: ListRowProps) {
  const content = (
    <>
      {leading}
      {icon ? (
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={19} color={destructive ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={styles.textColumn}>
        <Text style={[styles.title, destructive && styles.destructiveTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator
  },
  pressed: {
    backgroundColor: "rgba(0, 0, 0, 0.05)"
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  textColumn: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    fontWeight: "400",
    letterSpacing: 0
  },
  destructiveTitle: {
    color: colors.danger
  },
  subtitle: {
    marginTop: 2,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  },
  value: {
    maxWidth: "62%",
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    textAlign: "right"
  }
});
