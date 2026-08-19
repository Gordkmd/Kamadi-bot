const express = require('express');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate session endpoint
app.get('/generate', async (req, res) => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: require('pino')({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                return res.json({ qr: qr });
            }

            if (connection === 'open') {
                return res.json({ success: true, message: 'Connected to WhatsApp!' });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnect:', shouldReconnect);
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Health check for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// THIS LINE IS CRITICAL FOR RENDER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Kamadi Bot is running on port ${PORT}`);
    console.log(`🔗 Open: https://kamadi-bot.onrender.com`);
});
