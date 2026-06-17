// Leaderboard (Time Played / P$ / C$) + admin "all players" console.
// Reads from Supabase (public-read RLS). DOM overlay, works in VR via dom-overlay.

let lbUI = null;
let lbTab = 'balance'; // 'time_played' | 'balance' | 'c_balance'

function fmtTime(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function initLeaderboardUI() {
  lbUI = document.createElement('div');
  lbUI.id = 'leaderboard-ui';
  lbUI.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 460px; max-height: 70vh; overflow-y: auto;
    background: rgba(10,6,20,0.96); border: 2px solid #ffd24a; border-radius: 14px;
    padding: 18px; color: #fff; font-family: 'Segoe UI', Arial, sans-serif; z-index: 80; display: none;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  `;
  document.body.appendChild(lbUI);
}

function tabBtn(label, key) {
  const active = lbTab === key;
  return `<button onclick="lbSwitch('${key}')" style="flex:1; padding:8px; cursor:pointer; border:none; border-radius:8px; font-weight:700;
    background:${active ? '#ffd24a' : 'rgba(255,255,255,0.08)'}; color:${active ? '#1a1006' : '#cdbff5'};">${label}</button>`;
}

async function showLeaderboard() {
  if (!lbUI) initLeaderboardUI();
  lbUI.style.display = 'block';
  await renderLeaderboard();
}
function closeLeaderboard() { if (lbUI) lbUI.style.display = 'none'; if (admTimer) { clearInterval(admTimer); admTimer = null; } }
function lbSwitch(key) { lbTab = key; renderLeaderboard(); }

async function renderLeaderboard() {
  if (!window.sbFetchLeaderboard) {
    lbUI.innerHTML = '<h2>🏆 Leaderboard</h2><p>Leaderboard needs an online account (Supabase).</p>'
      + '<button onclick="closeLeaderboard()" style="width:100%;padding:10px;margin-top:10px;background:#ff3355;color:#fff;border:none;border-radius:8px;cursor:pointer;">Close</button>';
    return;
  }
  lbUI.innerHTML = `<h2 style="margin:0 0 12px; color:#ffd24a;">🏆 Leaderboard</h2>
    <div style="display:flex; gap:6px; margin-bottom:12px;">
      ${tabBtn('⏱ Time', 'time_played')}${tabBtn('P$', 'balance')}${tabBtn('C$', 'c_balance')}
    </div>
    <div id="lb-rows">Loading…</div>
    <button onclick="closeLeaderboard()" style="width:100%;padding:10px;margin-top:14px;background:#ff3355;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Close</button>`;

  const rows = await sbFetchLeaderboard(lbTab, 15);
  const valFor = (r) => lbTab === 'time_played' ? fmtTime(r.time_played)
    : lbTab === 'c_balance' ? 'C$ ' + (r.c_balance || 0)
    : 'P$ ' + (r.balance || 0);

  const me = window.currentPlayer && window.currentPlayer.username;
  const html = rows.length ? rows.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const mine = r.username === me;
    return `<div style="display:flex; justify-content:space-between; padding:7px 10px; border-radius:8px; margin:3px 0;
      background:${mine ? 'rgba(255,210,74,0.18)' : 'rgba(255,255,255,0.04)'};">
      <span style="width:34px;">${medal}</span>
      <span style="flex:1; ${mine ? 'color:#ffd24a;font-weight:700;' : ''}">${escapeHtml(r.username)}</span>
      <span style="color:#9fe; font-weight:700;">${valFor(r)}</span>
    </div>`;
  }).join('') : '<p style="color:#888;">No players yet.</p>';

  const box = document.getElementById('lb-rows');
  if (box) box.innerHTML = (lbTab === 'c_balance' ? '<p style="color:#888;font-size:12px;margin:0 0 6px;">C$ is coming in a later update.</p>' : '') + html;
}

// ---- admin console (only if is_admin) ----
let admView = 'players';     // 'players' | 'console'
let admLogFilter = 'all';
let admTimer = null;

function admTab(label, key) {
  const active = admView === key;
  return `<button onclick="admSwitch('${key}')" style="flex:1;padding:8px;cursor:pointer;border:none;border-radius:8px;font-weight:700;
    background:${active ? '#ff6b6b' : 'rgba(255,255,255,0.08)'};color:${active ? '#1a0606' : '#cdbff5'};">${label}</button>`;
}

