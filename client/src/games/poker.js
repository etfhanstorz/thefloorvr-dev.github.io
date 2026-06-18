// Multiplayer 5-Card Draw (Stage 1: ante -> deal -> simultaneous draw -> showdown).
// The room HOST is the authoritative dealer; players talk to it over P2P (poker.*).
// Money is free-play P$: ante deducted client-side, pot awarded by host on win.

const PK_STAKE = 50;

// ---------- cards + hand evaluation ----------
function pkMakeDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const PK_RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const PK_SUITS = ['♠', '♥', '♦', '♣'];
function pkRankStr(r) { return PK_RANKS[r] || (r === 10 ? '10' : String(r)); }
function pkCardStr(c) { return pkRankStr(c.r) + PK_SUITS[c.s]; }
function pkIsRed(c) { return c.s === 1 || c.s === 2; }

// returns { score:[rank,...tiebreakers], name }
function pkEval(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const suits = cards.map(c => c.s);
  const flush = suits.every(s => s === suits[0]);
  // counts by rank
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const counts = groups.map(r => cnt[r]).sort((a, b) => b - a);
  // straight (incl. wheel A-2-3-4-5)
  let uniq = [...new Set(rs)];
  let straight = false, hi = uniq[0];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straight = true;
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; hi = 5; }
  }
  const tb = groups; // group ranks already ordered by count then rank
  if (straight && flush) return { score: [8, hi], name: 'Straight Flush' };
  if (counts[0] === 4) return { score: [7, ...tb], name: 'Four of a Kind' };
  if (counts[0] === 3 && counts[1] === 2) return { score: [6, ...tb], name: 'Full House' };
  if (flush) return { score: [5, ...rs], name: 'Flush' };
  if (straight) return { score: [4, hi], name: 'Straight' };
  if (counts[0] === 3) return { score: [3, ...tb], name: 'Three of a Kind' };
  if (counts[0] === 2 && counts[1] === 2) return { score: [2, ...tb], name: 'Two Pair' };
  if (counts[0] === 2) return { score: [1, ...tb], name: 'Pair' };
  return { score: [0, ...rs], name: 'High Card' };
}
function pkCmp(a, b) { // compare score arrays, >0 if a wins
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y;
  }
  return 0;
}

// ============================ HOST (dealer) ============================
let pkHost = null; // { phase, seats:[{id,name,hand,done}], pot, deck }

function pkPruneSeats() {
  if (!pkHost) return;
  const ids = new Set((window.pokerRoster ? pokerRoster() : []).map(p => p.id));
  pkHost.seats = pkHost.seats.filter(s => ids.has(s.id));
}

function pkPublic() {
  const showdown = pkHost.phase === 'showdown';
  return {
    phase: pkHost.phase,
    pot: pkHost.pot,
    stake: PK_STAKE,
    seats: pkHost.seats.map(s => ({
      id: s.id, name: s.name, done: s.done,
      hand: showdown ? s.hand : null,
      handName: showdown ? (s.hand ? pkEval(s.hand).name : '') : null,
      winner: showdown ? !!s.winner : false,
    })),
  };
}
function pkPushState() {
  pkPruneSeats();
  const msg = { t: 'poker', a: 'state', table: pkPublic() };
  if (window.pokerBroadcast) pokerBroadcast(msg);
  if (window.onPokerClientMsg) onPokerClientMsg(msg); // host's own view
}

window.onPokerHostMsg = function (fromId, msg) {
  if (!window.pokerIsHost || !pokerIsHost()) return;
  if (!pkHost) pkHost = { phase: 'idle', seats: [], pot: 0, deck: [] };

  if (msg.a === 'sit') {
    if (!pkHost.seats.find(s => s.id === fromId) && pkHost.seats.length < 5) {
      pkHost.seats.push({ id: fromId, name: msg.name || 'Player', hand: null, done: false, winner: false });
    }
    pkPushState();
  } else if (msg.a === 'leave') {
    pkHost.seats = pkHost.seats.filter(s => s.id !== fromId);
    pkPushState();
  } else if (msg.a === 'start') {
    if (pkHost.phase === 'idle' && pkHost.seats.length >= 2) pkStartHand();
  } else if (msg.a === 'draw') {
    pkApplyDraw(fromId, msg.discards || []);
  } else if (msg.a === 'hello') {
    if (window.pokerToPeer) pokerToPeer(fromId, { t: 'poker', a: 'state', table: pkPublic() });
  }
};

