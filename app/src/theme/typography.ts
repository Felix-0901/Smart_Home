import { Platform } from "react-native";

export const typography = {
  fontFamily: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System"
  }),
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  body: 17,
  callout: 16,
  subhead: 15,
  footnote: 13,
  caption: 12
} as const;
