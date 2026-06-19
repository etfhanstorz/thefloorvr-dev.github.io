// Multiplayer 5-Card Draw poker (Stage 2: ante + two betting rounds + draw).
// Flow: ante -> deal -> BET round 1 -> draw -> BET round 2 -> showdown.
// Room HOST is the authoritative dealer over P2P. Free-play P$: host directs all
// charges (ante/bets) and the pot payout via private messages.

const PK_STAKE = 50;     // ante + bet/raise unit
const PK_MAX_RAISES = 3; // per betting round
const PK_TURN_MS = 45000;

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

function pkEval(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const suits = cards.map(c => c.s);
  const flush = suits.every(s => s === suits[0]);
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  const counts = groups.map(r => cnt[r]).sort((a, b) => b - a);
  let uniq = [...new Set(rs)]; let straight = false, hi = uniq[0];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straight = true;
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) { straight = true; hi = 5; }
  }
  const tb = groups;
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
function pkCmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; }

// ============================ HOST (dealer) ============================
// pkHost.seats[i] = { id, name, hand, folded, done, committedRound, totalCommitted, acted, winner }
let pkHost = null;
let pkTurnTimer = null;

function pkPrune() {
  if (!pkHost) return;
  const ids = new Set((window.pokerRoster ? pokerRoster() : []).map(p => p.id));
  pkHost.seats = pkHost.seats.filter(s => ids.has(s.id));
}
function pkActive() { return pkHost.seats.filter(s => !s.folded); }
function pkSeat(id) { return pkHost.seats.find(s => s.id === id); }

function pkPublic() {
  const showdown = pkHost.phase === 'showdown';
  return {
    phase: pkHost.phase, pot: pkHost.pot, stake: PK_STAKE,
    dealerIndex: pkHost.dealerIndex >= 0 ? pkHost.dealerIndex : 0,
    toCall: pkHost.toCall || 0, currentTurn: pkHost.currentTurn || null, raises: pkHost.raises || 0, maxRaises: PK_MAX_RAISES,
    seats: pkHost.seats.map(s => ({
      id: s.id, name: s.name, folded: s.folded, done: s.done,
      committedRound: s.committedRound || 0, totalCommitted: s.totalCommitted || 0, acted: s.acted, allin: !!s.allin,
      hand: (showdown && !s.folded) ? s.hand : null,
      handName: (showdown && !s.folded && s.hand) ? pkEval(s.hand).name : null,
      winner: showdown ? !!s.winner : false,
    })),
  };
}
function pkPushState() {
  pkPrune();
  const msg = { t: 'poker', a: 'state', table: pkPublic() };
  if (window.pokerBroadcast) pokerBroadcast(msg);
  if (window.onPokerClientMsg) onPokerClientMsg(msg); // host updates its own 3D table here too
}
function pkCharge(s, amount) {
  if (amount <= 0) return;
  s.committedRound += amount; s.totalCommitted += amount; pkHost.pot += amount;
  if (window.pokerToPeer) pokerToPeer(s.id, { t: 'poker', a: 'charge', amount });
}

window.onPokerHostMsg = function (fromId, msg) {
  if (!window.pokerIsHost || !pokerIsHost()) return;
  if (!pkHost) pkHost = { phase: 'idle', seats: [], pot: 0, dealerIndex: -1 };

  if (msg.a === 'sit') {
    if (!pkSeat(fromId) && pkHost.seats.length < 5) pkHost.seats.push({ id: fromId, name: msg.name || 'Player' });
    pkPushState();
  } else if (msg.a === 'leave') {
    const s = pkSeat(fromId); if (s) s.folded = true;
    pkHost.seats = pkHost.seats.filter(x => x.id !== fromId);
    pkPushState();
  } else if (msg.a === 'start') {
    if (pkHost.phase === 'idle' && pkHost.seats.length >= 2) pkStartHand();
  } else if (msg.a === 'draw') {
    pkApplyDraw(fromId, msg.discards || []);
  } else if (msg.a === 'bet-action') {
    pkHandleBet(fromId, msg.act, msg.amount);
  } else if (msg.a === 'hello') {
    if (window.pokerToPeer) pokerToPeer(fromId, { t: 'poker', a: 'state', table: pkPublic() });
  }
};

