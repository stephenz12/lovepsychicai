/********************************************
 * USER CHAT — ROOM + BILLING + TYPING + SOUND + IMAGES + EMOJI
 * + READ RECEIPTS + QUICK REPLIES + CATEGORY REPLIES + AI QUICK REPLIES + AI DEEP REPLIES
 ********************************************/

console.log("📡 Loaded USER chat.js");

// ROOM
const roomId = localStorage.getItem("userRoomId");
if (!roomId) {
  alert("No active chat found. Returning home.");
  window.location.href = "/";
}

// AUTH
const authToken = localStorage.getItem("authToken");
if (!authToken) {
  alert("Please log in first.");
  window.location.href = "/login.html";
}

let currentUser = null;

// DOM
const timerDisplay = document.getElementById("timer");
const costDisplay = document.getElementById("currentCost");
const walletDisplay = document.getElementById("walletCredits");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const typingIndicator = document.getElementById("typingIndicator");
const connectionStatus = document.getElementById("connectionStatus");
const downloadBtn = document.getElementById("downloadTranscriptBtn");
const endChatBtnUser = document.getElementById("endChatBtnUser");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const advisorStatus = document.getElementById("advisorStatus");
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");

// ⭐ OLD quick replies block (still referenced for backward compatibility)
const quickRepliesContainer = document.getElementById("userQuickReplies");

// ⭐ AI Quick Replies + Deep Replies containers
const aiQRcontainer = document.getElementById("aiQuickReplies");
const aiQRbuttons = document.getElementById("aiQRbuttons");
const aiDeepContainer = document.getElementById("aiDeepReply");
const aiDeepTextEl = document.getElementById("aiDeepText");
const aiDeepSendBtn = document.getElementById("aiDeepSendBtn");

chatWindow.style.display = "block";
chatForm.style.display = "flex";

const socket = io();

// BILLING
let secondsElapsed = 0;
let sessionId = null;
let costPerMinute = 2.0;
let costPerSecond = costPerMinute / 60;
let billingInterval = null;

// SOUND
let incomingSound = null;
try {
  incomingSound = new Audio("/sounds/incoming.mp3");
} catch (e) {
  console.warn("Sound init failed (optional).");
}

// TRANSCRIPT & DRAFT & READ RECEIPTS
const transcript = [];
const draftKey = `user_draft_${roomId}`;
let lastUserMessageEl = null;
let seenMarkerEl = null;

// track last user text (for deep reply context)
let lastUserPlainText = "";

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

// HELPERS
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function scrollIfNeeded() {
  if (autoScroll) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

function appendMessage(msg) {
  const { from, text, time, type, imageData } = msg;

  // if currentUser not loaded yet, just render as non-self
  const isSelf = currentUser && from === currentUser.userId;

  const div = document.createElement("div");
  div.className = isSelf ? "chat-message user-self" : "chat-message";

  const name = isSelf ? "You" : "Advisor";

  let bodyHtml = "";
  if (type === "image" && imageData) {
    bodyHtml = `<img src="${imageData}" style="max-width:100%; border-radius:8px;" alt="sent image" />`;
  } else {
    bodyHtml = `<div class="chat-text">${text}</div>`;
  }

  div.innerHTML = `
    <div class="chat-meta">${name}</div>
    ${bodyHtml}
  `;

  chatWindow.appendChild(div);
  scrollIfNeeded();

  transcript.push({
    from,
    text: type === "image" ? "[image]" : text,
    time: time || Date.now(),
    type: type || "text",
  });

  if (isSelf) {
    lastUserMessageEl = div;
    lastUserPlainText = text || "";
    if (seenMarkerEl) {
      seenMarkerEl.remove();
      seenMarkerEl = null;
    }
  }
}

function downloadTranscript() {
  if (!transcript.length) {
    alert("No messages yet.");
    return;
  }

  let lines = transcript.map((m) => {
    const ts = new Date(m.time).toLocaleString();
    const who = m.from === currentUser.userId ? "You" : "Advisor";
    return `[${ts}] ${who}: ${m.text}`;
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat_${roomId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// LOAD USER
function loadUser() {
  return fetch("/me", {
    headers: { Authorization: "Bearer " + authToken },
  })
    .then((res) => res.json())
    .then((data) => {
      currentUser = data;
      walletDisplay.textContent = currentUser.credits.toFixed(2);
    });
}

// BILLING
function startBillingTimer() {
  clearInterval(billingInterval);

  billingInterval = setInterval(() => {
    secondsElapsed++;
    timerDisplay.textContent = formatTime(secondsElapsed);

    let totalCost = secondsElapsed * costPerSecond;
    costDisplay.textContent = totalCost.toFixed(2);

    if (totalCost >= currentUser.credits) {
      endChatAutomatically();
    }
  }, 1000);
}

function endChatAutomatically() {
  clearInterval(billingInterval);
  alert("Your credits have run out. Chat ended.");

  fetch("/end-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }).then(() => {
    socket.emit("endChat", { roomId, by: "user" });
    window.location.href = "/";
  });
}

// START CHAT SESSION
function startChatSession() {
  return fetch("/start-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      advisorId: "unknown",
      userId: currentUser.userId,
      costPerMinute,
    }),
  })
    .then((r) => r.json())
    .then((d) => {
      sessionId = d.sessionId;
      socket.emit("sessionInfo", { sessionId, roomId });
    });
}

// SEND MESSAGE (manual text)
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit("stopTyping", { roomId, from: "user" });

  const msg = {
    roomId,
    sessionId,
    from: currentUser.userId,
    text,
    time: Date.now(),
    type: "text",
  };

  socket.emit("chatMessageRoom", msg);
  appendMessage(msg);

  chatInput.value = "";
  localStorage.removeItem(draftKey);
});

