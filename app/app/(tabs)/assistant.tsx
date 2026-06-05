import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/features/auth/AuthContext";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "歡迎使用 Sense AI。\n我會協助你整理感測資料、異常狀態與智慧插座操作，讓家的狀態更容易掌握。",
    time: "現在"
  },
  {
    id: "demo-user",
    role: "user",
    text: "幫我看看今天家裡狀態。",
    time: "展示"
  },
  {
    id: "demo-assistant",
    role: "assistant",
    text: "目前可以先查看即時裝置、歷史數據與 P 系列控制。後續接上分析服務後，我會把重點整理成可行動的建議。",
    time: "展示"
  }
];

const quickActions = ["今日狀態", "異常摘要", "插座建議"];

export default function AssistantScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");

  function handleSend(text = inputValue) {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    const createdAt = new Date().toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit"
    });

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmedText,
        time: createdAt
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: "我已收到。等 AI 能力接上後，這裡會依照你的裝置、感測資料與設定提供回覆。",
        time: createdAt
      }
    ]);
    setInputValue("");
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
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

        <View
          style={[
            styles.composerWrap,
            { paddingBottom: Math.max(insets.bottom, 10) + 76 }
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionList}
          >
            {quickActions.map((action) => (
              <Pressable
                key={action}
                accessibilityRole="button"
                accessibilityLabel={action}
                onPress={() => handleSend(action)}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.quickActionPressed
                ]}
              >
                <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
                <Text style={styles.quickActionText}>{action}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="輸入想詢問的內容"
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={240}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="送出訊息"
              disabled={!inputValue.trim()}
              onPress={() => handleSend()}
              style={({ pressed }) => [
                styles.sendButton,
                !inputValue.trim() && styles.sendButtonDisabled,
                pressed && inputValue.trim() && styles.sendButtonPressed
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.surface} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1
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
    paddingBottom: spacing.lg,
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
  },
  composerWrap: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator
  },
  quickActionList: {
    gap: spacing.xs,
    paddingBottom: spacing.sm
  },
  quickAction: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primarySoft
  },
  quickActionPressed: {
    opacity: 0.75
  },
  quickActionText: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  inputRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: 27,
    backgroundColor: colors.surface
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.callout,
    lineHeight: 22,
    letterSpacing: 0
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceSecondary
  },
  sendButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.96 }]
  }
});
