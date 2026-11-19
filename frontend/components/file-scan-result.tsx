import { useId } from "react";
import type { FileScanReport } from "../hooks/use-file-scan";

const verdicts = {
  pending: { label: "Scanning file…", risk: undefined },
  threat_detected: { label: "Threat detected", risk: "HIGH" },
  no_threats_detected: { label: "No threats detected", risk: "LOW" },
  scan_incomplete: { label: "Scan incomplete", risk: "MEDIUM" },
};

export function FileScanResult({ report, onDismiss }: {
  report: FileScanReport | null;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const verdict = report ? verdicts[report.status] : null;
  const result = report?.status === "pending" ? null : report;
  const announcement = [verdict?.label, report?.name, result?.detail].filter(Boolean).join(". ");

  return (
    <>
      {report && verdict && (
        <section aria-labelledby={titleId} className="vbg-custom-scan-result" data-risk={verdict.risk}>
          <div className="vbg-custom-result-header">
            <h2 id={titleId} className="vbg-heading-16">{verdict.label}</h2>
            {result && <button className="vbg-label vbg-custom-quiet-action" type="button" onClick={onDismiss}>Dismiss</button>}
          </div>
          <p className="vbg-label">{report.name}</p>
          {result?.detail && <p className="vbg-caption">{result.detail}</p>}
          {(result?.signature || result?.sha256) && (
            <dl className="vbg-custom-scan-evidence">
              {result.signature && (
                <>
                  <dt className="vbg-label">Signature</dt>
                  <dd><code className="vbg-mono vbg-custom-identifier">{result.signature}</code></dd>
                </>
              )}
              {result.sha256 && (
                <>
                  <dt className="vbg-label">SHA-256</dt>
                  <dd><code className="vbg-mono vbg-custom-identifier">{result.sha256}</code></dd>
                </>
              )}
            </dl>
          )}
        </section>
      )}
      <p className="vbg-visually-hidden" role="status">{announcement}</p>
    </>
  );
}
