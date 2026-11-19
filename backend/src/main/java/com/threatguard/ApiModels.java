package com.threatguard;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

final class ApiModels {
    private ApiModels() {}

    enum IncidentType { PHISHING, MALICIOUS_URL, SUSPICIOUS_EMAIL, UNKNOWN }
    enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL, UNKNOWN }
    enum Confidence { LOW, MEDIUM, HIGH }
    enum ScanStatus {
        @JsonProperty("threat_detected") THREAT_DETECTED,
        @JsonProperty("no_threats_detected") NO_THREATS_DETECTED,
        @JsonProperty("scan_incomplete") SCAN_INCOMPLETE
    }
    enum VirusTotalStatus {
        @JsonProperty("report_found") REPORT_FOUND,
        @JsonProperty("no_existing_report") NO_EXISTING_REPORT,
        @JsonProperty("rate_limited") RATE_LIMITED,
        @JsonProperty("unavailable") UNAVAILABLE,
        @JsonProperty("unconfigured") UNCONFIGURED,
        @JsonProperty("skipped_ineligible_url") SKIPPED_INELIGIBLE_URL
    }
    enum VirusTotalCategory {
        @JsonProperty("malicious") MALICIOUS,
        @JsonProperty("suspicious") SUSPICIOUS
    }

    record FileScan(
            @NotNull ScanStatus status,
            @Pattern(regexp = "[a-f0-9]{64}") String sha256,
            String signature,
            String detail
    ) {}

    record CreateChat(@Schema(example = "Phishing triage") @Size(max = 160) String title) {}
    record SendMessage(
            @Schema(example = "An email says I must verify my password immediately. Is it phishing?")
            @NotBlank @Size(max = 8_000) String content
    ) {}

    record Chat(
            UUID id, String title, String summary,
            @JsonProperty("created_at") OffsetDateTime createdAt,
            @JsonProperty("updated_at") OffsetDateTime updatedAt
    ) {}
    record Message(
            UUID id, @JsonProperty("conversation_id") UUID conversationId, MessageRole role, String content,
            @JsonProperty("created_at") OffsetDateTime createdAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) Analysis analysis
    ) {}
    record Incident(
            UUID id, @JsonProperty("conversation_id") UUID conversationId,
            @JsonProperty("message_id") UUID messageId, @JsonProperty("created_at") OffsetDateTime createdAt,
            Analysis analysis
    ) {}
    record Turn(
            @JsonProperty("user_message") Message userMessage,
            @JsonProperty("assistant_message") Message assistantMessage,
            Analysis analysis, Incident incident
    ) {}

    record ContextMessage(MessageRole role, String content) {}
    record AiRequest(String message, String summary, @JsonProperty("recent_messages") List<ContextMessage> recentMessages) {}
    record VirusTotalVendor(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 120) String verdict,
            @NotNull VirusTotalCategory category
    ) {}
    record VirusTotalReport(
            @NotBlank @Size(max = 2_048) String url,
            @NotBlank @Size(max = 253) String hostname,
            @NotNull VirusTotalStatus status,
            @NotNull @PositiveOrZero Integer malicious,
            @NotNull @PositiveOrZero Integer suspicious,
            @PositiveOrZero Integer harmless,
            @NotNull @PositiveOrZero Integer total,
            @JsonProperty("last_analysis_date") @PositiveOrZero Long lastAnalysisDate,
            @JsonProperty("report_id") @Pattern(regexp = "[a-f0-9]{64}") String reportId,
            @NotNull @Size(max = 128) List<@NotNull @Valid VirusTotalVendor> vendors
    ) {}
    record Analysis(
            @NotBlank @Size(max = 12_000) String message,
            @JsonProperty("incident_detected") @NotNull Boolean incidentDetected,
            @JsonProperty("incident_type") IncidentType incidentType,
            @JsonProperty("risk_level") @NotNull RiskLevel riskLevel,
            @NotNull Confidence confidence,
            @JsonProperty("submitted_url") String submittedUrl,
            @NotNull List<@NotBlank String> evidence,
            @NotNull List<@NotBlank String> recommendations,
            @JsonProperty("tool_results") @NotNull Map<@NotBlank String, @NotBlank String> toolResults,
            @JsonProperty("virustotal_reports") @JsonInclude(JsonInclude.Include.NON_EMPTY)
            @Size(max = 3) List<@NotNull @Valid VirusTotalReport> virusTotalReports
    ) {}
}
