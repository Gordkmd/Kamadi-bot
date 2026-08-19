const express = require('express');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
if (!fs.existsSync('./session')) fs.mkdirSync('./session');

app.get('/code', async (req, res) => {
    const number = req.query.number;
    if(!number) return res.json({error: 'Enter number'});
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: require('pino')({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);
        
        await delay(1000); // wait for socket to connect
        
        const code = await sock.requestPairingCode(number);
        console.log(`🔥 PAIRING CODE: ${code}`);
        
        await sock.logout(); // close socket
        
        return res.json({code: code.match(/.{1,3}/g).join('-')});
        
    } catch (err) {
        console.error(err);
        return res.json({error: 'Failed. Refresh and try again'});
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Running on ${PORT}`));
