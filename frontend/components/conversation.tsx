import { useEffect, useRef } from "react";
import type { Analysis, ChatMessage } from "../lib/types";

const examples = [
  {
    label: "Try a phishing email",
    message:
      "Subject: Final warning about your mailbox\n\nYour mailbox will be suspended in 30 minutes. Reply with your password and one-time code to keep your account active.\n\nIs this phishing?",
  },
  {
    label: "Check a sample URL",
    message: "Please check https://example.com/ for suspicious signs and summarize any existing reputation report.",
  },
];

function verdict(analysis: Analysis) {
  const reports = analysis.virustotal_reports ?? [];
  const flagged = reports.some((report) => report.status === "report_found" && report.malicious + report.suspicious > 0);
  const isEmail = analysis.incident_type === "PHISHING" || analysis.incident_type === "SUSPICIOUS_EMAIL";
  const isWebsite = (reports.length > 0 || Boolean(analysis.submitted_url)) && (!isEmail || flagged);
  const multiple = reports.length > 1;

  switch (analysis.risk_level) {
    case "HIGH":
    case "CRITICAL":
      if (!isWebsite) return "This message looks malicious.";
      if (reports.some((report) => report.status === "report_found" && report.malicious >= 2)) {
        return multiple ? "At least one website was flagged as malicious." : "This website was flagged as malicious.";
      }
      return multiple ? "At least one website looks malicious." : "This website looks malicious.";
    case "MEDIUM":
      if (!isWebsite) return "This message may be harmful.";
      return multiple ? "At least one website may be harmful." : "This website may be harmful.";
    case "LOW":
      if (!isWebsite) return "This message appears to be low risk.";
      if (!reports.length || reports.some((report) => report.status !== "report_found" || (report.harmless ?? 0) < 2)) {
        return "The available checks suggest low risk, with limited reputation evidence.";
      }
      return multiple ? "These websites appear safe based on the available checks." :
        "This website appears safe based on the available checks.";
    case "UNKNOWN":
      return isWebsite ? "The available evidence could not establish website safety." :
        "The available evidence leaves the threat level unclear.";
  }
}

function AssessmentList({ heading, entries }: { heading: string; entries: string[] }) {
  if (!entries.length) return null;

  return (
    <div className="vbg-custom-assessment-list">
      <h3 className="vbg-heading-16">{heading}</h3>
      <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
    </div>
  );
}

function Assessment({ analysis }: { analysis: Analysis }) {
  if (!analysis.evidence.length && !analysis.recommendations.length) return null;

  return (
    <details className="vbg-custom-assessment">
      <summary>Evidence and next steps</summary>
      <AssessmentList heading="Evidence" entries={analysis.evidence} />
      <AssessmentList heading="Next steps" entries={analysis.recommendations} />
    </details>
  );
}

function MessageBubble({ message, reportSelected, onShowReport }: {
  message: ChatMessage;
  reportSelected: boolean;
  onShowReport: (messageId: string) => void;
}) {
  const isUser = message.role === "USER";
  const analysis = isUser ? null : message.analysis;
  const risk = analysis?.risk_level;

  return (
    <article className="vbg-custom-message" data-role={isUser ? "user" : "assistant"}>
      <span className="vbg-label vbg-custom-speaker">{isUser ? "You" : "ThreatGuard"}</span>
      <div className="vbg-custom-response" data-risk={risk}>
        {analysis && (
          <>
            <p className="vbg-label">Threat level: {risk?.toLowerCase()}</p>
            <p className="vbg-custom-reason">{verdict(analysis)}</p>
          </>
        )}
        <p className="vbg-custom-message-copy">{message.content}</p>
        {analysis && <Assessment analysis={analysis} />}
        {Boolean(analysis?.virustotal_reports?.length) && (
          <button
            type="button"
            aria-controls="reputation-panel"
            aria-pressed={reportSelected}
            onClick={() => onShowReport(message.id)}
            className="vbg-label vbg-custom-quiet-action vbg-custom-report-action"
          >
            View VirusTotal report <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
    </article>
  );
}

interface ConversationProps {
  messages: ChatMessage[];
  busy: boolean;
  hasTitle: boolean;
  onChooseExample: (message: string) => void;
  selectedReportId?: string;
  onShowReport: (messageId: string) => void;
}

export function Conversation({ messages, busy, hasTitle, onChooseExample, selectedReportId, onShowReport }: ConversationProps) {
  const thread = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    const Heading = hasTitle ? "h2" : "h1";
    return (
      <section className="vbg-custom-opening">
        <Heading className="vbg-title">Check a link or message for threats</Heading>
        <p className="vbg-lede">Analyze phishing signs in a link or email, or scan a file for malware.</p>
        <div className="vbg-custom-examples">
          {examples.map(({ label, message }) => (
            <button key={label} type="button" className="vbg-label vbg-custom-quiet-action"
              onClick={() => onChooseExample(message)} disabled={busy}>
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="workspace" ref={thread} className="vbg-custom-thread" aria-label="Conversation messages">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} reportSelected={message.id === selectedReportId} onShowReport={onShowReport} />
      ))}
    </section>
  );
}