function pkStartHand() {
  pkPruneSeats();
  if (pkHost.seats.length < 2) return;
  pkHost.deck = pkMakeDeck();
  pkHost.pot = PK_STAKE * pkHost.seats.length;
  pkHost.phase = 'draw';
  pkHost.seats.forEach(s => {
    s.hand = pkHost.deck.splice(0, 5);
    s.done = false; s.winner = false;
    if (window.pokerToPeer) pokerToPeer(s.id, { t: 'poker', a: 'deal', hand: s.hand, ante: PK_STAKE });
  });
  pkPushState();
}

function pkApplyDraw(fromId, discards) {
  if (!pkHost || pkHost.phase !== 'draw') return;
  const s = pkHost.seats.find(x => x.id === fromId);
  if (!s || s.done || !s.hand) return;
  discards.slice(0, 5).forEach(idx => { if (idx >= 0 && idx < 5 && pkHost.deck.length) s.hand[idx] = pkHost.deck.pop(); });
  s.done = true;
  if (window.pokerToPeer) pokerToPeer(fromId, { t: 'poker', a: 'hand', hand: s.hand });
  pkPushState();
  if (pkHost.seats.every(x => x.done)) pkShowdown();
}

function pkShowdown() {
  let best = null;
  pkHost.seats.forEach(s => { s._score = pkEval(s.hand).score; if (!best || pkCmp(s._score, best) > 0) best = s._score; });
  const winners = pkHost.seats.filter(s => pkCmp(s._score, best) === 0);
  const share = Math.floor(pkHost.pot / winners.length);
  winners.forEach(s => { s.winner = true; if (window.pokerToPeer) pokerToPeer(s.id, { t: 'poker', a: 'win', amount: share }); });
  pkHost.phase = 'showdown';
  pkPushState();
  // next hand after a breather
  setTimeout(() => {
    if (!pkHost) return;
    pkHost.phase = 'idle';
    pkHost.seats.forEach(s => { s.hand = null; s.done = false; s.winner = false; });
    pkHost.pot = 0;
    pkPushState();
  }, 7000);
}

// ============================ CLIENT (UI) ============================
let pkUI = null;
let pkView = null;     // public table from host
let pkMyHand = null;   // private cards
let pkHolds = [true, true, true, true, true];
let pkSeated = false;

window.onPokerClientMsg = function (msg) {
  if (msg.a === 'state') { pkView = msg.table; const me = window.pokerMyId && pokerMyId(); pkSeated = !!(pkView.seats || []).find(s => s.id === me); renderPoker(); }
  else if (msg.a === 'deal') { pkMyHand = msg.hand; pkHolds = [true, true, true, true, true]; if (window.updateBalance) updateBalance(-(msg.ante || 0)); if (window.playSoundIfNotMuted) playSoundIfNotMuted('blackjack_deal'); renderPoker(); }
  else if (msg.a === 'hand') { pkMyHand = msg.hand; renderPoker(); }
  else if (msg.a === 'win') { if (window.updateBalance) updateBalance(msg.amount || 0); if (window.showToast) showToast(`🃏 You won the P$ ${msg.amount} pot!`, '#5dff8f'); }
};

