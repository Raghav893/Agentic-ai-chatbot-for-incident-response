import { useRef, useState } from "react";

import { scanUpload } from "../lib/api";
import type { FileScan } from "../lib/types";

const maxScanBytes = 20 * 1024 * 1024;
const scanStatuses = new Set<FileScan["status"]>([
  "threat_detected",
  "no_threats_detected",
  "scan_incomplete",
]);

export type FileScanReport = { name: string } & (FileScan | { status: "pending" });

function incomplete(name: string, detail: string): FileScanReport {
  return { name, status: "scan_incomplete", detail, signature: null, sha256: null };
}

export function useFileScan() {
  const [report, setReport] = useState<FileScanReport | null>(null);
  const scanInProgress = useRef(false);

  async function scanFile(file: File) {
    if (scanInProgress.current) return;
    if (file.size === 0 || file.size > maxScanBytes) {
      const detail = file.size === 0 ? "Choose a file that is not empty." : "Choose a file up to 20 MiB.";
      setReport(incomplete(file.name, detail));
      return;
    }

    scanInProgress.current = true;
    setReport({ name: file.name, status: "pending" });
    try {
      const result = await scanUpload(file);
      if (!result || !scanStatuses.has(result.status)) {
        throw new Error("The scanner returned an unreadable result. Try again.");
      }
      setReport({
        name: file.name,
        status: result.status,
        signature: typeof result.signature === "string" ? result.signature : null,
        sha256: typeof result.sha256 === "string" ? result.sha256 : null,
        detail: typeof result.detail === "string" ? result.detail : null,
      });
    } catch (error) {
      let detail = "Could not scan the file. Try again.";
      if (error instanceof TypeError) detail = "Could not reach the scanner. Try again.";
      else if (error instanceof Error && error.message) detail = error.message;
      setReport(incomplete(file.name, detail));
    } finally {
      scanInProgress.current = false;
    }
  }

  return { report, scanFile, dismissScan: () => setReport(null) };
}
