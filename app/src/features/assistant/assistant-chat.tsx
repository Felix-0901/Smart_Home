import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

type AssistantChatContextValue = {
  inputValue: string;
  messages: ChatMessage[];
  sendMessage: (text?: string) => void;
  setInputValue: (value: string) => void;
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

export const assistantQuickActions = ["今日狀態", "異常摘要", "插座建議"];

const AssistantChatContext = createContext<AssistantChatContextValue | null>(null);

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState("");

  const sendMessage = useCallback(
    (text = inputValue) => {
      const trimmedText = text.trim();

      if (!trimmedText) {
        return;
      }

      const createdAt = new Date().toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const timestamp = Date.now();

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `user-${timestamp}`,
          role: "user",
          text: trimmedText,
          time: createdAt
        },
        {
          id: `assistant-${timestamp}`,
          role: "assistant",
          text: "我已收到。等 AI Agent 能力接上後，這裡會依照你的裝置、感測資料與設定提供回覆。",
          time: createdAt
        }
      ]);
      setInputValue("");
    },
    [inputValue]
  );

  const value = useMemo(
    () => ({
      inputValue,
      messages,
      sendMessage,
      setInputValue
    }),
    [inputValue, messages, sendMessage]
  );

  return <AssistantChatContext.Provider value={value}>{children}</AssistantChatContext.Provider>;
}

export function useAssistantChat() {
  const context = useContext(AssistantChatContext);

  if (!context) {
    throw new Error("useAssistantChat must be used inside AssistantChatProvider");
  }

  return context;
}
