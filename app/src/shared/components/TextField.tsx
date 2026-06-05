import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string | null;
};

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.subhead,
    fontWeight: "600",
    letterSpacing: 0
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.body
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  }
});