function pkStartHand() {
  pkPrune();
  if (pkHost.seats.length < 2) return;
  pkHost.deck = pkMakeDeck();
  pkHost.pot = 0;
  pkHost.dealerIndex = (pkHost.dealerIndex + 1) % pkHost.seats.length;
  pkHost.seats.forEach(s => {
    s.hand = pkHost.deck.splice(0, 5);
    s.folded = false; s.done = false; s.winner = false; s.allin = false;
    s.committedRound = 0; s.totalCommitted = 0; s.acted = false;
    pkCharge(s, PK_STAKE); // ante
    if (window.pokerToPeer) pokerToPeer(s.id, { t: 'poker', a: 'deal', hand: s.hand });
  });
  console.log('🃏 DEAL — antes in, pot P$ ' + pkHost.pot);
  pkHost.seats.forEach(s => console.log(`  ${s.name}: ${s.hand.map(pkCardStr).join(' ')} (${pkEval(s.hand).name})`));
  pkBeginBetting('bet1');
}

function pkBeginBetting(phase) {
  pkHost.phase = phase;
  pkHost.toCall = 0; pkHost.raises = 0;
  pkHost.seats.forEach(s => { s.committedRound = 0; s.acted = !!s.allin; });
  // if 0 or 1 players can still act (rest folded/all-in), there's no betting this round
  if (pkActive().filter(s => !s.allin).length <= 1) { pkHost.currentTurn = null; pkPushState(); pkEndBettingRound(); return; }
  // first to act = first non-folded, non-all-in seat left of dealer
  const n = pkHost.seats.length;
  let idx = (pkHost.dealerIndex + 1) % n;
  for (let k = 0; k < n; k++) { const s = pkHost.seats[idx]; if (!s.folded && !s.allin) break; idx = (idx + 1) % n; }
  pkHost.currentTurn = pkHost.seats[idx].id;
  pkArmTimer();
  pkPushState();
}

function pkArmTimer() {
  clearTimeout(pkTurnTimer);
  pkTurnTimer = setTimeout(() => { if (pkHost && pkHost.currentTurn) pkHandleBet(pkHost.currentTurn, 'fold'); }, PK_TURN_MS);
}

function pkNextToAct() {
  const n = pkHost.seats.length;
  const ci = pkHost.seats.findIndex(s => s.id === pkHost.currentTurn);
  for (let k = 1; k <= n; k++) {
    const s = pkHost.seats[(ci + k) % n];
    if (!s.folded && !s.allin && (!s.acted || s.committedRound < pkHost.toCall)) return s;
  }
  return null;
}

function pkHandleBet(fromId, act, amount) {
  if (!pkHost || (pkHost.phase !== 'bet1' && pkHost.phase !== 'bet2')) return;
  if (pkHost.currentTurn !== fromId) return;
  const s = pkSeat(fromId); if (!s || s.folded || s.allin) return;
  const unit = PK_STAKE;

  if (act === 'fold') { s.folded = true; s.acted = true; }
  else if (act === 'check') { if (s.committedRound !== pkHost.toCall) return; s.acted = true; }
  else if (act === 'call') { const cost = pkHost.toCall - s.committedRound; if (cost <= 0) return; pkCharge(s, cost); s.acted = true; }
  else if (act === 'bet') { if (pkHost.toCall !== 0) return; pkCharge(s, unit); pkHost.toCall = unit; pkHost.raises = 1; pkActive().forEach(x => { if (x !== s) x.acted = false; }); s.acted = true; }
  else if (act === 'raise') { if (pkHost.toCall === 0 || pkHost.raises >= PK_MAX_RAISES) return; const cost = (pkHost.toCall - s.committedRound) + unit; pkCharge(s, cost); pkHost.toCall += unit; pkHost.raises++; pkActive().forEach(x => { if (x !== s) x.acted = false; }); s.acted = true; }
  else if (act === 'allin') {
    const amt = Math.max(0, amount | 0); if (amt <= 0) return;
    pkCharge(s, amt); s.allin = true; s.acted = true;
    // an all-in that exceeds the current bet sets a new line others must answer
    if (s.committedRound > pkHost.toCall) { pkHost.toCall = s.committedRound; pkActive().forEach(x => { if (x !== s && !x.allin) x.acted = false; }); }
  }
  else return;

  console.log(`  ${s.name} ${act}${pkHost.toCall ? ' (toCall ' + pkHost.toCall + ')' : ''}`);

  // everyone folded but one -> they win
  if (pkActive().length === 1) { pkAwardSingle(pkActive()[0]); return; }

  const next = pkNextToAct();
  if (next) { pkHost.currentTurn = next.id; pkArmTimer(); pkPushState(); }
  else { clearTimeout(pkTurnTimer); pkEndBettingRound(); }
}

