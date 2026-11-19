import type { ChatSummary } from "../lib/types";

interface ChatSidebarProps {
  chats: ChatSummary[];
  activeChatId?: string;
  busy: boolean;
  onNewChat: () => void;
  onOpenChat: (chat: ChatSummary) => void;
}

export function ChatSidebar({ chats, activeChatId, busy, onNewChat, onOpenChat }: ChatSidebarProps) {
  return (
    <aside id="sidebar" aria-label="Chat history" className="vbg-custom-history">
      <div className="vbg-custom-history-header">
        <h2 className="vbg-heading-16">Conversations</h2>
        <button type="button" className="vbg-label vbg-custom-quiet-action" onClick={onNewChat} disabled={busy}>
          New chat
        </button>
      </div>
      <ul className="vbg-custom-history-list">
        {chats.length === 0 && <li className="vbg-caption">No conversations yet</li>}
        {chats.map((chat) => (
          <li key={chat.id}>
            <button
              type="button"
              className="vbg-label vbg-custom-history-choice"
              title={chat.title}
              aria-current={chat.id === activeChatId ? "true" : undefined}
              onClick={() => onOpenChat(chat)}
              disabled={busy}
            >
              {chat.title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ChatHeader({ activeChat, busy, onDeleteChat }: {
  activeChat: ChatSummary;
  busy: boolean;
  onDeleteChat: () => void;
}) {
  return (
    <header className="vbg-custom-chat-header">
      <h1 className="vbg-custom-chat-title">{activeChat.title}</h1>
      <button type="button" className="vbg-label vbg-custom-quiet-action" onClick={onDeleteChat} disabled={busy}>
        Delete chat
      </button>
    </header>
  );
}
