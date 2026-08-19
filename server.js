const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// ====== PUT YOUR NUMBER HERE ======
const phoneNumber = "234XXXXXXXXXX" // CHANGE THIS to your WhatsApp number with country code. Ex: 2348012345678. No + and no spaces
// ===================================

const SESSION_FOLDER = path.join(__dirname, 'sessions');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // we use pairing code instead
        browser: ['KAMADI-BOT', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    // Ask for pairing code if not logged in
    if (!state.creds.registered) {
        setTimeout(async () => {
            if (phoneNumber === "234XXXXXXXXXX") {
                console.log("⚠️ Please change phoneNumber in server.js first!")
                return;
            }
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🔥 YOUR PAIRING CODE: ${code} 🔥\n`);
                console.log(`Go to WhatsApp > Settings > Linked Devices > Link with phone number\n`);
            } catch (err) {
                console.log("Error getting pairing code:", err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open')
