import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type MetricTileProps = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricTile({ label, value, detail }: MetricTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 86,
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  value: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.title1,
    fontWeight: "800",
    letterSpacing: 0
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  detail: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    lineHeight: 16
  }
});
