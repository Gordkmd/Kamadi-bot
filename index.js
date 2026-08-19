const express = require('express');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000; // Bot-Hosting gives you a port

app.use(express.json());
if (!fs.existsSync('./session')) fs.mkdirSync('./session');

let sock;
let isConnected = false;

// THE WEBSITE
const html = `
<!DOCTYPE html>
<html>
<head>
<title>👑 KAMADI BOT PANEL</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{background:linear-gradient(135deg,#0a0f1e,#1a2333);color:#fff;font-family:'Segoe UI';text-align:center;padding:20px;min-height:100vh}
.card{background:#121a27;max-width:400px;margin:50px auto;padding:30px;border-radius:15px;border:1px solid #00d26a}
input{width:90%;padding:15px;border-radius:10px;border:1px solid #2c3e50;background:#0a0f1e;color:#fff;margin:15px 0;font-size:16px}
.btn{width:90%;padding:15px;background:linear-gradient(90deg,#00d26a,#00f087);border:none;border-radius:10px;color:#000;font-weight:bold;font-size:16px;cursor:pointer}
.code{font-size:28px;color:#00d26a;letter-spacing:4px;margin:20px 0;font-weight:bold}
.status{color:#aaa;margin:10px 0}
</style>
</head>
<body>
<div class="card">
<h1>👑 KAMADI-BOT PANEL</h1>
<p id="status">Step 1: Enter your WhatsApp number with country code</p>
<input id="num" placeholder="e.g 2347057558443">
<button class="btn" onclick="getCode()">GET PAIRING CODE</button>
<div id="code" class="code"></div>
<p style="font-size:12px;color:#888">Step 2: Go to WA > Linked Devices > Link with phone number</p>
</div>
<script>
async function getCode(){
  const num = document.getElementById('num').value;
  if(num.length < 10) return alert('Enter full number');
  document.getElementById('status').innerText = '⏳ Requesting code...';
  document.getElementById('btn').disabled = true;
  const res = await fetch('/code?number='+num);
  const data = await res.json();
  document.getElementById('code').innerText = data.code || data.error;
  document.getElementById('status').innerText = data.code ? 'Step 3: Enter this code in WhatsApp FAST' : 'Error. Refresh and try again';
}
setInterval(async()=>{
  const res = await fetch('/status');
  const data = await res.json();
  if(data.connected) document.getElementById('status').innerText = '✅ BOT CONNECTED TO WHATSAPP!';
}, 3000)
</script>
</body>
</html>
`

app.get('/', (req, res) => res.send(html));

// GET PAIRING CODE
app.get('/code', async (req, res) => {
    const number = req.query.number;
    if(!number) return res.json({error: 'Enter number'});
    if(isConnected) return res.json({error: 'Already connected'});

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: state,
            browser: Browsers.macOS('Desktop'),
            logger: require('pino')({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if(connection === 'open') {
                isConnected = true;
                console.log('✅ KAMADI BOT CONNECTED!');
            }
            if(connection === 'close') isConnected = false;
        });

        await new Promise(r => setTimeout(r, 1500));
        const code = await sock.requestPairingCode(number);
        console.log(`🔥 PAIRING CODE: ${code}`);
        
        res.json({code: code.match(/.{1,3}/g).join('-')});

    } catch (err) {
        console.error(err);
        res.json({error: 'Failed. Restart container'});
    }
});

// CHECK STATUS
app.get('/status', (req, res) => {
    res.json({connected: isConnected});
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ KAMADI PANEL RUNNING ON PORT ${PORT}`));