function pkEndBettingRound() {
  if (pkHost.phase === 'bet1') {
    // go to draw
    pkHost.phase = 'draw';
    pkHost.seats.forEach(s => { s.done = s.folded; }); // folded auto-done
    pkHost.currentTurn = null;
    pkPushState();
    if (pkActive().every(s => s.done)) pkBeginBetting('bet2');
  } else {
    pkShowdown();
  }
}

function pkApplyDraw(fromId, discards) {
  if (!pkHost || pkHost.phase !== 'draw') return;
  const s = pkSeat(fromId);
  if (!s || s.done || s.folded || !s.hand) return;
  discards.slice(0, 5).forEach(idx => { if (idx >= 0 && idx < 5 && pkHost.deck.length) s.hand[idx] = pkHost.deck.pop(); });
  s.done = true;
  console.log(`  ${s.name} drew ${discards.length} → ${s.hand.map(pkCardStr).join(' ')} (${pkEval(s.hand).name})`);
  if (window.pokerToPeer) pokerToPeer(fromId, { t: 'poker', a: 'hand', hand: s.hand });
  pkPushState();
  if (pkActive().every(x => x.done)) pkBeginBetting('bet2');
}

function pkAwardSingle(winner) {
  clearTimeout(pkTurnTimer);
  winner.winner = true;
  console.log(`  🏆 ${winner.name} wins P$ ${pkHost.pot} (everyone folded)`);
  if (window.pokerToPeer) pokerToPeer(winner.id, { t: 'poker', a: 'win', amount: pkHost.pot });
  pkHost.phase = 'showdown';
  pkPushState();
  pkResetSoon();
}

// Split the pot into main + side pots by each player's total contribution.
// Folded players' chips stay in the pot but they can't win; only non-folded
// players are eligible for a layer they paid into.
function pkBuildPots() {
  const contribs = pkHost.seats.filter(s => (s.totalCommitted || 0) > 0).map(s => ({ s, rem: s.totalCommitted }));
  const pots = [];
  while (true) {
    const live = contribs.filter(c => c.rem > 0);
    if (!live.length) break;
    const level = Math.min(...live.map(c => c.rem));
    let amount = 0; const eligible = [];
    live.forEach(c => { amount += level; c.rem -= level; if (!c.s.folded) eligible.push(c.s); });
    if (eligible.length) pots.push({ amount, eligible });
    else if (pots.length) pots[pots.length - 1].amount += amount; // dead chips fold into last real pot
  }
  return pots;
}

