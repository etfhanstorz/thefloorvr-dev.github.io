// Sends the devlog to a Discord channel via webhook, split into <=2000-char parts.
//
// Webhook URL is read from (in order):
//   1) env var DISCORD_WEBHOOK_URL
//   2) file: "full v1.0.0 release to-do/webhook.txt"  (kept untracked)
//
// Usage:  node tools/send-devlog.js
//
// In Discord: Channel → Edit Channel → Integrations → Webhooks → New Webhook →
//             Copy Webhook URL, then paste it into webhook.txt (one line).

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DEVLOG = path.join(ROOT, 'full v1.0.0 release to-do', 'devlogs (update every fix or update).txt');
const WEBHOOK_FILE = path.join(ROOT, 'full v1.0.0 release to-do', 'webhook.txt');
const LIMIT = 1850; // leaves room for the code-fence + "Devlog x/N" wrapper

function getWebhook() {
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL.trim();
  if (fs.existsSync(WEBHOOK_FILE)) return fs.readFileSync(WEBHOOK_FILE, 'utf8').trim();
  return null;
}

function splitIntoParts(text, limit) {
  const lines = text.split('\n');
  const parts = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + line + '\n').length > limit) { parts.push(cur); cur = ''; }
    cur += line + '\n';
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function postToDiscord(webhook, content) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ content });
    const u = new URL(webhook);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      // this dev machine's root CAs don't verify Discord's chain (same quirk the
      // bot hit); skip verification for this local-only publish.
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`Discord ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const webhook = getWebhook();
  if (!webhook) {
    console.error('No webhook. Set DISCORD_WEBHOOK_URL or create webhook.txt in the to-do folder.');
    process.exit(1);
  }
  if (!fs.existsSync(DEVLOG)) {
    console.error('Devlog not found at: ' + DEVLOG);
    process.exit(1);
  }

  const text = fs.readFileSync(DEVLOG, 'utf8');
  const parts = splitIntoParts(text, LIMIT);
  console.log(`Sending devlog in ${parts.length} part(s)...`);

  for (let i = 0; i < parts.length; i++) {
    const header = parts.length > 1 ? `**Devlog ${i + 1}/${parts.length}**\n` : '';
    await postToDiscord(webhook, header + '```\n' + parts[i] + '\n```');
    console.log(`  sent part ${i + 1}/${parts.length}`);
    if (i < parts.length - 1) await sleep(900); // be gentle with rate limits
  }
  console.log('Done.');
})();
