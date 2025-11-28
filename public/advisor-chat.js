/********************************************
 * ADVISOR CHAT — ROOM + TIMER + TYPING + SOUND + IMAGES +
 * EMOJI + PRESENCE + READ RECEIPTS + QUICK REPLIES
 ********************************************/

console.log("📡 Loaded ADVISOR chat.js");

// URL PARAMS
function getParam(name) {
  const p = new URLSearchParams(window.location.search);
  return p.get(name);
}

const roomId = getParam("roomId") || null;
const sessionId = getParam("sessionId") || null;
const userName = getParam("userName") || "Client";

// DOM
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const timerDisplay = document.getElementById("timer");
const currentCostDisplay = document.getElementById("currentCost");
const walletCreditsDisplay = document.getElementById("walletCredits");
const chatPsychicName = document.getElementById("chatPsychicName");
const typingIndicator = document.getElementById("typingIndicator");
const connectionStatus = document.getElementById("connectionStatus");
const endChatBtn = document.getElementById("endChatBtnAdvisor");
const downloadBtn = document.getElementById("downloadTranscriptBtn");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const userStatus = document.getElementById("userStatus");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");
const quickReplies = document.getElementById("quickReplies"); // ⭐ NEW

if (chatPsychicName) {
  chatPsychicName.textContent = `Chat with ${userName}`;
}

const socket = io();

// TIMER / BILLING
let secondsElapsed = 0;
let timerInterval = null;
let costPerMinute = 2.0;
let costPerSecond = costPerMinute / 60;

// SOUND
let incomingSound = null;
try {
  incomingSound = new Audio("/sounds/incoming.mp3");
} catch (e) {
  console.warn("Sound not loaded (optional).");
}

// TRANSCRIPT
const transcript = [];
const draftKey = `advisor_draft_${roomId || "global"}`;

// restore draft
const savedDraft = localStorage.getItem(draftKey);
if (savedDraft) chatInput.value = savedDraft;

// AUTOSCROLL
let autoScroll = true;
chatWindow.addEventListener("scroll", () => {
  const threshold = 40;
  const atBottom =
    chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight <
    threshold;
  autoScroll = atBottom;
});

