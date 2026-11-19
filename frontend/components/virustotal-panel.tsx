"use client";

import { useId, useState } from "react";
import type { VirusTotalReport } from "../lib/types";

const reportStates = {
  no_existing_report: ["No existing report", "VirusTotal has no saved analysis for this URL."],
  rate_limited: ["Lookup limit reached", "Try the URL again after the VirusTotal quota resets."],
  unavailable: ["Report unavailable", "VirusTotal did not return a usable report."],
  unconfigured: ["VirusTotal is not connected", "Set VIRUSTOTAL_API_KEY to enable URL reputation checks."],
  skipped_ineligible_url: ["Lookup skipped", "VirusTotal checks are limited to eligible public URLs."],
} as const;

const analysisTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function DetectionRing({ malicious, suspicious, total }: VirusTotalReport) {
  const flagged = malicious + suspicious;
  const maliciousShare = total > 0 ? Math.min(100, (malicious / total) * 100) : 0;
  const suspiciousShare = total > 0 ? Math.min(100 - maliciousShare, (suspicious / total) * 100) : 0;

  return (
    <div
      className="vbg-custom-detection-viz"
      role="img"
      aria-label={flagged + " of " + total + " security vendors flagged this URL"}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <g fill="none" strokeWidth="8" transform="rotate(-90 60 60)">
          <circle className="vbg-viz-track" cx="60" cy="60" r="52" />
          {maliciousShare > 0 && (
            <circle className="vbg-viz-malicious" cx="60" cy="60" r="52" pathLength="100"
              strokeDasharray={maliciousShare + " " + (100 - maliciousShare)} />
          )}
          {suspiciousShare > 0 && (
            <circle className="vbg-viz-suspicious" cx="60" cy="60" r="52" pathLength="100"
              strokeDasharray={suspiciousShare + " " + (100 - suspiciousShare)} strokeDashoffset={-maliciousShare} />
          )}
        </g>
      </svg>
      <div className="vbg-custom-detection-value" aria-hidden="true">
        <strong>{flagged}</strong>
        <span>of {total}</span>
      </div>
    </div>
  );
}

function VendorResults({ report }: { report: VirusTotalReport }) {
  if (report.vendors.length === 0) {
    return (
      <section>
        <h3 className="vbg-heading-16">Flagged vendors</h3>
        <p className="vbg-caption">
          {report.malicious + report.suspicious > 0 ? "Individual vendor verdicts were unavailable." :
            "No vendors in this report flagged the URL."}
        </p>
      </section>
    );
  }

  return (
    <div className="vbg-table-wrap">
      <table className="vbg-custom-vendor-table">
        <caption className="vbg-heading-16">Flagged vendors</caption>
        <thead>
          <tr><th scope="col">Vendor</th><th scope="col">Verdict</th></tr>
        </thead>
        <tbody>
          {report.vendors.map((vendor, index) => (
            <tr key={vendor.name + index}>
              <th scope="row">{vendor.name}</th>
              <td>
                <span className={vendor.category === "malicious" ? "vbg-custom-vendor-malicious" : "vbg-custom-vendor-suspicious"}>
                  {vendor.verdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportDetails({ report }: { report: VirusTotalReport }) {
  const date = report.last_analysis_date === null ? null : new Date(report.last_analysis_date * 1000);
  const analysisDate = date && Number.isFinite(date.getTime()) ? date : null;
  const reportId = report.report_id && /^[a-f0-9]{64}$/.test(report.report_id) ? report.report_id : null;
  const flagged = report.malicious + report.suspicious;

  return (
    <>
      <figure className="vbg-custom-detection" aria-label="Detection summary">
        <h3 className="vbg-heading-16">Vendor detections</h3>
        <div className="vbg-custom-detection-metrics">
          <DetectionRing {...report} />
          <dl className="vbg-custom-reputation-counts">
            <div><dt className="vbg-label">Malicious</dt><dd className="vbg-numeric">{report.malicious}</dd></div>
            <div><dt className="vbg-label">Suspicious</dt><dd className="vbg-numeric">{report.suspicious}</dd></div>
            {typeof report.harmless === "number" && (
              <div><dt className="vbg-label">Harmless</dt><dd className="vbg-numeric">{report.harmless}</dd></div>
            )}
          </dl>
        </div>
        <figcaption className={flagged ? "vbg-visually-hidden" : "vbg-caption"}>
          {flagged
            ? "The flagged total includes malicious and suspicious verdicts."
            : "Zero detections describe this saved report. Some risks may remain unverified."}
        </figcaption>
      </figure>
      {analysisDate && (
        <div className="vbg-caption">
          Last analyzed <time dateTime={analysisDate.toISOString()}>{analysisTime.format(analysisDate)} UTC</time>
        </div>
      )}
      <VendorResults report={report} />
      {reportId && (
        <p className="vbg-label">
          <a className="vbg-custom-source" href={"https://www.virustotal.com/gui/url/" + reportId}
            target="_blank" rel="noreferrer">
            Open on VirusTotal <span aria-hidden="true">↗</span>
          </a>
        </p>
      )}
    </>
  );
}

function initialReport(reports: VirusTotalReport[]) {
  const available = reports.filter((report) => report.status === "report_found");
  return available.find((report) => report.malicious > 0)
    ?? available.find((report) => report.suspicious > 0)
    ?? available[0]
    ?? reports[0];
}

export function VirusTotalPanel({ reports }: { reports: VirusTotalReport[] }) {
  const selectorId = useId();
  const [selected, setSelected] = useState<VirusTotalReport>();
  const report = selected && reports.includes(selected) ? selected : initialReport(reports);
  if (!report) return null;
  const unavailable = report.status !== "report_found" ? reportStates[report.status] : null;

  return (
    <>
      <header className="vbg-custom-report-header">
        <h2 className="vbg-heading-24">VirusTotal</h2>
      </header>
      <div className="vbg-custom-report-body">
        {reports.length > 1 && (
          <div className="vbg-custom-field">
            <label className="vbg-label" htmlFor={selectorId}>Choose URL report</label>
            <select id={selectorId} value={reports.indexOf(report)}
              onChange={(event) => setSelected(reports[Number(event.target.value)])}>
              {reports.map((item, index) => <option key={item.url + index} value={index}>{item.url}</option>)}
            </select>
          </div>
        )}
        <div className="vbg-custom-report-target">
          <h3 className="vbg-heading-16">{report.hostname}</h3>
          {report.url !== report.hostname && <p dir="ltr"><code className="vbg-mono vbg-custom-identifier">{report.url}</code></p>}
        </div>
        {unavailable ? (
          <section className="vbg-custom-report-unavailable">
            <h3 className="vbg-heading-16">{unavailable[0]}</h3>
            <p className="vbg-caption">{unavailable[1]}</p>
          </section>
        ) : <ReportDetails report={report} />}
      </div>
    </>
  );
}
