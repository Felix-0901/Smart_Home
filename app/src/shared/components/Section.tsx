import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

type SectionProps = {
  title?: string;
  footer?: string;
  children: ReactNode;
};

export function Section({ title, footer, children }: SectionProps) {
  return (
    <View style={styles.wrapper}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.container}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.xl
  },
  title: {
    marginBottom: 6,
    marginHorizontal: spacing.lg,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  container: {
    marginHorizontal: spacing.md,
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.surface
  },
  footer: {
    marginTop: spacing.xs,
    marginHorizontal: spacing.lg,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18
  }
});