function scrollIfNeeded() {
  if (autoScroll) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

// HELPERS
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    secondsElapsed++;
    if (timerDisplay) timerDisplay.textContent = formatTime(secondsElapsed);
    const totalCost = secondsElapsed * costPerSecond;
    if (currentCostDisplay)
      currentCostDisplay.textContent = totalCost.toFixed(2);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

function appendMessage(msg) {
  const { from, text, time, type, imageData } = msg;
  const isAdvisor = from === "advisor";

  const div = document.createElement("div");
  div.className = isAdvisor
    ? "message advisor-message"
    : "message client-message";

  let bodyHtml = "";
  if (type === "image" && imageData) {
    bodyHtml = `<img src="${imageData}" style="max-width:100%; border-radius:8px;" alt="sent image" />`;
  } else {
    bodyHtml = `<div>${text}</div>`;
  }

  div.innerHTML = bodyHtml;
  chatWindow.appendChild(div);
  scrollIfNeeded();

  transcript.push({
    from,
    text: type === "image" ? "[image]" : text,
    time: time || Date.now(),
    type: type || "text",
  });
}

function downloadTranscript() {
  if (!transcript.length) {
    alert("No messages yet.");
    return;
  }

  let lines = transcript.map((m) => {
    const ts = new Date(m.time).toLocaleString();
    const who = m.from === "advisor" ? "Advisor" : "Client";
    return `[${ts}] ${who}: ${m.text}`;
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat_${roomId || "session"}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// SOCKET CONNECT / PRESENCE / RESUME
socket.on("connect", () => {
  console.log("🟢 Advisor connected:", socket.id);
  if (connectionStatus) connectionStatus.textContent = "";

  if (roomId) {
    socket.emit("joinRoom", { roomId });
  }

  socket.emit("presence", {
    roomId,
    role: "advisor",
    online: true,
  });

  if (sessionId && roomId) {
    socket.emit("resumeSession", { sessionId, roomId });
  }
});

socket.on("disconnect", () => {
  console.warn("Advisor disconnected");
  if (connectionStatus) {
    connectionStatus.textContent = "Connection lost… reconnecting.";
  }
});

// SESSION RESTORE
socket.on("sessionState", (data) => {
  console.log("📄 Advisor restored session:", data);

  costPerMinute = data.costPerMinute;
  costPerSecond = costPerMinute / 60;

  const now = Date.now();
  const elapsed = Math.floor((now - data.startTime) / 1000);

  secondsElapsed = elapsed;
  if (timerDisplay) timerDisplay.textContent = formatTime(elapsed);

  const totalCost = elapsed * costPerSecond;
  if (currentCostDisplay) currentCostDisplay.textContent = totalCost.toFixed(2);

  stopTimer();
  startTimer();
});

// PRESENCE UPDATES
socket.on("presenceUpdate", (d) => {
  if (!d) return;
  if (d.role === "user" && userStatus) {
    userStatus.textContent = `User: ${d.online ? "online" : "offline"}`;
    userStatus.style.color = d.online ? "green" : "#888";
  }
});

// RECEIVE MESSAGES
socket.on("chatMessageRoom", (msg) => {
  if (!msg || msg.roomId !== roomId) return;
  if (msg.from === "advisor") return;

  appendMessage(msg);

  if (incomingSound) {
    try {
      incomingSound.play();
    } catch {}
  }

  // mark seen
  if (sessionId) {
    socket.emit("messageSeen", { roomId, sessionId });
  }
});

// TYPING (CLIENT)
socket.on("typing", (data) => {
  if (!data || data.roomId !== roomId) return;
  if (data.from === "user" || data.from === "client") {
    if (typingIndicator) {
      typingIndicator.style.display = "block";
      typingIndicator.textContent = `${userName} is typing…`;
    }
  }
});

socket.on("stopTyping", (data) => {
  if (!data || data.roomId !== roomId) return;
  if (typingIndicator) typingIndicator.style.display = "none";
});

// TYPING (ADVISOR)
let typing = false;
let typingTimeout = null;

chatInput.addEventListener("input", () => {
  localStorage.setItem(draftKey, chatInput.value || "");
  sendTyping();
});

function sendTyping() {
  if (!typing) {
    typing = true;
    socket.emit("typing", { roomId, from: "advisor" });
  }

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typing = false;
    socket.emit("stopTyping", { roomId, from: "advisor" });
  }, 2000);
}

// SEND TEXT MESSAGE
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  typing = false;
  if (typingTimeout) clearTimeout(typingTimeout);
  socket.emit("stopTyping", { roomId, from: "advisor" });

  const msg = {
    roomId,
    sessionId,
    from: "advisor",
    text,
    time: Date.now(),
    type: "text",
  };

  socket.emit("chatMessageRoom", msg);
  appendMessage(msg);

  chatInput.value = "";
  localStorage.removeItem(draftKey);
});

// SEND IMAGE
if (imageBtn && imageInput) {
  imageBtn.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result;

      const msg = {
        roomId,
        sessionId,
        from: "advisor",
        time: Date.now(),
        type: "image",
        imageData,
        mimeType: file.type,
      };

      socket.emit("chatMessageRoom", msg);
      appendMessage(msg);
    };
    reader.readAsDataURL(file);
  });
}

// CHAT ENDED
socket.on("chatEnded", (data) => {
  if (!data || data.roomId !== roomId) return;

  stopTimer();
  if (typingIndicator) typingIndicator.style.display = "none";

  alert("This chat has ended.");
  window.location.href = "/advisor-dashboard.html";
});

// END CHAT BUTTON
if (endChatBtn) {
  endChatBtn.addEventListener("click", () => {
    if (!confirm("End this chat and finalize billing?")) return;

    socket.emit("endChat", { roomId, by: "advisor" });
  });
}

// DOWNLOAD TRANSCRIPT
if (downloadBtn) {
  downloadBtn.addEventListener("click", downloadTranscript);
}

// EMOJI PICKER
if (emojiBtn && emojiPicker) {
  emojiBtn.addEventListener("click", () => {
    emojiPicker.style.display =
      emojiPicker.style.display === "none" || !emojiPicker.style.display
        ? "block"
        : "none";
  });

  emojiPicker.addEventListener("click", (e) => {
    const target = e.target;
    if (target.classList.contains("emoji-item")) {
      chatInput.value += target.textContent;
      chatInput.focus();
    }
  });
}

/********************************************
 * ⭐ QUICK REPLIES (NEW)
 ********************************************/
if (quickReplies) {
  quickReplies.addEventListener("click", (e) => {
    const btn = e.target;
    if (btn.classList.contains("quick-btn")) {
      const text = btn.textContent;

      const msg = {
        roomId,
        sessionId,
        from: "advisor",
        text,
        time: Date.now(),
        type: "text",
      };

      socket.emit("chatMessageRoom", msg);
      appendMessage(msg);
    }
  });
}

// INITIAL TIMER START
startTimer();
