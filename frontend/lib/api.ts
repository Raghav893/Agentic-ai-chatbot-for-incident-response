import type { ChatMessage, ChatSummary, ChatTurn, FileScan } from "./types";

const chatsPath = "/api/chats";
const pageSize = 100;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (response.status === 204) return undefined as T;

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (result && typeof result === "object" && "detail" in result && typeof result.detail === "string") {
      throw new Error(result.detail);
    }
    if (response.status === 413) throw new Error("Choose a file up to 20 MiB.");
    throw new Error("Request failed (" + response.status + ").");
  }
  if (result === null) throw new Error("The server returned an unreadable response. Try again.");
  return result as T;
}

function post<T>(path: string, body: object, headers?: Record<string, string>): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function loadPages<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  let page: T[];
  do {
    page = await request<T[]>(path + "?limit=" + pageSize + "&offset=" + all.length);
    all.push(...page);
  } while (page.length === pageSize);
  return all;
}

export function listChats() {
  return loadPages<ChatSummary>(chatsPath);
}

export function createChat(title: string) {
  return post<ChatSummary>(chatsPath, { title });
}

export function deleteChat(chatId: string) {
  return request<void>(chatsPath + "/" + chatId, { method: "DELETE" });
}

export function listMessages(chatId: string) {
  return loadPages<ChatMessage>(chatsPath + "/" + chatId + "/messages");
}

export function sendMessage(chatId: string, content: string, key: string) {
  return post<ChatTurn>(chatsPath + "/" + chatId + "/messages", { content }, { "Idempotency-Key": key });
}

export function scanUpload(file: File) {
  const body = new FormData();
  body.append("file", file);
  return request<FileScan>("/api/scans/file", { method: "POST", body });
}