// ⭐⭐⭐ OLD QUICK REPLIES (still active if present)
if (quickRepliesContainer) {
  quickRepliesContainer.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.classList.contains("quick-btn")) return;

    const text = btn.textContent.trim();
    if (!text) return;

    const msg = {
      roomId,
      sessionId,
      from: currentUser.userId,
      text,
      time: Date.now(),
      type: "text",
    };

    socket.emit("chatMessageRoom", msg);
    appendMessage(msg);

    chatInput.value = "";
    localStorage.removeItem(draftKey);
  });
}

/***********************************
 * ⭐ NEW — Quick Reply Category Toggle
 ***********************************/
const categoryHeaders = document.querySelectorAll(".qr-header");

if (categoryHeaders) {
  categoryHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const targetId = header.getAttribute("data-target");
      const panel = document.getElementById(targetId);

      if (!panel) return;

      const isOpen = panel.style.display !== "none";

      // Toggle panel
      panel.style.display = isOpen ? "none" : "block";

      // Update arrow
      header.textContent = header.textContent.replace(
        isOpen ? "▾" : "▸",
        isOpen ? "▸" : "▾"
      );
    });
  });
}

/***********************************
 * ⭐ NEW — Quick Reply Click Handler (Auto-send)
 ***********************************/
const qrLists = document.querySelectorAll(".qr-list");

if (qrLists) {
  qrLists.forEach((list) => {
    list.addEventListener("click", (e) => {
      const btn = e.target;
      if (!btn.classList.contains("quick-btn")) return;

      const text = btn.textContent.trim();
      if (!text) return;

      const msg = {
        roomId,
        sessionId,
        from: currentUser.userId,
        text,
        time: Date.now(),
        type: "text",
      };

      socket.emit("chatMessageRoom", msg);
      appendMessage(msg);

      chatInput.value = "";
      localStorage.removeItem(draftKey);
    });
  });
}

/***********************************
 * ⭐ AI QUICK REPLY GENERATOR
 ***********************************/
function generateAIQuickReplies(latestText) {
  latestText = (latestText || "").toLowerCase();

  if (latestText.includes("love") || latestText.includes("relationship")) {
    return [
      "Can you see how they currently feel?",
      "Do you see us reconnecting?",
      "Is there someone else around them?",
    ];
  }

  if (latestText.includes("job") || latestText.includes("career")) {
    return [
      "Do you sense any career changes coming?",
      "Should I stay or move on?",
      "Am I aligned with my purpose?",
    ];
  }

  if (latestText.includes("money") || latestText.includes("finance")) {
    return [
      "Do you see improvements in my finances?",
      "Is there anything blocking my abundance?",
      "What can I do to invite more stability?",
    ];
  }

  // energy / spiritual
  if (
    latestText.includes("energy") ||
    latestText.includes("spirit") ||
    latestText.includes("guide")
  ) {
    return [
      "What energy do you feel around me?",
      "Any guidance from my spirit team?",
      "Is there anything blocking my path?",
    ];
  }

  // default
  return [
    "What do you sense I should do next?",
    "Can you go a bit deeper into that?",
    "What is the most important thing I should know?",
  ];
}