function pkShowdown() {
  clearTimeout(pkTurnTimer);
  const contenders = pkActive();
  contenders.forEach(s => { const e = pkEval(s.hand); s._score = e.score; s._name = e.name; });
  console.log('🃏 SHOWDOWN — pot P$ ' + pkHost.pot);
  contenders.forEach(s => console.log(`  ${s.name}: ${s.hand.map(pkCardStr).join(' ')} → ${s._name}`));

  const pots = pkBuildPots();
  const winnings = {};
  pots.forEach((pot, pi) => {
    let best = null;
    pot.eligible.forEach(s => { if (!best || pkCmp(s._score, best) > 0) best = s._score; });
    const winners = pot.eligible.filter(s => pkCmp(s._score, best) === 0);
    const share = Math.floor(pot.amount / winners.length);
    let rem = pot.amount - share * winners.length; // odd chips → first winner(s)
    winners.forEach(s => { s.winner = true; winnings[s.id] = (winnings[s.id] || 0) + share + (rem-- > 0 ? 1 : 0); });
    console.log(`  ${pots.length > 1 ? (pi === 0 ? 'main pot' : 'side pot ' + pi) : 'pot'} P$ ${pot.amount} → ${winners.map(w => w.name + ' (' + w._name + ')').join(', ')}`);
  });
  Object.keys(winnings).forEach(id => { if (window.pokerToPeer) pokerToPeer(id, { t: 'poker', a: 'win', amount: winnings[id] }); });

  pkHost.phase = 'showdown';
  pkPushState();
  pkResetSoon();
}

function pkResetSoon() {
  setTimeout(() => {
    if (!pkHost) return;
    pkHost.phase = 'idle'; pkHost.pot = 0; pkHost.toCall = 0; pkHost.currentTurn = null;
    pkHost.seats.forEach(s => { s.hand = null; s.folded = false; s.done = false; s.winner = false; s.allin = false; s.committedRound = 0; s.totalCommitted = 0; s.acted = false; });
    pkPushState();
  }, 8000);
}

// ============================ CLIENT (UI) ============================
let pkUI = null, pkView = null, pkMyHand = null, pkHolds = [true, true, true, true, true], pkSeated = false;

window.onPokerClientMsg = function (msg) {
  if (msg.a === 'state') { pkView = msg.table; const me = window.pokerMyId && pokerMyId(); pkSeated = !!(pkView.seats || []).find(s => s.id === me); if (window.updatePokerTable) updatePokerTable(pkView); renderPoker(); }
  else if (msg.a === 'deal') { pkMyHand = msg.hand; pkHolds = [true, true, true, true, true]; if (window.playSoundIfNotMuted) playSoundIfNotMuted('blackjack_deal'); renderPoker(); }
  else if (msg.a === 'hand') { pkMyHand = msg.hand; renderPoker(); }
  else if (msg.a === 'charge') { if (window.updateBalance) updateBalance(-(msg.amount || 0)); }
  else if (msg.a === 'win') { if (window.updateBalance) updateBalance(msg.amount || 0); if (window.showToast) showToast(`🃏 You won the P$ ${msg.amount} pot!`, '#5dff8f'); }
};

function initPokerUI() {
  pkUI = document.createElement('div');
  pkUI.id = 'poker-ui';
  pkUI.style.cssText = `position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:500px; max-height:72vh; overflow-y:auto;
    background:rgba(10,6,20,0.96); border:2px solid #aa66ff; border-radius:14px; padding:16px; color:#fff;
    font-family:'Segoe UI',Arial,sans-serif; z-index:55; display:none; box-shadow:0 10px 40px rgba(0,0,0,0.6);`;
  document.body.appendChild(pkUI);
}
function showPoker() { if (!pkUI) initPokerUI(); pkUI.style.display = 'block'; if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'hello' }); renderPoker(); }
function closePoker() { if (pkUI) pkUI.style.display = 'none'; }
function pkSit() { pkSeated = true; if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'sit', name: (window.pokerMyName && pokerMyName()) || 'Player' }); }
function pkLeave() { pkSeated = false; pkMyHand = null; if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'leave' }); }
function pkStart() { if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'start' }); }
function pkToggleHold(i) { pkHolds[i] = !pkHolds[i]; renderPoker(); }
function pkDraw() { const d = []; for (let i = 0; i < 5; i++) if (!pkHolds[i]) d.push(i); if (window.playSoundIfNotMuted) playSoundIfNotMuted('click'); if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'draw', discards: d }); pkMyHand = null; renderPoker(); }
function pkAct(act, amount) { if (window.pokerToHost) pokerToHost({ t: 'poker', a: 'bet-action', act, amount }); if (window.playSoundIfNotMuted) playSoundIfNotMuted('click'); }

