import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type StatusDotProps = {
  color?: string;
  label?: string;
};

export function StatusDot({ color = colors.offline, label }: StatusDotProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  label: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "600",
    letterSpacing: 0
  }
});
