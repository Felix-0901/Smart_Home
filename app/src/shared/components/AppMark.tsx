import { Image, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export function AppMark() {
  return <Image source={require("../../../assets/icon.png")} style={styles.mark} />;
}

const styles = StyleSheet.create({
  mark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18
  }
});
