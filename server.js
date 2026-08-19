const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = 3000;
app.use(express.static('public'));
app.use(express.json());

// Generate kmd + 5 random chars = 8 total
function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'kmd';
  for (let i = 0; i < 5; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

// Load/Save autochat chats
const AUTOCHAT_FILE = './autochat.json';
let autoChatChats = fs.existsSync(AUTOCHAT_FILE)? JSON.parse(fs.readFileSync(AUTOCHAT_FILE)) : [];

function saveAutoChat() {
  fs.writeFileSync(AUTOCHAT_FILE, JSON.stringify(autoChatChats, null, 2));
}

// Human-like replies for autochat
const humanReplies = [
  "haha fr 😂", "omg really?", "no wayyy", "that's cool tbh",
  "lowkey agree with you", "you're wild 😭", "facts", "say less",
  "been there before", "damn 😳"
];

const sessions = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.post('/create-session', async (req, res) => {
  const sessionId = generateSessionId();
  const sessionPath = `./sessions/${sessionId}`;
  await fs.ensureDir(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ["KAMADI-BOT", "Chrome", "1.0.0"] // makes it look normal
  });

  sessions[sessionId] = { sock, qr: null, status: 'waiting' };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr) sessions[sessionId].qr = await qrcode.toDataURL(qr);
    if (connection === 'open') {
      sessions[sessionId].status = 'connected';
      sessions[sessionId].qr = null;
      console.log(`✅ ${sessionId} Connected`);
    }
    if (connection === 'close') sessions[sessionId].status = 'disconnected';
  });

  // COMMAND HANDLER
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const prefix = '.';
    if (!text.startsWith(prefix)) {
      // AUTOCHAT REPLY
      if (autoChatChats.includes(from)) {
        // wait 2-5s to look human
        await new Promise(r => setTimeout(r, 2000 + Math.random()*3000));
        const reply = humanReplies[Math.floor(Math.random() * humanReplies.length)];
        await sock.sendMessage(from, { text: reply });
      }
      return;
    }

    const args = text.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch(command) {
      case 'menu':
        await sock.sendMessage(from, { text: `👑 *KAMADI-BOT MENU* 👑\n\n`+
          `.menu - Show this menu\n`+
          `.ping - Check if bot is alive\n`+
          `.ai <question> - Chat with AI\n`+
          `.sticker - Reply to image to make sticker\n`+
          `.ytmp3 <link> - Download yt audio\n`+
          `.autochat on/off - Toggle auto reply in this chat\n`+
          `.owner - Contact owner\n`+
          `*Powered by Kamadi*` });
        break;

      case 'ping':
        await sock.sendMessage(from, { text: `pong 🏓 KAMADI-BOT is online` });
        break;

      case 'autochat':
        if (args[0] === 'on') {
          if (!autoChatChats.includes(from)) autoChatChats.push(from);
          saveAutoChat();
          await sock.sendMessage(from, { text: `✅ AutoChat ON in this chat. I'll reply like a human now` });
        } else if (args[0] === 'off') {
          autoChatChats = autoChatChats.filter(id => id!== from);
          saveAutoChat();
          await sock.sendMessage(from, { text: `❌ AutoChat OFF in this chat` });
        }
        break;

      case 'ai':
        const question = args.join(' ');
        await sock.sendMessage(from, { text: `🤖 KAMADI-AI: ${question}\n\nThat's interesting! Tell me more about it.` });
        break;

      case 'owner':
        await sock.sendMessage(from, { text: `👑 Owner: Kamadi\nBot: KAMADI-BOT v1.0` });
        break;

      default:
        await sock.sendMessage(from, { text: `Command not found. Type.menu` });
    }
  });

  res.json({ sessionId, message: 'Scan QR to login' });
});

app.get('/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ sessionId: req.params.id, qr: session.qr, status: session.status });
});

app.listen(PORT, () => console.log(`KAMADI-BOT Panel running on http://localhost:${PORT}`));
