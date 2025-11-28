console.log("🔥 RUNNING CORRECT SERVER FILE!");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/****************************************************
 * ⭐⭐⭐ TWILIO SETUP — from environment variables ⭐⭐⭐
 ****************************************************/
const twilio = require("twilio");

// Read Twilio values from environment variables (Render sets these)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER; // e.g. +13053631648
// DEBUG — safe: show presence & prefix only
console.log("TWILIO_ACCOUNT_SID present:", !!TWILIO_ACCOUNT_SID);
console.log(
  "TWILIO_ACCOUNT_SID prefix:",
  TWILIO_ACCOUNT_SID ? TWILIO_ACCOUNT_SID.slice(0, 2) : "(none)"
);

// Public URL Twilio should call back (must be HTTPS in production)
const BASE_URL = process.env.BASE_URL || "https://twilio-voice.onrender.com";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.warn(
    "⚠️ WARNING: Twilio env vars missing. Make sure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER are set."
  );
}

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
/****************************************************/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const usersFile = path.join(__dirname, "db", "users.json");
const chatSessionsFile = path.join(__dirname, "db", "chat_sessions.json");
const authSessionsFile = path.join(__dirname, "db", "auth_sessions.json");
const phoneSessionsFile = path.join(__dirname, "db", "phone_sessions.json");
const payoutsFile = path.join(__dirname, "db", "payouts.json"); // ⭐ NEW

// JSON helper
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  const t = fs.readFileSync(file, "utf8").trim();
  if (!t) return [];
  try {
    return JSON.parse(t);
  } catch {
    return [];
  }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Make sure advisor flags exist
function ensureAdvisorFlags(user) {
  if (!user) return false;
  let changed = false;

  if (user.availableForChat === undefined) {
    user.availableForChat = true;
    changed = true;
  }
  if (user.availableForPhone === undefined) {
    user.availableForPhone = true;
    changed = true;
  }
  if (user.inChatSession === undefined) {
    user.inChatSession = false;
    changed = true;
  }
  if (user.inPhoneSession === undefined) {
    user.inPhoneSession = false;
    changed = true;
  }
  return changed;
}

/***********************************
 * ADMIN MIDDLEWARE
 ***********************************/
function requireAdmin(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  const sessions = readJSON(authSessionsFile);
  const s = sessions.find((x) => x.token === token);
  if (!s) return res.status(401).json({ error: "Invalid token" });
  if (s.role !== "admin") return res.status(403).json({ error: "Admins only" });

  next();
}

/***********************************
 * WALLET
 ***********************************/
app.get("/user/:userId/wallet", (req, res) => {
  const users = readJSON(usersFile);
  let u = users.find((x) => x.userId === req.params.userId);
  if (!u) {
    u = { userId: req.params.userId, credits: 0 };
    users.push(u);
    writeJSON(usersFile, users);
  }
  res.json({ credits: u.credits || 0 });
});

app.post("/user/:userId/add-credits", (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0)
    return res.status(400).json({ error: "Amount must be positive" });

  const users = readJSON(usersFile);
  let u = users.find((x) => x.userId === userId);
  if (!u) {
    u = { userId, credits: amount };
    users.push(u);
  } else {
    u.credits = (u.credits || 0) + amount;
  }

  writeJSON(usersFile, users);
  res.json({ credits: u.credits });
});

/***********************************
 * ADMIN ROUTES
 ***********************************/
app.get("/admin/users", requireAdmin, (req, res) =>
  res.json(readJSON(usersFile))
);

app.get("/admin/sessions", requireAdmin, (req, res) =>
  res.json(readJSON(chatSessionsFile))
);

/***********************************
 * AUTH
 ***********************************/
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(usersFile);
  const u = users.find((x) => x.email === email);

  if (!u || !u.passwordHash)
    return res.status(400).json({ error: "Invalid login" });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(400).json({ error: "Invalid login" });

  const token = crypto.randomBytes(30).toString("hex");

  const sessions = readJSON(authSessionsFile);
  sessions.push({
    token,
    userId: u.userId,
    role: u.role || "user",
    createdAt: Date.now(),
  });
  writeJSON(authSessionsFile, sessions);

  res.json({
    token,
    userId: u.userId,
    email: u.email,
    role: u.role || "user",
  });
});

app.get("/me", (req, res) => {
  const h = req.headers.authorization || "";
  const token = h.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  const sessions = readJSON(authSessionsFile);
  const s = sessions.find((x) => x.token === token);
  if (!s) return res.status(401).json({ error: "Invalid session" });

  const users = readJSON(usersFile);
  const u = users.find((x) => x.userId === s.userId);

  if (!u) return res.status(404).json({ error: "User not found" });

  res.json({
    userId: u.userId,
    email: u.email,
    role: u.role || "user",
    credits: u.credits || 0,
  });
});