function initPokerUI() {
  pkUI = document.createElement('div');
  pkUI.id = 'poker-ui';
  pkUI.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:480px; max-height:70vh; overflow-y:auto;
    background:rgba(10,6,20,0.96); border:2px solid #aa66ff; border-radius:14px; padding:16px; color:#fff;
    font-family:'Segoe UI',Arial,sans-serif; z-index:55; display:none; box-shadow:0 10px 40px rgba(0,0,0,0.6);`;
  document.body.appendChild(pkUI);
}
function showPoker() { if (!pkUI) initPokerUI(); pkUI.style.display = 'block'; if (!pkView && window.pokerToHost) pokerToHost({ t: 'poker', a: 'hello' }); renderPoker(); }
function closePoker() { if (pkUI) pkUI.style.display = 'none'; }

function pkSit() { pkSeated = true; if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'sit', name: (window.pokerMyName && pokerMyName()) || 'Player' }); }
function pkLeave() { pkSeated = false; pkMyHand = null; if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'leave' }); }
function pkStart() { if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'start' }); }
function pkToggleHold(i) { pkHolds[i] = !pkHolds[i]; renderPoker(); }
function pkDraw() {
  const discards = []; for (let i = 0; i < 5; i++) if (!pkHolds[i]) discards.push(i);
  if (window.playSoundIfNotMuted) playSoundIfNotMuted('click');
  if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'draw', discards });
  pkMyHand = null; // wait for replacement
  renderPoker();
}

function pkCardHtml(c, opts) {
  const o = opts || {};
  const col = pkIsRed(c) ? '#ff5577' : '#ddd';
  const held = o.held;
  return `<div ${o.onclick ? `onclick="${o.onclick}"` : ''} style="display:inline-flex; flex-direction:column; align-items:center; justify-content:center;
    width:46px; height:64px; margin:3px; border-radius:8px; cursor:${o.onclick ? 'pointer' : 'default'};
    background:#f3f0ff; color:${col}; font-weight:800; font-size:18px;
    border:3px solid ${held ? '#ffd24a' : 'transparent'}; box-shadow:0 2px 6px rgba(0,0,0,0.4);">
    <div>${pkRankStr(c.r)}</div><div>${PK_SUITS[c.s]}</div></div>`;
}

function renderPoker() {
  if (!pkUI) return;
  const me = window.pokerMyId && pokerMyId();
  const v = pkView || { phase: 'idle', pot: 0, seats: [], stake: PK_STAKE };
  let html = `<h3 style="margin:0 0 8px; color:#c9a3ff;">🃏 Five-Card Draw <span style="font-size:13px;color:#9fe;">Pot: P$ ${v.pot} · Ante P$ ${v.stake || PK_STAKE}</span></h3>`;

  // seats
  html += `<div style="font-size:12px; color:#aaa; margin-bottom:6px;">Players (${v.seats.length}/5) — ${v.phase}</div>`;
  html += (v.seats || []).map(s => {
    const mine = s.id === me;
    const tag = s.winner ? ' 🏆' : (s.done && v.phase === 'draw' ? ' ✓' : '');
    let cards = '';
    if (v.phase === 'showdown' && s.hand) cards = `<div>${s.hand.map(c => pkCardHtml(c, {})).join('')}</div><div style="font-size:11px;color:#9fe;">${s.handName}</div>`;
    return `<div style="padding:6px; margin:3px 0; border-radius:8px; background:${mine ? 'rgba(255,210,74,0.14)' : 'rgba(255,255,255,0.05)'};">
      <b style="color:${mine ? '#ffd24a' : '#fff'}">${escapePk(s.name)}${mine ? ' (you)' : ''}${tag}</b>${cards}</div>`;
  }).join('');

  // my controls
  if (!pkSeated) {
    html += `<button onclick="pkSit()" style="width:100%;padding:10px;margin-top:10px;background:#aa66ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Sit at table (ante P$ ${PK_STAKE})</button>`;
  } else {
    if (v.phase === 'idle') {
      html += `<div style="margin-top:8px;color:#9fe;font-size:13px;">${v.seats.length < 2 ? 'Waiting for another player…' : 'Ready.'}</div>`;
      if (v.seats.length >= 2) html += `<button onclick="pkStart()" style="width:100%;padding:10px;margin-top:6px;background:#117711;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Deal hand</button>`;
      html += `<button onclick="pkLeave()" style="width:100%;padding:8px;margin-top:6px;background:transparent;color:#f99;border:1px solid #f99;border-radius:8px;cursor:pointer;">Leave seat</button>`;
    } else if (v.phase === 'draw') {
      if (pkMyHand) {
        html += `<div style="margin-top:10px;font-size:12px;color:#aaa;">Your hand — tap cards to KEEP (gold). Untapped = discard.</div>`;
        html += `<div style="text-align:center;">${pkMyHand.map((c, i) => pkCardHtml(c, { held: pkHolds[i], onclick: `pkToggleHold(${i})` })).join('')}</div>`;
        html += `<div style="text-align:center;font-size:11px;color:#9fe;">${pkEval(pkMyHand).name}</div>`;
        html += `<button onclick="pkDraw()" style="width:100%;padding:10px;margin-top:8px;background:#ffd24a;color:#1a1006;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Draw / Stand</button>`;
      } else {
        html += `<div style="margin-top:10px;color:#9fe;">Waiting for other players to draw…</div>`;
      }
    } else if (v.phase === 'showdown') {
      const won = (v.seats.find(s => s.id === me) || {}).winner;
      html += `<div style="margin-top:10px;font-weight:700;color:${won ? '#5dff8f' : '#f99'};">${won ? '🏆 You won!' : 'Showdown — better luck next hand.'}</div>`;
    }
  }

  html += `<button onclick="closePoker()" style="width:100%;padding:8px;margin-top:10px;background:#ff3355;color:#fff;border:none;border-radius:8px;cursor:pointer;">Close</button>`;
  pkUI.innerHTML = html;
}

function escapePk(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

window.showPoker = showPoker;
window.closePoker = closePoker;
window.pkSit = pkSit; window.pkLeave = pkLeave; window.pkStart = pkStart;
window.pkToggleHold = pkToggleHold; window.pkDraw = pkDraw;