function showAdminConsole() {
  if (!window.currentPlayer || !window.currentPlayer.is_admin) return;
  if (!lbUI) initLeaderboardUI();
  lbUI.style.display = 'block';
  renderAdmin();
}
function admSwitch(v) { admView = v; renderAdmin(); }
function admFilter(u) { admLogFilter = u; renderAdminBody(); }

function renderAdmin() {
  clearInterval(admTimer); admTimer = null;
  lbUI.innerHTML = `<h2 style="margin:0 0 10px; color:#ff6b6b;">🛡️ Admin Console</h2>
    <div style="display:flex; gap:6px; margin-bottom:12px;">${admTab('Players', 'players')}${admTab('Console', 'console')}</div>
    <div id="adm-body">Loading…</div>
    <button onclick="closeLeaderboard()" style="width:100%;padding:10px;margin-top:14px;background:#ff3355;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Close</button>`;
  renderAdminBody();
  if (admView === 'console') admTimer = setInterval(renderAdminBody, 1000); // live logs
}

async function renderAdminBody() {
  const box = document.getElementById('adm-body');
  if (!box) return;

  if (admView === 'players') {
    const all = (window.sbFetchAllPlayers) ? await sbFetchAllPlayers() : [];
    const rows = all.map(p => `<div style="display:flex; gap:8px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13px;">
        <span style="flex:1.4; ${p.is_admin ? 'color:#ff6b6b;font-weight:700;' : ''}">${escapeHtml(p.username)}${p.is_admin ? ' 🛡️' : ''}</span>
        <span style="flex:1; color:#ffd700;">P$ ${p.balance}</span>
        <span style="flex:0.8; color:#9fe;">C$ ${p.c_balance || 0}</span>
        <span style="flex:0.8; color:#aaa;">${fmtTime(p.time_played)}</span>
      </div>`).join('');
    box.innerHTML = `<div style="display:flex; gap:8px; padding:4px 8px; font-size:11px; color:#888; text-transform:uppercase;">
        <span style="flex:1.4;">Player (${all.length})</span><span style="flex:1;">P$</span><span style="flex:0.8;">C$</span><span style="flex:0.8;">Time</span>
      </div>` + (rows || '<p style="color:#888;">No players.</p>');
    return;
  }

  // console view: live logs forwarded from every client over MQTT
  const logs = window._remoteLogs || {};
  const users = Object.keys(logs);
  const filterBtns = ['all'].concat(users).map(u =>
    `<button onclick="admFilter('${escapeHtml(u)}')" style="padding:4px 8px;margin:2px;cursor:pointer;border:none;border-radius:6px;font-size:11px;
      background:${admLogFilter === u ? '#ffd24a' : 'rgba(255,255,255,0.08)'};color:${admLogFilter === u ? '#1a1006' : '#cdbff5'};">${u === 'all' ? 'All' : escapeHtml(u)}</button>`).join('');

  let lines = [];
  const pick = admLogFilter === 'all' ? users : (logs[admLogFilter] ? [admLogFilter] : []);
  pick.forEach(u => (logs[u] || []).forEach(e => lines.push({ u, ...e })));
  lines.sort((a, b) => a.t - b.t);
  lines = lines.slice(-200);

  const color = (l) => l === 'error' ? '#ff6b6b' : l === 'warn' ? '#ffd24a' : '#9fe';
  const body = lines.length ? lines.map(e =>
    `<div style="font-family:monospace;font-size:11px;padding:2px 0;color:${color(e.l)};border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:#888;">[${escapeHtml(e.u)}]</span> ${escapeHtml(e.m)}</div>`).join('')
    : '<p style="color:#888;">No logs yet. (Players send logs while connected.)</p>';

  box.innerHTML = `<div style="margin-bottom:8px;">${filterBtns}</div>
    <div style="max-height:42vh; overflow-y:auto; background:rgba(0,0,0,0.4); border-radius:8px; padding:8px;">${body}</div>`;
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

window.showLeaderboard = showLeaderboard;
window.closeLeaderboard = closeLeaderboard;
window.lbSwitch = lbSwitch;
window.showAdminConsole = showAdminConsole;
window.admSwitch = admSwitch;
window.admFilter = admFilter;
