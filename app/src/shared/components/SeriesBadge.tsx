import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type SeriesBadgeProps = {
  label: string;
  color: string;
};

export function SeriesBadge({ label, color }: SeriesBadgeProps) {
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}1F` }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "800",
    letterSpacing: 0
  }
});
