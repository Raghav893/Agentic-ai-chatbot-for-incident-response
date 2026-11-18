from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


MessageText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
UrlText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2048)]
IncidentType = Literal["PHISHING", "MALICIOUS_URL", "SUSPICIOUS_EMAIL", "UNKNOWN"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]
Confidence = Literal["LOW", "MEDIUM", "HIGH"]


class ChatMessage(BaseModel):
    role: Literal["USER", "ASSISTANT"]
    content: Annotated[str, StringConstraints(max_length=2000)]


class ChatRequest(BaseModel):
    message: MessageText
    summary: Annotated[str, StringConstraints(max_length=3000)] | None = None
    recent_messages: list[ChatMessage] = Field(default_factory=list, max_length=12)


class UrlRequest(BaseModel):
    url: UrlText = Field(examples=["https://example.com/login"])


class EmailRequest(BaseModel):
    content: MessageText = Field(examples=["Your account will be suspended. Verify your password immediately."])


class ModelAssessment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: MessageText
    incident_detected: bool
    incident_type: IncidentType | None
    risk_level: RiskLevel
    confidence: Confidence
    recommendations: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]] = Field(
        max_length=8
    )


class AnalysisResponse(ModelAssessment):
    submitted_url: UrlText | None
    evidence: list[str]
    tool_results: dict[str, str]
