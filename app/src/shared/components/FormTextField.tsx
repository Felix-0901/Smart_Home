import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type FormTextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | null;
};

export function FormTextField({ label, error, style, ...inputProps }: FormTextFieldProps) {
  return (
    <View>
      <View style={[styles.row, error && styles.rowError]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, style]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface
  },
  rowError: {
    borderBottomColor: colors.danger
  },
  label: {
    width: 92,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    letterSpacing: 0
  },
  input: {
    minHeight: 36,
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
    textAlign: "right"
  },
  error: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18,
    backgroundColor: colors.surface
  }
});