function pkCardHtml(c, o) {
  o = o || {}; const col = pkIsRed(c) ? '#ff5577' : '#222';
  return `<div ${o.onclick ? `onclick="${o.onclick}"` : ''} style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
    width:44px;height:62px;margin:3px;border-radius:8px;cursor:${o.onclick ? 'pointer' : 'default'};
    background:#f3f0ff;color:${col};font-weight:800;font-size:17px;border:3px solid ${o.held ? '#ffd24a' : 'transparent'};box-shadow:0 2px 6px rgba(0,0,0,0.4);">
    <div>${pkRankStr(c.r)}</div><div>${PK_SUITS[c.s]}</div></div>`;
}
function escapePk(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderPoker() {
  if (window.onPokerUiChange) onPokerUiChange(pkView); // drive the in-world VR panel (works without the DOM overlay)
  if (!pkUI) return;
  const me = window.pokerMyId && pokerMyId();
  const v = pkView || { phase: 'idle', pot: 0, seats: [], stake: PK_STAKE, toCall: 0 };
  const myBal = Math.floor((window.currentPlayer && window.currentPlayer.balance) || 0);
  let html = `<h3 style="margin:0 0 6px;color:#c9a3ff;">🃏 Five-Card Draw <span style="font-size:13px;color:#9fe;">Pot P$ ${v.pot} · Ante P$ ${v.stake}</span></h3>`;
  html += `<div style="font-size:12px;color:#aaa;margin-bottom:6px;">${v.seats.length}/5 players · ${v.phase}${v.toCall ? ' · to call P$ ' + v.toCall : ''}</div>`;

  html += (v.seats || []).map(s => {
    const mine = s.id === me, turn = s.id === v.currentTurn;
    const tag = s.winner ? ' 🏆' : s.folded ? ' ❌' : s.allin ? ' 🔴 ALL-IN' : (turn ? ' ⬅️' : (s.done && v.phase === 'draw' ? ' ✓' : ''));
    let cards = '';
    if (v.phase === 'showdown' && s.hand) cards = `<div>${s.hand.map(c => pkCardHtml(c, {})).join('')}</div><div style="font-size:11px;color:#9fe;">${s.handName}</div>`;
    return `<div style="padding:6px;margin:3px 0;border-radius:8px;background:${turn ? 'rgba(255,210,74,0.18)' : mine ? 'rgba(170,102,255,0.14)' : 'rgba(255,255,255,0.05)'};opacity:${s.folded ? 0.5 : 1};">
      <b style="color:${mine ? '#ffd24a' : '#fff'}">${escapePk(s.name)}${mine ? ' (you)' : ''}${tag}</b>
      <span style="float:right;color:#9fe;font-size:12px;">${s.totalCommitted ? 'bet ' + s.totalCommitted : ''}</span>${cards}</div>`;
  }).join('');

  if (!pkSeated) {
    html += `<button onclick="pkSit()" style="width:100%;padding:10px;margin-top:10px;background:#aa66ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Sit (ante P$ ${PK_STAKE})</button>`;
  } else if (v.phase === 'idle') {
    html += `<div style="margin-top:8px;color:#9fe;font-size:13px;">${v.seats.length < 2 ? 'Waiting for another player…' : 'Ready.'}</div>`;
    if (v.seats.length >= 2) html += `<button onclick="pkStart()" style="width:100%;padding:10px;margin-top:6px;background:#117711;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Deal hand</button>`;
    html += `<button onclick="pkLeave()" style="width:100%;padding:8px;margin-top:6px;background:transparent;color:#f99;border:1px solid #f99;border-radius:8px;cursor:pointer;">Leave seat</button>`;
  } else if (v.phase === 'bet1' || v.phase === 'bet2') {
    if (pkMyHand) { html += `<div style="text-align:center;margin-top:8px;">${pkMyHand.map(c => pkCardHtml(c, {})).join('')}</div><div style="text-align:center;font-size:11px;color:#9fe;">${pkEval(pkMyHand).name}</div>`; }
    const mySeat = v.seats.find(s => s.id === me);
    if (v.currentTurn === me && mySeat && !mySeat.folded) {
      const callCost = Math.max(0, v.toCall - (mySeat.committedRound || 0));
      html += `<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">`;
      html += pkBtn('Fold', '#ff3355', `pkAct('fold')`);
      if (v.toCall === 0) {
        html += pkBtn('Check', '#444', `pkAct('check')`);
        if (PK_STAKE <= myBal) html += pkBtn(`Bet ${PK_STAKE}`, '#aa6600', `pkAct('bet')`);
      } else {
        if (callCost > 0 && callCost <= myBal) html += pkBtn(`Call ${callCost}`, '#117711', `pkAct('call')`);
        if (v.raises < v.maxRaises && callCost + PK_STAKE <= myBal) html += pkBtn(`Raise ${PK_STAKE}`, '#aa6600', `pkAct('raise')`);
      }
      if (myBal > 0) html += pkBtn(`All-in ${myBal}`, '#cc33ff', `pkAct('allin', ${myBal})`);
      html += `</div>`;
    } else {
      const t = v.seats.find(s => s.id === v.currentTurn);
      html += `<div style="margin-top:10px;color:#9fe;">Waiting for ${t ? escapePk(t.name) : '…'} to act…</div>`;
    }
  } else if (v.phase === 'draw') {
    const mySeat = v.seats.find(s => s.id === me);
    if (mySeat && mySeat.folded) html += `<div style="margin-top:10px;color:#f99;">You folded — waiting for showdown…</div>`;
    else if (pkMyHand) {
      html += `<div style="margin-top:10px;font-size:12px;color:#aaa;">Tap cards to KEEP (gold); untapped get discarded.</div>`;
      html += `<div style="text-align:center;">${pkMyHand.map((c, i) => pkCardHtml(c, { held: pkHolds[i], onclick: `pkToggleHold(${i})` })).join('')}</div>`;
      html += `<div style="text-align:center;font-size:11px;color:#9fe;">${pkEval(pkMyHand).name}</div>`;
      html += `<button onclick="pkDraw()" style="width:100%;padding:10px;margin-top:8px;background:#ffd24a;color:#1a1006;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Draw / Stand</button>`;
    } else html += `<div style="margin-top:10px;color:#9fe;">Waiting for other players to draw…</div>`;
  } else if (v.phase === 'showdown') {
    const won = (v.seats.find(s => s.id === me) || {}).winner;
    html += `<div style="margin-top:10px;font-weight:700;color:${won ? '#5dff8f' : '#f99'};">${won ? '🏆 You won!' : 'Showdown'}</div>`;
  }

  html += `<button onclick="closePoker()" style="width:100%;padding:8px;margin-top:10px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;">Close</button>`;
  pkUI.innerHTML = html;
}
function pkBtn(label, bg, onclick) {
  return `<button ${onclick ? `onclick="${onclick}"` : 'disabled'} style="flex:1;min-width:80px;padding:10px;background:${bg};color:#fff;border:none;border-radius:8px;cursor:${onclick ? 'pointer' : 'not-allowed'};font-weight:700;">${label}</button>`;
}

window.showPoker = showPoker; window.closePoker = closePoker;
window.pkSit = pkSit; window.pkLeave = pkLeave; window.pkStart = pkStart;
window.pkToggleHold = pkToggleHold; window.pkDraw = pkDraw; window.pkAct = pkAct;
// read-only accessors for the in-world VR panel (poker-table.js)
window.pokerHand = () => pkMyHand; window.pokerHolds = () => pkHolds;
window.pokerViewState = () => pkView; window.pokerStake = () => PK_STAKE;
