import { useCallback, useEffect, useRef, useState } from "react";
import { createChat, deleteChat, listChats, listMessages, sendMessage } from "../lib/api";
import type { ChatMessage, ChatStatus, ChatSummary } from "../lib/types";

interface MessageRetry {
  content: string;
  key: string;
}

function sleep(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function chatTitle(content: string) {
  const heading = content.split(/\r?\n/, 1)[0].replace(/^subject:\s*/i, "").trim();
  const characters = Array.from(heading);
  return characters.length > 64 ? characters.slice(0, 63).join("").trimEnd() + "…" : heading;
}

export function useChat() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const running = useRef(false);
  const retries = useRef(new Map<string, MessageRetry>());

  const run = useCallback(async (action: () => Promise<void>, progress?: string) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setStatus(progress ? { message: progress } : null);
    try {
      await action();
      setStatus(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The request failed. Try again.";
      setStatus({ message, error: true });
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run(async () => setChats(await listChats()));
  }, [run]);

  function resetChat() {
    setActiveChat(null);
    setMessages([]);
    setDraft("");
  }

  function newChat() {
    if (running.current) return false;
    setStatus(null);
    resetChat();
    return true;
  }

  function openChat(chat: ChatSummary) {
    return run(async () => {
      const history = await listMessages(chat.id);
      setMessages(history);
      setActiveChat(chat);
      setDraft(retries.current.get(chat.id)?.content ?? "");
    }, "Loading conversation…");
  }

  async function removeChat() {
    if (!activeChat) return false;
    const { id } = activeChat;
    return run(async () => {
      await deleteChat(id);
      setChats((previous) => previous.filter((chat) => chat.id !== id));
      retries.current.delete(id);
      resetChat();
    }, "Deleting conversation…");
  }

  async function submit() {
    const content = draft.trim();
    if (!content) return false;

    return run(async () => {
      const chat = activeChat ?? await createChat(chatTitle(content));
      const chatId = chat.id;
      if (!activeChat) {
        setActiveChat(chat);
        setChats((previous) => [chat, ...previous]);
      }
      const retry = retries.current.get(chatId);
      const repeating = retry?.content === content;
      const key = repeating ? retry.key : crypto.randomUUID();
      const optimistic: ChatMessage = { id: "pending-" + key, role: "USER", content };
      const latest = messages.at(-1);
      const alreadySaved = repeating && latest?.role === "USER" && latest.content === content;
      if (!alreadySaved) setMessages((previous) => [...previous, optimistic]);
      setDraft("");

      try {
        const [result] = await Promise.all([sendMessage(chatId, content, key), sleep(3000)]);
        setMessages((previous) => [
          ...previous.filter(({ id }) => id !== optimistic.id &&
            id !== result.user_message.id && id !== result.assistant_message.id),
          result.user_message,
          { ...result.assistant_message, analysis: result.analysis },
        ]);
        setChats((previous) => [chat, ...previous.filter(({ id }) => id !== chatId)]);
        retries.current.delete(chatId);
      } catch (error) {
        retries.current.set(chatId, { content, key });
        setDraft(content);
        setMessages((previous) => previous.filter(({ id }) => id !== optimistic.id));
        try {
          setMessages(await listMessages(chatId));
        } catch {
          // Keep the visible history if the server cannot be reached.
        }
        throw error;
      }
    }, "Analyzing…");
  }

  return { chats, activeChat, messages, draft, setDraft, busy, status, newChat, openChat, removeChat, submit };
}
