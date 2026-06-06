import { useSegments } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getErrorMessage, getHomiHistory, sendHomiMessage } from "../../services/api-client";
import { useAuth } from "../auth/AuthContext";
import { useHomiActions } from "./HomiActionProvider";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

type AssistantChatContextValue = {
  error: string | null;
  inputValue: string;
  isSending: boolean;
  messages: ChatMessage[];
  sendMessage: (text?: string) => Promise<void>;
  setInputValue: (value: string) => void;
};

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "我是 Homi。\n我可以協助你整理感測資料、帶你查看數據頁，也會在控制智慧插座前先請你確認。",
    time: "現在"
  }
];

export const assistantQuickActions = ["今日家裡狀態", "帶我看廚房 7 天 eCO2", "打開客廳插座"];

const AssistantChatContext = createContext<AssistantChatContextValue | null>(null);

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const { accessToken, developerMode, deviceGroupMode } = useAuth();
  const segments = useSegments();
  const { runActions } = useHomiActions();
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    if (!accessToken) {
      setThreadId(undefined);
      setMessages(initialMessages);
      setError(null);
      return () => {
        canceled = true;
      };
    }
    const token = accessToken;

    async function loadHistory() {
      try {
        const history = await getHomiHistory(token);

        if (canceled) {
          return;
        }

        setThreadId(history.threadId ?? undefined);
        setError(null);
        setMessages(
          history.messages.length > 0
            ? history.messages.map((message) => ({
                id: message.id,
                role: message.role,
                text: message.content,
                time: formatHistoryTime(message.createdAt)
              }))
            : initialMessages
        );
      } catch (historyError) {
        if (!canceled) {
          setError(null);
          setThreadId(undefined);
          setMessages(initialMessages);
        }
      }
    }

    void loadHistory();

    return () => {
      canceled = true;
    };
  }, [accessToken]);

  const sendMessage = useCallback(
    async (text = inputValue) => {
      const trimmedText = text.trim();

      if (!trimmedText || isSending) {
        return;
      }

      const createdAt = new Date().toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const timestamp = Date.now();

      const userMessage: ChatMessage = {
        id: `user-${timestamp}`,
        role: "user",
        text: trimmedText,
        time: createdAt
      };
      const history = messages
        .slice(-10)
        .map((message) => ({ role: message.role, text: message.text }));

      setMessages((currentMessages) => [...currentMessages, userMessage]);
      setInputValue("");
      setError(null);

      if (!accessToken) {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-auth-${timestamp}`,
            role: "assistant",
            text: "請先登入後再使用 Homi。",
            time: createdAt
          }
        ]);
        return;
      }

      setIsSending(true);
      try {
        const response = await sendHomiMessage(accessToken, {
          message: trimmedText,
          messages: history,
          threadId,
          clientState: {
            currentRoute: segments.join("/"),
            developerMode,
            deviceGroupMode
          }
        });

        setThreadId(response.threadId);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-${timestamp}`,
            role: "assistant",
            text: response.assistantMessage,
            time: new Date().toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit"
            })
          }
        ]);

        void runActions(response.actions, response.threadId);
      } catch (sendError) {
        const message = getErrorMessage(sendError);
        setError(message);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `assistant-error-${timestamp}`,
            role: "assistant",
            text: `Homi 暫時無法完成操作：${message}`,
            time: createdAt
          }
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [
      accessToken,
      developerMode,
      deviceGroupMode,
      inputValue,
      isSending,
      messages,
      runActions,
      segments,
      threadId
    ]
  );

  const value = useMemo(
    () => ({
      error,
      inputValue,
      isSending,
      messages,
      sendMessage,
      setInputValue
    }),
    [error, inputValue, isSending, messages, sendMessage]
  );

  return <AssistantChatContext.Provider value={value}>{children}</AssistantChatContext.Provider>;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function useAssistantChat() {
  const context = useContext(AssistantChatContext);

  if (!context) {
    throw new Error("useAssistantChat must be used inside AssistantChatProvider");
  }

  return context;
}
