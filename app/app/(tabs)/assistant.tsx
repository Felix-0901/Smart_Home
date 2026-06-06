import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
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
  const { error, isSending, messages } = useAssistantChat();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{user?.displayName ?? "Smart Home"}</Text>
          <Text style={styles.title}>Homi</Text>
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
        {isSending ? (
          <View style={styles.thinkingRow}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <View style={styles.thinkingBubble}>
              <Text style={styles.thinkingText}>Homi 正在整理下一步</Text>
            </View>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
          {isUser ? (
            <Text style={[styles.messageText, styles.userMessageText]}>{message.text}</Text>
          ) : (
            <MarkdownText text={message.text} />
          )}
        </View>
        <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>{message.time}</Text>
      </View>
    </View>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);

  return (
    <View style={styles.markdownStack}>
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          return <View key={`gap-${index}`} style={styles.markdownGap} />;
        }

        const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          return (
            <Text key={`heading-${index}`} style={[styles.messageText, styles.markdownHeading]}>
              {renderInlineMarkdown(headingMatch[2], `heading-${index}`)}
            </Text>
          );
        }

        const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <View key={`bullet-${index}`} style={styles.markdownListRow}>
              <Text style={[styles.messageText, styles.markdownMarker]}>•</Text>
              <Text style={[styles.messageText, styles.markdownListText]}>
                {renderInlineMarkdown(bulletMatch[1], `bullet-${index}`)}
              </Text>
            </View>
          );
        }

        const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);
        if (numberedMatch) {
          return (
            <View key={`number-${index}`} style={styles.markdownListRow}>
              <Text style={[styles.messageText, styles.markdownMarker]}>{numberedMatch[1]}.</Text>
              <Text style={[styles.messageText, styles.markdownListText]}>
                {renderInlineMarkdown(numberedMatch[2], `number-${index}`)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={`paragraph-${index}`} style={styles.messageText}>
            {renderInlineMarkdown(line, `paragraph-${index}`)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInlineMarkdown(input: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(input.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`")) {
      nodes.push(
        <Text key={key} style={styles.markdownCode}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <Text key={key} style={styles.markdownBold}>
          {token.slice(2, -2)}
        </Text>
      );
    } else {
      nodes.push(
        <Text key={key} style={styles.markdownItalic}>
          {token.slice(1, -1)}
        </Text>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < input.length) {
    nodes.push(input.slice(lastIndex));
  }

  return nodes;
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
  markdownStack: {
    gap: 4
  },
  markdownGap: {
    height: spacing.xxs
  },
  markdownHeading: {
    fontWeight: "800"
  },
  markdownBold: {
    fontWeight: "800"
  },
  markdownItalic: {
    fontStyle: "italic"
  },
  markdownCode: {
    overflow: "hidden",
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: colors.surfaceSecondary,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote
  },
  markdownListRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs
  },
  markdownMarker: {
    minWidth: 18,
    color: colors.textSecondary,
    fontWeight: "700"
  },
  markdownListText: {
    flex: 1,
    minWidth: 0
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
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  thinkingBubble: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  thinkingText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    fontWeight: "700",
    letterSpacing: 0
  },
  errorText: {
    alignSelf: "center",
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.footnote,
    lineHeight: 18,
    textAlign: "center"
  }
});