/***********************************
 * ADVISOR STATUS
 ***********************************/
app.get("/advisor-status/:advisorId", (req, res) => {
  const advisorId = req.params.advisorId;
  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);

  if (!advisor) {
    return res.json({
      advisorId,
      availableForChat: true,
      availableForPhone: true,
      inChatSession: false,
      inPhoneSession: false,
    });
  }

  if (ensureAdvisorFlags(advisor)) writeJSON(usersFile, users);

  res.json(advisor);
});

app.post("/advisor/update-status", (req, res) => {
  const { advisorId, availableForChat, availableForPhone } = req.body;

  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);
  if (!advisor) return res.status(404).json({ error: "Advisor not found" });

  ensureAdvisorFlags(advisor);

  if (availableForChat !== undefined)
    advisor.availableForChat = !!availableForChat;

  if (availableForPhone !== undefined)
    advisor.availableForPhone = !!availableForPhone;

  writeJSON(usersFile, users);

  io.emit("advisorStatusUpdate", advisor);

  res.json({ success: true });
});

/***********************************
 * ⭐⭐ NEW — SAVE ADVISOR PHONE NUMBER ⭐⭐
 ***********************************/
app.post("/save-advisor-phone", (req, res) => {
  const { advisorId, phone } = req.body;

  if (!advisorId || !phone)
    return res.status(400).json({ error: "Missing advisorId or phone" });

  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);

  if (!advisor) return res.status(404).json({ error: "Advisor not found" });

  advisor.phoneNumber = phone;
  writeJSON(usersFile, users);

  res.json({ success: true });
});

app.get("/advisor-phone/:advisorId", (req, res) => {
  const { advisorId } = req.params;
  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);

  if (!advisor) return res.json({ phoneNumber: null });

  res.json({ phoneNumber: advisor.phoneNumber || null });
});

/***********************************
 * CHAT START/END
 ***********************************/
app.post("/start-chat", (req, res) => {
  const { advisorId, userId, costPerMinute } = req.body;

  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);
  if (!advisor) return res.status(404).json({ error: "Advisor not found" });

  ensureAdvisorFlags(advisor);

  if (advisor.inChatSession)
    return res.status(400).json({ error: "Advisor in chat session" });

  if (advisor.inPhoneSession)
    return res.status(400).json({ error: "Advisor on phone call" });

  advisor.inChatSession = true;
  advisor.availableForChat = false;
  advisor.availableForPhone = false;
  writeJSON(usersFile, users);

  const sessions = readJSON(chatSessionsFile);
  sessions.push({
    sessionId: Date.now().toString(),
    advisorId,
    userId,
    costPerMinute,
    startTime: Date.now(),
    endTime: null,
    totalSeconds: 0,
    totalCost: 0,
    messages: [],
  });
  writeJSON(chatSessionsFile, sessions);

  io.emit("advisorStatusUpdate", advisor);
  res.json({ sessionId: Date.now().toString() });
});

/***********************************
 * ⭐ PHONE START — NOW WITH TWILIO CALL
 ***********************************/
app.post("/start-phone", async (req, res) => {
  const { advisorId, userId, costPerMinute, userPhone } = req.body;

  if (!advisorId || !userId || !userPhone)
    return res.status(400).json({ error: "Missing data" });

  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);

  ensureAdvisorFlags(advisor);

  if (advisor.inChatSession)
    return res.status(400).json({ error: "Advisor in chat" });

  if (advisor.inPhoneSession)
    return res.status(400).json({ error: "Already on phone" });

  if (!advisor.phoneNumber)
    return res.status(400).json({ error: "Advisor phone number not set" });

  // ---- TWILIO CALL: CALL USER FIRST ----
  let call;
  try {
    call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: userPhone,

      // ⬇⬇⬇ use the BASE_URL env var so Twilio can reach your voice handler
      url: `${BASE_URL}/twilio/voice-handler?advisorId=${advisorId}`,
      // ⬆⬆⬆
    });
  } catch (err) {
    console.error("Twilio Error:", err);
    return res.status(500).json({ error: "Twilio call failed" });
  }

  advisor.inPhoneSession = true;
  advisor.availableForChat = false;
  advisor.availableForPhone = false;
  writeJSON(usersFile, users);

  let phoneSessions = readJSON(phoneSessionsFile);
  phoneSessions.push({
    sessionId: Date.now().toString(),
    advisorId,
    userId,
    costPerMinute,
    startTime: Date.now(),
    endTime: null,
    totalSeconds: 0,
    totalCost: 0,
    twilioCallSid: call.sid,
  });
  writeJSON(phoneSessionsFile, phoneSessions);

  io.emit("advisorStatusUpdate", advisor);

  res.json({ success: true });
});

/***********************************
 * ⭐ TWILIO VOICE HANDLER — CONNECT USER → ADVISOR
 ***********************************/
