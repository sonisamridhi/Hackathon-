const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const subjectSelect = document.getElementById("subjectSelect");
const clearBtn = document.getElementById("clearBtn");

const STORAGE_KEY = "study_assistant_messages_v2";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function appendMessage(text, role) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = escapeHtml(text);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function loadSavedChat() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  saved.forEach((item) => appendMessage(item.text, item.role));
  return saved;
}

async function loadMeta() {
  const res = await fetch("/api/meta");
  const data = await res.json();
  subjectSelect.innerHTML = data.subjects
    .map((subject) => `<option value="${subject}">${subject}</option>`)
    .join("");
  subjectSelect.value = data.defaultSubject;
}

async function sendMessage(text, subject) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, subject })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to send message");
  }
  return data.reply;
}

const history = loadSavedChat();
if (history.length === 0) {
  appendMessage("Welcome! Ask me anything about your studies.", "bot");
}

loadMeta().catch(() => {
  subjectSelect.innerHTML = "<option>General</option>";
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  history.push({ text, role: "user" });
  messageInput.value = "";
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    const reply = await sendMessage(text, subjectSelect.value);
    appendMessage(reply, "bot");
    history.push({ text: reply, role: "bot" });
  } catch (error) {
    const fallback = `Error: ${error.message}`;
    appendMessage(fallback, "bot");
    history.push({ text: fallback, role: "bot" });
  } finally {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
});
