import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { Button } from "./Button";

type IconName = ComponentProps<typeof Ionicons>["name"];

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = "file-tray-outline", title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.title3,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0
  },
  body: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    lineHeight: 21,
    textAlign: "center"
  },
  action: {
    alignSelf: "stretch",
    marginTop: spacing.xs
  }
});
