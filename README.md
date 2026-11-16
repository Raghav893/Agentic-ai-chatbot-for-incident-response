# ThreatGuard AI --- Agentic AI Incident Response Chatbot

> **ThreatGuard AI** is an MVP conversational security assistant that
> helps users investigate suspicious URLs, emails, and messages. It uses
> an AI agent with controlled tool calling, conversation-level context
> management, and threat-intelligence lookups to explain potential risks
> and recommend safe actions.

**Project scope:** MVP / learning project --- not production-grade
security software.

------------------------------------------------------------------------

## Table of Contents

-   [1. Project Overview](#1-project-overview)
-   [2. Example User Experience](#2-example-user-experience)
-   [3. MVP Features](#3-mvp-features)
-   [4. Technology Stack](#4-technology-stack)
-   [5. High-Level System
    Architecture](#5-high-level-system-architecture)
-   [6. Message Flow](#6-message-flow)
-   [7. Agentic AI Architecture](#7-agentic-ai-architecture)
-   [8. Context Management](#8-context-management)
-   [9. Database Design](#9-database-design)
-   [10. API Design](#10-api-design)
-   [11. Project Folder Structure](#11-project-folder-structure)
-   [12. Development Roadmap](#12-development-roadmap)
-   [13. MVP Scope and Exclusions](#13-mvp-scope-and-exclusions)
-   [14. Important Architectural
    Decisions](#14-important-architectural-decisions)
-   [15. Security and Limitations](#15-security-and-limitations)

------------------------------------------------------------------------

## 1. Project Overview

ThreatGuard AI is a conversational AI incident-response assistant. A
user can submit a suspicious link, email, or message and ask the chatbot
whether it may be malicious or a phishing attempt.

The system analyzes the submitted content, optionally calls external
threat-intelligence services, evaluates the available evidence,
classifies the risk, and explains what the user should do next.

### Primary use cases

1.  Submit a suspicious URL for analysis.
2.  Submit a suspicious email or message.
3.  Ask whether a message appears to be a phishing attempt.
4.  Ask follow-up questions about a previously analyzed incident.
5.  Retrieve previous analysis and recommended incident-response
    actions.
6.  Maintain multiple independent conversations for each user.

### Example interaction

**User:**

> Someone sent me this link. Is it safe?\
> `https://secure-banking-verify.example.com`

**ThreatGuard AI:**

> **Potential phishing**
>
> The submitted URL has suspicious characteristics:
>
> -   The URL uses banking-related terminology.
> -   The domain structure may resemble a brand-impersonation attempt.
> -   The destination has not been verified as legitimate.
>
> **Recommended action:** Do not enter credentials or personal
> information. Verify the website using the bank's official domain.

This is an illustrative response, not a real scan result. The
application must distinguish verified threat-intelligence findings from
heuristic indicators and unavailable data.

------------------------------------------------------------------------

## 2. Example User Experience

The application will provide a familiar chat interface:

-   A user signs in.
-   The user creates a new conversation or opens an existing one.
-   The user submits a URL, email, message, or security question.
-   The assistant analyzes the message.
-   The assistant explains its findings and recommended actions.
-   The conversation is saved and can be continued later.

Each conversation has its own history and context. A user's separate
conversations must not share conversation-specific context.

------------------------------------------------------------------------

## 3. MVP Features

### Core functionality

-   Multiple users with JWT authentication.
-   Multiple independent conversations per user.
-   Persistent chat history.
-   Conversation-level context management.
-   AI-powered phishing and suspicious-message analysis.
-   URL parsing and heuristic analysis.
-   URL reputation lookup through VirusTotal.
-   Agent tool selection and tool calling.
-   Risk classification.
-   Incident findings and recommendations.
-   Chat history retrieval.

### Initial risk levels

The risk classifier will return one of the following:

-   `LOW`
-   `MEDIUM`
-   `HIGH`
-   `CRITICAL`
-   `UNKNOWN` (when evidence is insufficient or unavailable)

The assistant must not treat an unavailable reputation result as proof
that a URL is safe.

------------------------------------------------------------------------

## 4. Technology Stack

  -----------------------------------------------------------------------
  Component               Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js                 Chat interface, login,
                                                  conversation history

  Main backend            Java + Spring Boot      Authentication, users,
                                                  chats, messages,
                                                  incidents

  AI service              Python + FastAPI        AI orchestration, tool
                                                  calling, analysis

  LLM                     OpenAI API              Reasoning,
                                                  classification
                                                  assistance, response
                                                  generation

  Database                PostgreSQL              Users, conversations,
                                                  messages, summaries,
                                                  incidents

  Context management      PostgreSQL              Conversation history
                                                  and summaries

  Threat intelligence     VirusTotal API          URL reputation lookup

  Authentication          Spring Security + JWT   Authentication and
                                                  authorization

  Communication           REST APIs               Frontend/backend and
                                                  backend/AI
                                                  communication

  Local environment       Docker Compose          Running the application
                                                  components locally
  -----------------------------------------------------------------------

### Why use Spring Boot and FastAPI?

**Spring Boot** is the primary application backend. It owns users,
authentication, conversations, messages, incident records, and database
operations.

**FastAPI** is a dedicated AI service. It handles prompt construction,
LLM interaction, agent orchestration, tool selection, and security
analysis.

This separation keeps the application backend independent from the AI
implementation while avoiding unnecessary microservices.

PostgreSQL is sufficient for the MVP. Redis, a vector database, and a
message broker are not required initially.

------------------------------------------------------------------------

## 5. High-Level System Architecture

``` mermaid
flowchart TD
    U[User] --> FE[Next.js Frontend]
    FE -->|REST API + JWT| BE[Spring Boot Backend]

    BE --> AUTH[Authentication and Authorization]
    BE --> CHAT[Chat and Message Management]
    BE --> CTX[Conversation Context Retrieval]
    BE --> DB[(PostgreSQL)]

    BE -->|Internal REST Request| AI[FastAPI AI Service]

    AI --> ORCH[Agent Orchestrator]
    ORCH --> INTENT[Intent Detection]
    ORCH --> CONTEXT[Context Builder]
    ORCH --> SELECT[Tool Selection]

    SELECT --> URL[URL Analyzer]
    SELECT --> VT[VirusTotal Checker]
    SELECT --> PHISH[Phishing Detector]
    SELECT --> RISK[Risk Classifier]

    URL --> EVAL[LLM Evaluation]
    VT --> EVAL
    PHISH --> EVAL
    RISK --> EVAL

    EVAL --> RESP[Response Generator]
    RESP --> BE
    BE --> DB
    BE --> FE
```

### Component responsibilities

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  Next.js                             Chat UI, authentication screens,
                                      chat list, message rendering

  Spring Boot                         User management, JWT validation,
                                      chat ownership, message persistence

  Context retrieval                   Fetch relevant messages and
                                      conversation summary

  FastAPI                             Receive AI requests and coordinate
                                      the agent workflow

  Agent orchestrator                  Decide which analysis steps and
                                      tools are needed

  AI tools                            Perform URL, phishing, reputation,
                                      and risk analysis

  PostgreSQL                          Persist application and
                                      conversation data

  VirusTotal                          Provide external URL reputation
                                      information
  -----------------------------------------------------------------------

### Ownership boundary

Spring Boot is the source of truth for application data. FastAPI
receives the relevant message and context for processing; it does not
independently own users or chat history.

------------------------------------------------------------------------

## 6. Message Flow

Consider this user message:

> Check whether `https://example.com/login` is phishing.

The request follows this pipeline:

``` mermaid
sequenceDiagram
    actor User
    participant UI as Next.js
    participant BE as Spring Boot
    participant DB as PostgreSQL
    participant AI as FastAPI
    participant Agent as Agent Orchestrator
    participant Tools as Analysis Tools
    participant LLM as LLM

    User->>UI: Submit message
    UI->>BE: POST /api/chats/{chatId}/messages
    BE->>BE: Validate JWT and chat ownership
    BE->>DB: Save user message
    BE->>DB: Retrieve summary and recent messages
    DB-->>BE: Conversation context
    BE->>AI: Send message and context
    AI->>Agent: Process request
    Agent->>Agent: Detect intent and select tools
    Agent->>Tools: Analyze URL and check reputation
    Tools-->>Agent: Return analysis results
    Agent->>LLM: Provide evidence and context
    LLM-->>Agent: Generate assessment
    Agent-->>AI: Return structured response
    AI-->>BE: Return AI result
    BE->>DB: Save assistant response and incident
    BE-->>UI: Return response
    UI-->>User: Display analysis
```

### Step-by-step explanation

1.  **User sends a message.** Next.js sends a POST request to Spring
    Boot containing the chat ID and message.
2.  **Authentication and validation.** Spring Security validates the
    JWT. The backend verifies that the requested conversation belongs to
    the authenticated user.
3.  **Save user message.** Store the incoming message in PostgreSQL.
4.  **Retrieve conversation context.** Fetch the current conversation's
    summary and recent messages.
5.  **Call the AI service.** Spring Boot forwards the message and
    relevant context to FastAPI.
6.  **Detect intent.** The AI service determines whether the user is
    asking for URL analysis, phishing investigation, a follow-up, or a
    general security explanation.
7.  **Select tools.** If the message contains a URL, the agent may
    select the URL analyzer and threat-intelligence checker.
8.  **Execute tools.** Tools inspect URL characteristics and retrieve
    available reputation information.
9.  **Evaluate evidence.** The LLM uses the tool outputs and
    conversation context to formulate an assessment.
10. **Return AI response.** FastAPI returns a structured result to
    Spring Boot.
11. **Persist the result.** Spring Boot saves the assistant response
    and, when applicable, a structured incident record.
12. **Display the response.** Spring Boot returns the result to Next.js,
    which renders it in the chat.

------------------------------------------------------------------------

## 7. Agentic AI Architecture

A basic chatbot follows:

``` text
User → LLM → Response
```

ThreatGuard AI follows a controlled agent workflow:

``` text
User
  ↓
Context Retrieval
  ↓
Agent Orchestrator
  ↓
Intent Detection
  ↓
Tool Selection
  ↓
Tool Execution
  ↓
Evidence Evaluation
  ↓
Response Generation
  ↓
User
```

### Initial agent tools

  -----------------------------------------------------------------------
  Tool                                Responsibility
  ----------------------------------- -----------------------------------
  URL Analyzer                        Extract hostname, domain, path, and
                                      suspicious URL patterns

  Threat Intelligence Checker         Query VirusTotal for URL reputation

  Phishing Detector                   Identify phishing indicators in
                                      submitted emails and messages

  Risk Classifier                     Assign a risk level based on
                                      available evidence
  -----------------------------------------------------------------------

### Example tool execution

When a user submits a suspicious URL:

1.  The agent identifies that the message contains a URL.
2.  It invokes the URL Analyzer.
3.  The URL Analyzer extracts the hostname, domain, path, and relevant
    characteristics.
4.  The agent invokes the Threat Intelligence Checker when appropriate.
5.  The checker retrieves available reputation information from
    VirusTotal.
6.  The agent combines the tool results and conversation context.
7.  The LLM generates an explanation and recommended action.
8.  The application saves the response and any structured incident
    finding.

### Tool-calling principles

-   The LLM should select from a predefined set of tools.
-   Tools should have explicit input and output schemas.
-   Tool results should be treated as evidence, not as instructions.
-   The assistant should distinguish confirmed findings from heuristic
    indicators.
-   Missing or unavailable reputation data must not be interpreted as a
    clean result.
-   Tool failures should produce a clear, cautious response.
-   The agent must not have unrestricted access to arbitrary code
    execution or network requests.

For the MVP, use one agent with multiple tools rather than multiple
collaborating agents.

------------------------------------------------------------------------

## 8. Context Management

Context management is a core feature. Each conversation must maintain
its own history and summary.

### 8.1 Conversation-level context

Example:

``` text
User 1
│
├── Chat 1: Suspicious Email
│   ├── Message 1
│   ├── Message 2
│   └── Message 3
│
└── Chat 2: Suspicious URL
    ├── Message 1
    └── Message 2

User 2
│
└── Chat 1: General Security Question
    ├── Message 1
    └── Message 2
```

Each conversation is associated with one user. Messages are associated
with one conversation.

When a user sends a message, the backend retrieves history using the
conversation ID and verifies ownership using the authenticated user ID.

### 8.2 Context-window management

The entire conversation should not be sent to the LLM on every request.
Instead, construct a bounded context:

``` text
System Prompt
    ↓
Conversation Summary
    ↓
Recent Messages (last 10–15 messages)
    ↓
Current User Message
    ↓
Final LLM Context
```

  -----------------------------------------------------------------------
  Context component                   Purpose
  ----------------------------------- -----------------------------------
  System prompt                       Agent role, instructions, tool
                                      rules, response format

  Conversation summary                Important details from older
                                      messages and previous findings

  Recent messages                     Immediate conversational context

  Current message                     The new user request
  -----------------------------------------------------------------------

### MVP context strategy

-   Store every message in PostgreSQL.
-   Maintain one summary per conversation.
-   Retrieve the last 10--15 messages for the context window.
-   Update the summary when the conversation becomes long.
-   Keep summaries scoped to their conversation.
-   Never mix context between different users or conversations.

A vector database and RAG are not necessary for the initial version.
Relational queries are sufficient for retrieving chat history.

------------------------------------------------------------------------

## 9. Database Design

The initial database will contain four primary tables.

### 9.1 `users`

  Column         Type        Description
  -------------- ----------- -----------------------
  `id`           UUID        Primary key
  `name`         VARCHAR     User name
  `email`        VARCHAR     Unique email
  `password`     VARCHAR     Hashed password
  `created_at`   TIMESTAMP   Account creation time

Passwords must be stored as secure password hashes, never as plain text.

### 9.2 `conversations`

  Column         Type        Description
  -------------- ----------- ------------------------------
  `id`           UUID        Primary key
  `user_id`      UUID        Foreign key to users
  `title`        VARCHAR     Conversation title
  `summary`      TEXT        Conversation context summary
  `created_at`   TIMESTAMP   Creation time
  `updated_at`   TIMESTAMP   Last update time

### 9.3 `messages`

  Column              Type        Description
  ------------------- ----------- ------------------------------
  `id`                UUID        Primary key
  `conversation_id`   UUID        Foreign key to conversations
  `role`              VARCHAR     USER, ASSISTANT, or SYSTEM
  `content`           TEXT        Message content
  `created_at`        TIMESTAMP   Message creation time

### 9.4 `incidents`

This table stores structured security findings separately from normal
chat messages.

  Column              Type        Description
  ------------------- ----------- --------------------------------------
  `id`                UUID        Primary key
  `conversation_id`   UUID        Foreign key to conversations
  `message_id`        UUID        Related message
  `incident_type`     VARCHAR     Type of security incident
  `submitted_url`     TEXT        Submitted URL, if applicable
  `risk_level`        VARCHAR     LOW, MEDIUM, HIGH, CRITICAL, UNKNOWN
  `analysis`          TEXT        Analysis summary
  `created_at`        TIMESTAMP   Finding creation time

Initial incident types:

-   `PHISHING`
-   `MALICIOUS_URL`
-   `SUSPICIOUS_EMAIL`
-   `UNKNOWN`

### Entity relationships

``` mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : owns
    CONVERSATIONS ||--o{ MESSAGES : contains
    CONVERSATIONS ||--o{ INCIDENTS : records
    MESSAGES ||--o{ INCIDENTS : relates_to

    USERS {
        UUID id PK
        VARCHAR name
        VARCHAR email
        VARCHAR password
        TIMESTAMP created_at
    }

    CONVERSATIONS {
        UUID id PK
        UUID user_id FK
        VARCHAR title
        TEXT summary
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    MESSAGES {
        UUID id PK
        UUID conversation_id FK
        VARCHAR role
        TEXT content
        TIMESTAMP created_at
    }

    INCIDENTS {
        UUID id PK
        UUID conversation_id FK
        UUID message_id FK
        VARCHAR incident_type
        TEXT submitted_url
        VARCHAR risk_level
        TEXT analysis
        TIMESTAMP created_at
    }
```

------------------------------------------------------------------------

## 10. API Design

### 10.1 Spring Boot APIs

  --------------------------------------------------------------------------------
  Method                  Endpoint                         Responsibility
  ----------------------- -------------------------------- -----------------------
  POST                    `/api/auth/register`             Register a user

  POST                    `/api/auth/login`                Authenticate a user

  GET                     `/api/chats`                     Get the authenticated
                                                           user's chats

  POST                    `/api/chats`                     Create a conversation

  GET                     `/api/chats/{chatId}`            Get a conversation

  DELETE                  `/api/chats/{chatId}`            Delete a conversation

  POST                    `/api/chats/{chatId}/messages`   Send a message

  GET                     `/api/chats/{chatId}/messages`   Retrieve conversation
                                                           messages

  GET                     `/api/incidents/{id}`            Get incident details
  --------------------------------------------------------------------------------

Every chat and message endpoint must enforce conversation ownership.
Knowing or guessing a chat ID must not grant access to another user's
data.

### 10.2 FastAPI internal APIs

  -----------------------------------------------------------------------
  Method                  Endpoint                Responsibility
  ----------------------- ----------------------- -----------------------
  POST                    `/ai/chat`              Process a message with
                                                  context and agent
                                                  orchestration

  POST                    `/ai/analyze-url`       Analyze a URL

  POST                    `/ai/analyze-email`     Analyze an email
  -----------------------------------------------------------------------

Spring Boot calls `/ai/chat` for normal chat messages. The agent decides
which tools to invoke.

The FastAPI service should be treated as an internal service and should
not be exposed as an unauthenticated public endpoint.

------------------------------------------------------------------------

## 11. Project Folder Structure

Use a monorepo with separate frontend, backend, and AI-service
directories.

``` text
threatguard-ai/
│
├── frontend/
│   └── Next.js application
│
├── backend/
│   └── src/main/java/com/threatguard/
│       │
│       ├── config/
│       ├── security/
│       │
│       ├── auth/
│       │   ├── controller/
│       │   ├── service/
│       │   ├── dto/
│       │   └── entity/
│       │
│       ├── chat/
│       │   ├── controller/
│       │   ├── service/
│       │   ├── repository/
│       │   ├── entity/
│       │   └── dto/
│       │
│       ├── message/
│       │   ├── service/
│       │   ├── repository/
│       │   └── entity/
│       │
│       ├── incident/
│       │   ├── controller/
│       │   ├── service/
│       │   ├── repository/
│       │   └── entity/
│       │
│       ├── ai/
│       │   ├── client/
│       │   ├── service/
│       │   └── dto/
│       │
│       └── ThreatGuardApplication.java
│
├── ai-service/
│   │
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── agent/
│   │   │   ├── orchestrator.py
│   │   │   ├── prompt_manager.py
│   │   │   └── tool_selector.py
│   │   │
│   │   ├── tools/
│   │   │   ├── url_analyzer.py
│   │   │   ├── virustotal.py
│   │   │   ├── phishing_detector.py
│   │   │   └── risk_classifier.py
│   │   │
│   │   ├── context/
│   │   │   ├── context_builder.py
│   │   │   └── summarizer.py
│   │   │
│   │   ├── llm/
│   │   │   └── client.py
│   │   │
│   │   └── schemas/
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

------------------------------------------------------------------------

## 12. Development Roadmap

The project will be developed in 12 steps. Build and verify each layer
before moving to the next.

  -----------------------------------------------------------------------
  Step                    Development task        Deliverable
  ----------------------- ----------------------- -----------------------
  1                       Project setup and       Monorepo, Spring Boot,
                          architecture            FastAPI, PostgreSQL

  2                       User authentication     Registration, login,
                                                  JWT

  3                       Chat management         Create, retrieve, and
                                                  delete conversations

  4                       Message management      Send and persist
                                                  messages

  5                       Context management      Retrieve history and
                                                  maintain summaries

  6                       AI service integration  Spring Boot ↔ FastAPI
                                                  communication

  7                       Basic AI chatbot        LLM responses with
                                                  conversation context

  8                       Agent orchestration     Intent detection and
                                                  tool selection

  9                       Security analysis tools URL analyzer, phishing
                                                  detector, VirusTotal

  10                      Incident response       Risk classification and
                                                  recommendations

  11                      Frontend integration    Chat UI, chat history,
                                                  incident reports

  12                      Docker and testing      Docker Compose and
                                                  end-to-end testing
  -----------------------------------------------------------------------

### Recommended implementation order

Do not start by building the complete agent.

First build a working multi-user chatbot. Then add context management.
After that, introduce agent orchestration and security-analysis tools.

This makes the project easier to develop, test, and debug.

------------------------------------------------------------------------

## 13. MVP Scope and Exclusions

### Included in the MVP

-   [x] Multiple users with JWT authentication
-   [x] Multiple independent conversations per user
-   [x] Persistent chat history
-   [x] Conversation-level context management
-   [x] AI-powered phishing analysis
-   [x] URL reputation checking
-   [x] Agent tool calling
-   [x] Risk classification
-   [x] Incident analysis and recommendations

### Explicitly excluded from the MVP

-   [ ] Autonomous remediation of security incidents
-   [ ] SIEM integration
-   [ ] Enterprise security dashboards
-   [ ] Real-time security monitoring
-   [ ] Multi-agent collaboration
-   [ ] Vector databases and RAG
-   [ ] Kubernetes and microservices
-   [ ] Complex production-grade infrastructure

The goal is to demonstrate a functional agentic AI incident-response
workflow without overengineering the application.

------------------------------------------------------------------------

## 14. Important Architectural Decisions

### 1. Spring Boot owns users and conversations

Spring Boot is the source of truth for authentication, users,
conversations, messages, and incident persistence. FastAPI should not
independently manage the same entities.

### 2. The agent owns investigation, not application persistence

The AI agent is responsible for interpreting the request, selecting
tools, evaluating evidence, and generating a response. Spring Boot
remains responsible for saving application data.

### 3. Context belongs to a conversation

Conversation context must be scoped to a specific conversation, not
simply to a user. This prevents unrelated chats from influencing one
another.

### 4. Start with one agent and multiple tools

A single orchestrator with a controlled set of tools is sufficient for
this MVP. Multiple collaborating agents would add complexity without
being necessary for the initial requirements.

### 5. Avoid unnecessary infrastructure

Start with Spring Boot, FastAPI, PostgreSQL, and Docker Compose. Do not
introduce Redis, Kafka, Kubernetes, vector databases, or microservices
unless a real requirement emerges.

------------------------------------------------------------------------

## 15. Security and Limitations

This is an MVP and should not be treated as a production-grade security
product.

Important safeguards:

-   Never store plaintext passwords.
-   Verify JWT authentication and conversation ownership on every
    relevant endpoint.
-   Do not trust user-submitted URLs or content.
-   Do not directly open or fetch arbitrary submitted URLs from the
    backend.
-   Use reputation APIs and safe parsing rather than unrestricted URL
    navigation.
-   Account for URL redirects, malformed URLs, and parser edge cases
    when analyzing links.
-   Treat external API results and submitted content as untrusted data.
-   Never allow content inside a suspicious email or webpage to override
    the agent's system instructions.
-   Keep API keys in environment variables; never commit secrets.
-   Handle external API timeouts, rate limits, and unavailable results.
-   Do not claim a link is safe merely because no threat was detected.
-   Clearly communicate uncertainty and distinguish heuristic indicators
    from confirmed threat-intelligence findings.

### Suggested response structure

The AI service should return a structured result that Spring Boot can
persist and the frontend can render.

Example:

``` json
{
  "message": "The URL has suspicious characteristics.",
  "incident_detected": true,
  "incident_type": "PHISHING",
  "risk_level": "HIGH",
  "confidence": "MEDIUM",
  "evidence": [
    "Suspicious domain structure",
    "Brand-impersonation indicators"
  ],
  "recommendations": [
    "Do not enter credentials",
    "Verify the domain through the official website"
  ],
  "tool_results": {
    "url_analyzer": "completed",
    "virustotal": "unavailable"
  }
}
```

This is an illustrative response contract. The final schema should be
defined and validated with Pydantic in FastAPI and corresponding DTOs in
Spring Boot.

------------------------------------------------------------------------

## Final Project Direction

ThreatGuard AI will be a **multi-user, context-aware, agentic AI
incident-response chatbot**.

The core architecture is:

``` text
Next.js
   ↓
Spring Boot
   ↓
FastAPI AI Service
   ↓
Agent Orchestrator
   ↓
Security Analysis Tools
   ↓
LLM Evaluation
   ↓
Response
```

Spring Boot owns application data and conversation management. FastAPI
owns AI orchestration and analysis. PostgreSQL stores users,
conversations, messages, summaries, and incidents.

The project will be built incrementally in the 12 development steps
above, keeping the initial implementation intentionally simple and
focused on demonstrating agentic AI, tool calling, and context
management.