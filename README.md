Project overview
Antinious is a web app for chatting about suspicious messages and links, reviewing URL reputation, and scanning files for malware. Its main services are a Next.js frontend, a Spring Boot backend, a Python AI service, PostgreSQL, and ClamAV.
Browser → Next.js frontend → Spring Boot API → Python AI service → DeepSeek
                                      ↘ PostgreSQL
Python AI service → VirusTotal (optional)
Spring Boot API → ClamAV (file scans)
Frontend
The frontend is in frontend/, built with Next.js and React. It provides the chat interface, conversation history, file upload, theme switch, and VirusTotal report panel.

The useChat hook loads and updates conversations through frontend/lib/api.ts. When you send a message, it displays your message immediately, sends the request to the backend, and shows a loading bubble while it waits. The frontend enforces a three-second minimum loading time so fast responses still show the indicator.

During local development, Next.js runs at http://127.0.0.1:3000 and forwards API requests to the backend at port 8080. In the Docker deployment, the frontend is built as static files and served by Spring Boot.
Spring Boot backend
The Java backend in backend/ serves the application and handles chat APIs, file-scan uploads, and database access.

Chat requests go through ChatController to ChatStore. The store saves messages, gathers recent conversation context, and calls the AI service through AiClient. Once it receives the analysis, it saves the assistant reply and its analysis. It also records an incident if the analysis marks a threat as detected.

Conversation and message data live in PostgreSQL. The API supports creating, listing, opening, and deleting chats, and loading their messages. Message submissions accept an idempotency key so retrying a request does not create a duplicate response.
Python AI service
The FastAPI service in ai-service/ analyzes chat messages and URLs. It uses local heuristics to identify phishing indicators and examine URL characteristics, then asks DeepSeek for a response and structured threat assessment. Its prompt directs the model to assess threats in the current message, so ordinary conversation and general questions do not receive a threat assessment solely because earlier messages discussed one.

For URLs, the service can query VirusTotal when VIRUSTOTAL_API_KEY is configured. It only looks up eligible public URLs, uses cached results, and includes report details when available. The frontend shows the VirusTotal panel only when an assistant response includes a usable report.
File scanning
File uploads go from the frontend to Spring Boot, then to the AI service’s scanner, which communicates with ClamAV. The result reports whether a threat was detected, no threat was detected, or the scan could not be completed. The frontend limits uploads to 20 MiB.
Running locally
With Docker Compose, the project starts the backend, AI service, PostgreSQL, and ClamAV together. For running without Docker, PostgreSQL and ClamAV need to be installed and started separately, alongside the Java backend, Python AI service, and Next.js frontend.