function showAIReplies(list) {
  if (!aiQRcontainer || !aiQRbuttons) return;

  aiQRbuttons.innerHTML = "";

  list.forEach((txt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quick-btn";
    btn.style.padding = "6px 10px";
    btn.style.fontSize = "14px";
    btn.textContent = txt;

    btn.addEventListener("click", () => {
      const msg = {
        roomId,
        sessionId,
        from: currentUser.userId,
        text: txt,
        time: Date.now(),
        type: "text",
      };
      socket.emit("chatMessageRoom", msg);
      appendMessage(msg);
      chatInput.value = "";
      localStorage.removeItem(draftKey);
    });

    aiQRbuttons.appendChild(btn);
  });

  aiQRcontainer.style.display = list.length ? "block" : "none";
}

/***********************************
 * ⭐ AI DEEP REPLY GENERATOR (Style 4 blend)
 ***********************************/
function generateAIDeepReply(latestAdvisorText, lastUserText) {
  const t = (latestAdvisorText || "").toLowerCase();
  const u = (lastUserText || "").toLowerCase();

  // LOVE / RELATIONSHIP
  if (
    t.includes("love") ||
    t.includes("relationship") ||
    t.includes("partner") ||
    u.includes("love") ||
    u.includes("relationship") ||
    u.includes("partner")
  ) {
    return (
      "From what you’re sharing, it feels like there’s a lot of emotion and unspoken energy between you two. " +
      "Rather than chasing a specific outcome, I’d like you to notice how this connection makes you feel in your body and in your spirit. " +
      "As you reflect on this, what part of this relationship feels supportive, and what part feels heavy or confusing?"
    );
  }

  // CAREER / PURPOSE
  if (
    t.includes("job") ||
    t.includes("career") ||
    t.includes("work") ||
    t.includes("purpose") ||
    u.includes("job") ||
    u.includes("career") ||
    u.includes("work") ||
    u.includes("purpose")
  ) {
    return (
      "Your energy around work feels more like a transition than an ending. " +
      "You’re being nudged to align your path with what feels authentic, not just what feels safe. " +
      "If fear and obligation weren’t in the way, how do you imagine your ideal work or life path would actually look?"
    );
  }

  // GENERAL STUCK / ANXIETY
  if (
    t.includes("anxious") ||
    t.includes("worried") ||
    t.includes("stuck") ||
    u.includes("anxious") ||
    u.includes("worried") ||
    u.includes("stuck")
  ) {
    return (
      "It feels like you’re standing at a doorway between the old and the new, and that can naturally stir up anxiety. " +
      "You’re not meant to rush your next step, but you are being asked to listen to your inner voice more than your fears. " +
      "What part of this situation feels most heavy on your heart right now, and what small shift would bring even a little relief?"
    );
  }

  // ENERGY / SPIRITUAL THEMES
  if (
    t.includes("energy") ||
    t.includes("spirit") ||
    t.includes("intuition") ||
    t.includes("guide") ||
    u.includes("energy") ||
    u.includes("spirit") ||
    u.includes("intuition") ||
    u.includes("guide")
  ) {
    return (
      "The energy around you doesn’t feel random; it feels like your guides are trying to get your attention through patterns and synchronicities. " +
      "You’re being encouraged to ground yourself, breathe, and notice what keeps repeating. " +
      "As you sit with this, what signs or repeating themes have you been noticing lately that you might be overlooking?"
    );
  }

  // DEFAULT – gentle blended tone
  return (
    "It feels like you’re in an important turning point, even if it doesn’t fully make sense yet. " +
    "You’re being guided to slow down just enough to hear your own truth beneath everyone else’s opinions. " +
    "As you read this, what feels most true in your heart, even if it’s a little scary to admit?"
  );
}

// Render AI Deep Reply
function showAIDeepReply(text) {
  if (!aiDeepContainer || !aiDeepTextEl) return;
  aiDeepTextEl.textContent = text || "";
  aiDeepContainer.style.display = text ? "block" : "none";
}

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
        from: currentUser.userId,
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

// RECEIVE MESSAGE
socket.on("chatMessageRoom", (msg) => {
  if (!msg || msg.roomId !== roomId) return;
  if (!currentUser) return;

  const fromSelf = msg.from === currentUser.userId;

  appendMessage(msg);

  if (!fromSelf) {
    // incoming advisor message → update AI helper blocks
    if (aiQRcontainer && aiQRbuttons) {
      const q = generateAIQuickReplies(msg.text || "");
      showAIReplies(q);
    }

    if (aiDeepContainer && aiDeepTextEl) {
      const deepText = generateAIDeepReply(msg.text || "", lastUserPlainText);
      showAIDeepReply(deepText);
    }

    if (incomingSound) {
      try {
        incomingSound.play();
      } catch {}
    }
  }
});

