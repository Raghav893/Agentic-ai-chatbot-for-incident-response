"use client";

import { useRef, useState } from "react";
import { useChat } from "../hooks/use-chat";
import type { ChatSummary, VirusTotalReport } from "../lib/types";
import { ChatHeader, ChatSidebar } from "./chat-sidebar";
import { Composer } from "./composer";
import { Conversation } from "./conversation";
import { VirusTotalPanel } from "./virustotal-panel";

const emptyReports: VirusTotalReport[] = [];
type Panel = "history" | "report";

export function ThreatGuard() {
  const chat = useChat();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const reportToggleRef = useRef<HTMLButtonElement>(null);
  const latestReportMessage = chat.messages.findLast((message) => message.analysis?.virustotal_reports?.length);
  const reportMessage = chat.messages.find((message) => message.id === reportMessageId) ?? latestReportMessage;
  const reports = reportMessage?.analysis?.virustotal_reports ?? emptyReports;
  const lastMessage = chat.messages.at(-1);
  const reportPending = chat.status?.message === "Analyzing…" && lastMessage?.role === "USER" &&
    /https?:\/\//i.test(lastMessage.content);

  function focusDraft() {
    requestAnimationFrame(() => draftRef.current?.focus());
  }

  function resetPanels() {
    setPanel(null);
    setReportMessageId(null);
  }

  function newChat() {
    if (chat.newChat()) {
      resetPanels();
      focusDraft();
    }
  }

  async function openChat(conversation: ChatSummary) {
    if (await chat.openChat(conversation)) resetPanels();
  }

  async function deleteChat() {
    if (window.confirm("Delete this conversation and its messages?") && await chat.removeChat()) resetPanels();
  }

  async function submit() {
    setReportMessageId(null);
    await chat.submit();
    focusDraft();
  }

  function chooseExample(content: string) {
    chat.setDraft(content);
    focusDraft();
  }

  function togglePanel(next: Panel) {
    setPanel((current) => current === next ? null : next);
  }

  function showReport(messageId: string) {
    setReportMessageId(messageId);
    setPanel("report");
    requestAnimationFrame(() => reportRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="vbg-shell">
      <a className="vbg-skip-link" href="#main">Skip to content</a>
      <header className="vbg-header">
        <div className="vbg-masthead">
          <span className="vbg-identity"><span className="vbg-heading-20">ThreatGuard</span></span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="vbg-custom-workspace" data-view={panel ?? "chat"}>
        <nav className="vbg-custom-navigation" aria-label="Workspace views">
          <button
            type="button"
            className="vbg-label vbg-custom-quiet-action vbg-custom-history-toggle"
            aria-controls="sidebar"
            aria-expanded={panel === "history"}
            onClick={() => togglePanel("history")}
          >
            {panel === "history" ? "Close chats" : "Chats"}
          </button>
          <button
            type="button"
            ref={reportToggleRef}
            className="vbg-label vbg-custom-quiet-action"
            aria-controls="reputation-panel"
            aria-expanded={panel === "report"}
            onClick={() => togglePanel("report")}
          >
            {panel === "report" ? "Close report" : "Report"}
          </button>
        </nav>
        <ChatSidebar
          chats={chat.chats}
          activeChatId={chat.activeChat?.id}
          busy={chat.busy}
          onNewChat={newChat}
          onOpenChat={openChat}
        />
        <section aria-label="Chat" className="vbg-custom-chat">
          {chat.activeChat && <ChatHeader activeChat={chat.activeChat} busy={chat.busy} onDeleteChat={deleteChat} />}
          <Conversation
            messages={chat.messages}
            busy={chat.busy}
            hasTitle={Boolean(chat.activeChat)}
            onChooseExample={chooseExample}
            selectedReportId={reportMessage?.id}
            onShowReport={showReport}
          />
          <Composer
            draft={chat.draft}
            busy={chat.busy}
            status={chat.status}
            draftRef={draftRef}
            onDraftChange={chat.setDraft}
            onSubmit={submit}
          />
        </section>
        <aside
          id="reputation-panel"
          ref={reportRef}
          tabIndex={-1}
          aria-label="VirusTotal URL reputation"
          className="vbg-custom-report"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setPanel(null);
              reportToggleRef.current?.focus();
            }
          }}
        >
          <VirusTotalPanel key={reportMessage?.id ?? "empty"} reports={reports} pending={reportPending} />
        </aside>
      </main>
      <footer className="vbg-footer">
        <a className="vbg-label" href="/swagger-ui/index.html">API documentation <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
