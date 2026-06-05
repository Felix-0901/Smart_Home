import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type Option = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

export function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selected,
              pressed && !selected && styles.pressed
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 3,
    backgroundColor: colors.surfaceSecondary
  },
  option: {
    minHeight: 28,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: spacing.xs
  },
  selected: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2
  },
  pressed: {
    backgroundColor: colors.surfaceSecondary
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "600",
    letterSpacing: 0
  },
  selectedLabel: {
    color: colors.primary
  }
});
