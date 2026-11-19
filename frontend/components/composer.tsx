"use client";

import { useRef } from "react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";

import { useFileScan } from "../hooks/use-file-scan";
import type { ChatStatus } from "../lib/types";
import { FileScanResult } from "./file-scan-result";

type ComposerProps = {
  draft: string;
  busy: boolean;
  status: ChatStatus | null;
  draftRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export function Composer({ draft, busy, status, draftRef, onDraftChange, onSubmit }: ComposerProps) {
  const { report, scanFile, dismissScan } = useFileScan();
  const scanInput = useRef<HTMLInputElement>(null);
  const scanButton = useRef<HTMLButtonElement>(null);
  const scanning = report?.status === "pending";
  const canSend = !busy && Boolean(draft.trim());

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSubmit();
  }

  function handleShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div>
      <FileScanResult report={report} onDismiss={() => {
        dismissScan();
        scanButton.current?.focus();
      }} />
      <form className="vbg-custom-composer" onSubmit={submit}>
        <div className="vbg-custom-field">
          <label className="vbg-label" htmlFor="draft">Message to analyze</label>
          <textarea
            id="draft"
            ref={draftRef}
            rows={2}
            maxLength={8000}
            placeholder="Paste a suspicious message or URL…"
            value={draft}
            disabled={busy}
            required
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleShortcut}
          />
        </div>
        <div className="vbg-custom-composer-actions">
          <button
            ref={scanButton}
            type="button"
            aria-disabled={scanning}
            className="vbg-label vbg-custom-quiet-action"
            onClick={() => {
              if (!scanning) scanInput.current?.click();
            }}
          >
            Scan file
          </button>
          <input
            ref={scanInput}
            id="scan-input"
            type="file"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.item(0);
              event.currentTarget.value = "";
              if (file) void scanFile(file);
            }}
          />
          <span className="vbg-caption vbg-custom-shortcut">Shift + Enter for a new line</span>
          <button
            type="submit"
            className="vbg-button"
            disabled={!canSend}
          >
            Send
          </button>
        </div>
      </form>
      <p className={status ? (status.error ? "vbg-caption vbg-custom-error" : "vbg-caption") : "vbg-visually-hidden"} role="status">
        {status?.message}
      </p>
    </div>
  );
}
