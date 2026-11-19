export interface ChatSummary {
  id: string;
  title: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface Analysis {
  risk_level: RiskLevel;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  incident_detected: boolean;
  incident_type?: "PHISHING" | "MALICIOUS_URL" | "SUSPICIOUS_EMAIL" | "UNKNOWN" | null;
  submitted_url?: string | null;
  evidence: string[];
  recommendations: string[];
  virustotal_reports?: VirusTotalReport[];
}

export interface VirusTotalVendor {
  name: string;
  verdict: string;
  category: "malicious" | "suspicious";
}

export interface VirusTotalReport {
  url: string;
  hostname: string;
  status: "report_found" | "no_existing_report" | "rate_limited" | "unavailable" |
    "unconfigured" | "skipped_ineligible_url";
  malicious: number;
  suspicious: number;
  harmless?: number | null;
  total: number;
  last_analysis_date: number | null;
  report_id: string | null;
  vendors: VirusTotalVendor[];
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  analysis?: Analysis | null;
}

export interface ChatTurn {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  analysis: Analysis;
}

export interface ChatStatus {
  message: string;
  error?: boolean;
}

export type FileScanStatus = "threat_detected" | "no_threats_detected" | "scan_incomplete";

export interface FileScan {
  status: FileScanStatus;
  signature: string | null;
  sha256: string | null;
  detail: string | null;
}