// TYPING
let typing = false;
let typingTimeout = null;

chatInput.addEventListener("input", () => {
  localStorage.setItem(draftKey, chatInput.value || "");
  sendTyping();
});

function sendTyping() {
  if (!typing) {
    typing = true;
    socket.emit("typing", { roomId, from: "user" });
  }

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typing = false;
    socket.emit("stopTyping", { roomId, from: "user" });
  }, 2000);
}

socket.on("typing", (data) => {
  if (!data || data.roomId !== roomId) return;
  if (data.from === "advisor" && typingIndicator) {
    typingIndicator.style.display = "block";
    typingIndicator.textContent = "Advisor is typing…";
  }
});

socket.on("stopTyping", (data) => {
  if (!data || data.roomId !== roomId) return;
  typingIndicator.style.display = "none";
});

// PRESENCE
socket.on("presenceUpdate", (d) => {
  if (!d) return;
  if (d.role === "advisor" && advisorStatus) {
    advisorStatus.textContent = `Advisor: ${d.online ? "online" : "offline"}`;
    advisorStatus.style.color = d.online ? "green" : "#888";
  }
});

// RECONNECT
socket.on("connect", () => {
  console.log("🟢 User connected:", socket.id);

  if (connectionStatus) connectionStatus.textContent = "";

  socket.emit("joinRoom", { roomId });
  socket.emit("presence", { roomId, role: "user", online: true });

  if (sessionId) {
    socket.emit("resumeSession", { sessionId, roomId });
  }
});

socket.on("disconnect", () => {
  console.log("🔴 User disconnected");
  if (connectionStatus) {
    connectionStatus.textContent = "Connection lost… reconnecting.";
  }
});

// SESSION RESTORE
socket.on("sessionState", (data) => {
  console.log("📄 Restored session:", data);

  costPerMinute = data.costPerMinute;
  costPerSecond = costPerMinute / 60;

  const now = Date.now();
  const elapsed = Math.floor((now - data.startTime) / 1000);

  secondsElapsed = elapsed;
  timerDisplay.textContent = formatTime(elapsed);

  const totalCost = elapsed * costPerSecond;
  costDisplay.textContent = totalCost.toFixed(2);

  clearInterval(billingInterval);
  startBillingTimer();
});

// READ RECEIPTS
socket.on("messageSeen", (d) => {
  if (!d || d.sessionId !== sessionId) return;
  if (!lastUserMessageEl) return;

  seenMarkerEl = document.createElement("div");
  seenMarkerEl.style.fontSize = "11px";
  seenMarkerEl.style.color = "#3c763d";
  seenMarkerEl.style.marginTop = "2px";
  seenMarkerEl.textContent = "Seen ✔✔";

  lastUserMessageEl.appendChild(seenMarkerEl);
});

// CHAT ENDED
socket.on("chatEnded", () => {
  clearInterval(billingInterval);
  alert("The chat has ended.");
  window.location.href = "/";
});

// END CHAT BUTTON
if (endChatBtnUser) {
  endChatBtnUser.addEventListener("click", () => {
    if (!confirm("End this chat now?")) return;

    clearInterval(billingInterval);

    fetch("/end-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      socket.emit("endChat", { roomId, by: "user" });
      window.location.href = "/";
    });
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
    if (e.target.classList.contains("emoji-item")) {
      chatInput.value += e.target.textContent;
      chatInput.focus();
    }
  });
}

/***********************************
 * ⭐ AI DEEP REPLY SEND BUTTON
 ***********************************/
if (aiDeepSendBtn && aiDeepTextEl) {
  aiDeepSendBtn.addEventListener("click", () => {
    const txt = (aiDeepTextEl.textContent || "").trim();
    if (!txt || !currentUser) return;

    const msg = {
      roomId,
      sessionId,
      from: currentUser.userId,
      text: txt,
      time: Date.now(),
      type: "text",
    };

    socket.emit("chatMessageRoom", msg);
    appendMessage(msg);
    chatInput.value = "";
    localStorage.removeItem(draftKey);
  });
}

// INIT
loadUser()
  .then(startChatSession)
  .then(startBillingTimer)
  .catch((err) => {
    console.error("Error starting chat:", err);
    alert("Could not start chat.");
  });
