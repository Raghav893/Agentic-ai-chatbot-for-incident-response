"use strict";

const elements = {
  chats: document.querySelector("#chats"),
  title: document.querySelector("#active-title"),
  workspace: document.querySelector("#workspace"),
  welcome: document.querySelector("#welcome"),
  messages: document.querySelector("#messages"),
  form: document.querySelector("#composer"),
  draft: document.querySelector("#draft"),
  status: document.querySelector("#status"),
  newChat: document.querySelector("#new-chat"),
  remove: document.querySelector("#delete-chat"),
  send: document.querySelector("#send"),
  historyToggle: document.querySelector("#history-toggle"),
};

const examples = {
  email: "Subject: Final warning about your mailbox\n\nYour mailbox will be suspended in 30 minutes. Reply with your password and one-time code to keep your account active.\n\nIs this phishing?",
  url: "Please check https://example.com/ for suspicious signs and summarize any existing reputation report.",
};

let chats = [];
let activeChat = null;
let messages = [];
let busy = false;
const retries = new Map();

function make(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Request failed (" + response.status + ").");
  return result;
}

function post(path, body, extraHeaders = {}) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function loadPages(path) {
  const all = [];
  const limit = 100;
  let page;
  do {
    page = await request(path + "?limit=" + limit + "&offset=" + all.length);
    all.push(...page);
  } while (page.length === limit);
  return all;
}

function setHistoryVisible(open) {
  document.body.dataset.history = open ? "open" : "closed";
  elements.historyToggle.setAttribute("aria-expanded", String(open));
}

function updateControls() {
  elements.draft.disabled = busy;
  elements.send.disabled = busy || !elements.draft.value.trim();
  elements.newChat.disabled = busy;
  elements.remove.disabled = busy;
  for (const button of elements.chats.querySelectorAll("button")) button.disabled = busy;
}

function showStatus(text, error = false) {
  elements.status.textContent = text;
  elements.status.hidden = !text;
  elements.status.dataset.error = String(error);
}

async function run(action, progress = "") {
  if (busy) return;
  busy = true;
  updateControls();
  showStatus(progress);
  try {
    await action();
    showStatus("");
  } catch (error) {
    showStatus(error.message || "The request failed. Try again.", true);
  } finally {
    busy = false;
    updateControls();
  }
}

function renderChats() {
  const entries = chats.map(chat => {
    const item = make("li");
    const button = make("button", "chat-button", chat.title);
    button.type = "button";
    button.title = chat.title;
    button.disabled = busy;
    if (chat.id === activeChat?.id) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => run(async () => {
      messages = await loadPages("/api/chats/" + chat.id + "/messages");
      activeChat = chat;
      elements.draft.value = retries.get(chat.id)?.content || "";
      setHistoryVisible(false);
      render();
    }, "Loading conversation…"));
    item.append(button);
    return item;
  });
  if (!entries.length) entries.push(make("li", "empty-list", "No conversations yet"));
  elements.chats.replaceChildren(...entries);
}

function renderAssessment(analysis, target) {
  if (!analysis) return;
  if (analysis.incident_detected || analysis.risk_level !== "UNKNOWN") {
    const properties = make("div", "assessment");
    const risk = make("span", "risk", analysis.risk_level + " risk");
    risk.dataset.level = analysis.risk_level;
    properties.append(risk, make("span", "", analysis.confidence + " confidence"));
    target.append(properties);
  }
  if (!analysis.evidence.length && !analysis.recommendations.length) return;
  const details = make("details", "assessment-details");
  details.append(make("summary", "", "Evidence and next steps"));
  for (const [name, entries] of [["Evidence", analysis.evidence], ["Next steps", analysis.recommendations]]) {
    if (!entries.length) continue;
    const list = make("ul");
    list.append(...entries.map(entry => make("li", "", entry)));
    details.append(make("h3", "", name), list);
  }
  target.append(details);
}

function renderMessages() {
  elements.welcome.hidden = messages.length > 0;
  elements.messages.hidden = messages.length === 0;
  const bubbles = messages.map(message => {
    const isUser = message.role === "USER";
    const bubble = make("article", isUser ? "message user" : "message");
    const body = make("div", "message-body");
    body.append(make("p", "", message.content));
    renderAssessment(message.analysis, body);
    bubble.append(make("span", "message-label", isUser ? "You" : "ThreatGuard"), body);
    return bubble;
  });
  elements.messages.replaceChildren(...bubbles);
  elements.workspace.scrollTop = elements.workspace.scrollHeight;
}

function render() {
  elements.title.textContent = activeChat?.title || "New conversation";
  elements.remove.hidden = !activeChat;
  renderChats();
  renderMessages();
}

function resetChat() {
  activeChat = null;
  messages = [];
  elements.draft.value = "";
  setHistoryVisible(false);
  render();
}

async function sendMessage(content) {
  if (!activeChat) {
    const heading = content.split(/\r?\n/, 1)[0].replace(/^subject:\s*/i, "").trim();
    const characters = Array.from(heading);
    const title = characters.length > 64 ? characters.slice(0, 63).join("").trimEnd() + "…" : heading;
    activeChat = await post("/api/chats", { title });
    chats.unshift(activeChat);
  }
  const chatId = activeChat.id;
  const path = "/api/chats/" + chatId + "/messages";
  const retry = retries.get(chatId);
  const requestKey = retry?.content === content ? retry.key : crypto.randomUUID();
  const optimistic = { role: "USER", content };
  const latest = messages.at(-1);
  const alreadySaved = retry?.content === content && latest?.role === "USER" && latest.content === content;
  if (!alreadySaved) messages.push(optimistic);
  elements.draft.value = "";
  render();

  try {
    const result = await post(path, { content }, { "Idempotency-Key": requestKey });
    messages = messages.filter(message => message !== optimistic && message.id !== result.user_message.id &&
      message.id !== result.assistant_message.id);
    messages.push(result.user_message, { ...result.assistant_message, analysis: result.analysis });
    chats = [activeChat, ...chats.filter(chat => chat.id !== chatId)];
    retries.delete(chatId);
  } catch (error) {
    retries.set(chatId, { content, key: requestKey });
    elements.draft.value = content;
    messages = messages.filter(message => message !== optimistic);
    try {
      messages = await loadPages(path);
    } catch {
      // Keep the last visible history if the server cannot be reached.
    }
    throw error;
  } finally {
    render();
  }
}

elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  const content = elements.draft.value.trim();
  if (!content || busy) return;
  await run(() => sendMessage(content), "Analyzing…");
  elements.draft.focus();
});
elements.draft.addEventListener("input", updateControls);
elements.draft.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!elements.send.disabled) elements.form.requestSubmit();
  }
});
elements.newChat.addEventListener("click", () => {
  showStatus("");
  resetChat();
  updateControls();
  elements.draft.focus();
});
elements.historyToggle.addEventListener("click", () => {
  setHistoryVisible(elements.historyToggle.getAttribute("aria-expanded") !== "true");
});
elements.remove.addEventListener("click", () => {
  if (!activeChat || !window.confirm("Delete this conversation and its messages?")) return;
  run(async () => {
    const id = activeChat.id;
    await request("/api/chats/" + id, { method: "DELETE" });
    chats = chats.filter(chat => chat.id !== id);
    retries.delete(id);
    resetChat();
  }, "Deleting conversation…");
});
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    elements.draft.value = examples[button.dataset.example];
    updateControls();
    elements.draft.focus();
  });
}

run(async () => {
  chats = await loadPages("/api/chats");
  render();
});
