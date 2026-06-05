import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAssistantChat, type ChatMessage } from "../../src/features/assistant/assistant-chat";
import { useAuth } from "../../src/features/auth/AuthContext";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function AssistantScreen() {
  const { user } = useAuth();
  const { messages } = useAssistantChat();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{user?.displayName ?? "Smart Home"}</Text>
          <Text style={styles.title}>Sense AI</Text>
        </View>
        <View style={styles.headerMark} accessibilityLabel="Sense AI">
          <Ionicons name="sparkles" size={24} color={colors.surface} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messageList}
      >
        <View style={styles.todayDivider}>
          <Text style={styles.todayText}>今天</Text>
        </View>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
      ) : null}
      <View style={[styles.messageBlock, isUser && styles.userMessageBlock]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.text}</Text>
        </View>
        <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>{message.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background
  },
  eyebrow: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "600",
    letterSpacing: 0
  },
  title: {
    marginTop: spacing.xxs,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.largeTitle,
    fontWeight: "700",
    letterSpacing: 0
  },
  headerMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 244,
    gap: spacing.md
  },
  todayDivider: {
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary
  },
  todayText: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    fontWeight: "700",
    letterSpacing: 0
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs
  },
  userMessageRow: {
    justifyContent: "flex-end"
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft
  },
  messageBlock: {
    maxWidth: "82%"
  },
  userMessageBlock: {
    alignItems: "flex-end"
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6
  },
  messageText: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    lineHeight: 23,
    letterSpacing: 0
  },
  userMessageText: {
    color: colors.surface
  },
  messageTime: {
    marginTop: spacing.xxs,
    color: colors.textTertiary,
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    letterSpacing: 0
  },
  userMessageTime: {
    textAlign: "right"
  }
});