app.post("/twilio/voice-handler", (req, res) => {
  const advisorId = req.query.advisorId; // <--- NEW
  const users = readJSON(usersFile);

  // Find the advisor
  const advisor = users.find((u) => u.userId === advisorId);

  const twiml = new twilio.twiml.VoiceResponse();

  if (!advisor || !advisor.phoneNumber) {
    twiml.say("The advisor is unavailable right now.");
    res.type("text/xml");
    return res.send(twiml.toString());
  }

  // Connect to the advisor’s saved phone number
  twiml.say("Connecting you to your psychic advisor now.");
  twiml.dial({ callerId: TWILIO_PHONE_NUMBER }, advisor.phoneNumber);

  res.type("text/xml");
  res.send(twiml.toString());
});

/***********************************
 * PHONE END
 ***********************************/
app.post("/end-phone", (req, res) => {
  const { advisorId } = req.body;

  const users = readJSON(usersFile);
  const advisor = users.find((u) => u.userId === advisorId);

  let phoneSessions = readJSON(phoneSessionsFile);

  let session = phoneSessions
    .reverse()
    .find((s) => s.advisorId === advisorId && !s.endTime);
  if (!session) return res.status(404).json({ error: "No open phone session" });

  const end = Date.now();
  const secs = Math.floor((end - session.startTime) / 1000);
  const cost = parseFloat(((secs / 60) * session.costPerMinute).toFixed(2));

  session.endTime = end;
  session.totalSeconds = secs;
  session.totalCost = cost;

  phoneSessions.reverse();
  writeJSON(phoneSessionsFile, phoneSessions);

  const users2 = readJSON(usersFile);
  const client = users2.find((u) => u.userId === session.userId);
  if (client) client.credits = Math.max(0, client.credits - cost);
  writeJSON(usersFile, users2);

  advisor.inPhoneSession = false;
  advisor.availableForChat = true;
  advisor.availableForPhone = true;
  writeJSON(usersFile, users);

  io.emit("advisorStatusUpdate", advisor);

  res.json({ success: true });
});

/***********************************
 * PHONE HISTORY
 ***********************************/
app.get("/phone-history/:userId", (req, res) => {
  const { userId } = req.params;
  const phoneSessions = readJSON(phoneSessionsFile);
  res.json(phoneSessions.filter((s) => s.userId === userId && s.endTime));
});

/***********************************
 * PHONE EARNINGS FOR ADVISOR
 ***********************************/
app.get("/advisor-phone-earnings/:advisorId", (req, res) => {
  const { advisorId } = req.params;
  const phoneSessions = readJSON(phoneSessionsFile);

  const mySessions = phoneSessions.filter(
    (s) => s.advisorId === advisorId && s.endTime
  );

  let totalSeconds = 0;
  let totalMoney = 0;
  mySessions.forEach((s) => {
    totalSeconds += s.totalSeconds;
    totalMoney += s.totalCost;
  });

  res.json({ totalSeconds, totalMoney, sessions: mySessions });
});

/***********************************
 * PAYOUT SYSTEM
 ***********************************/
app.get("/advisor/unpaid-earnings/:advisorId", (req, res) => {
  const advisorId = req.params.advisorId;

  const chat = readJSON(chatSessionsFile);
  const phone = readJSON(phoneSessionsFile);
  const payouts = readJSON(payoutsFile);

  let totalChat = 0;
  let totalPhone = 0;

  chat
    .filter((s) => s.advisorId === advisorId && s.endTime)
    .forEach((s) => (totalChat += s.totalCost));

  phone
    .filter((s) => s.advisorId === advisorId && s.endTime)
    .forEach((s) => (totalPhone += s.totalCost));

  const paid = payouts
    .filter((p) => p.advisorId === advisorId)
    .reduce((sum, p) => sum + p.amount, 0);

  const unpaid = totalChat + totalPhone - paid;

  res.json({
    advisorId,
    unpaid: unpaid < 0 ? 0 : unpaid,
    totalChat,
    totalPhone,
    alreadyPaid: paid,
  });
});

/***********************************
 * ADMIN HTML
 ***********************************/
function serveAdminPage(f) {
  return (req, res) => {
    const h = req.headers.authorization || "";
    const token = h.split(" ")[1];
    if (!token) return res.redirect("/login.html");

    const sessions = readJSON(authSessionsFile);
    const s = sessions.find((x) => x.token === token);

    if (!s || s.role !== "admin") return res.status(403).send("Admins only");

    res.sendFile(path.join(__dirname, "public", f));
  };
}

app.get("/admin", serveAdminPage("admin.html"));
app.get("/admin-users", serveAdminPage("admin-users.html"));
app.get("/admin-sessions", serveAdminPage("admin-sessions.html"));
app.get("/admin-earnings", serveAdminPage("admin-earnings.html"));

/***********************************
 * START SERVER
 ***********************************/
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
