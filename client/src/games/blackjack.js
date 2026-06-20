// Client-side Blackjack vs house dealer. No server needed.
// Balance lives in window.currentPlayer; saved to Supabase on result.
// RNG integrity checked before each deal.

(function () {
  function mkDeck() {
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♠','♥','♦','♣'];
    const d = [];
    for (const r of ranks) for (const s of suits) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }
  function val(hand) {
    let v = 0, aces = 0;
    for (const c of hand) {
      if (c.r === 'A') { aces++; v += 11; }
      else if ('JQK'.includes(c.r)) v += 10;
      else v += parseInt(c.r);
    }
    while (v > 21 && aces--) v -= 10;
    return v;
  }
  const cs = c => c.r + c.s;

  let bj = { deck: [], player: [], dealer: [], bet: 200, phase: 'idle', result: '', payout: 0, _msg: '' };
  window._bj = bj;

  function ups() { return (window.currentPlayer && window.currentPlayer.upgrades) || {}; }
  function applyPayout(base) {
    const u = ups();
    let v = Math.floor(base * (1 + (u.payout || 0) * 0.10));
    if (u.crit && Math.random() < (u.crit || 0) * 0.05) v = Math.floor(v * 2);
    return v;
  }

  function bjDeal() {
    if (!window._checkRng || !window._checkRng()) return;
    const p = window.currentPlayer; if (!p) return;
    if (bj.bet < 50) { bj._msg = 'Min bet: 50 P$'; bjRefresh(); return; }
    if (bj.bet > p.balance) { bj._msg = 'Not enough P$'; bjRefresh(); return; }
    p.balance -= bj.bet;
    bj.deck = mkDeck();
    bj.player = [bj.deck.pop(), bj.deck.pop()];
    bj.dealer = [bj.deck.pop(), bj.deck.pop()];
    bj.phase = 'playing'; bj.result = ''; bj.payout = 0; bj._msg = '';
    if (val(bj.player) === 21) { bjStand(); return; }
    bjRefresh();
  }

  function bjHit() {
    if (!window._checkRng || !window._checkRng()) return;
    if (bj.phase !== 'playing') return;
    bj.player.push(bj.deck.pop());
    if (val(bj.player) > 21) bjFinish('bust'); else bjRefresh();
  }

  function bjDouble() {
    if (!window._checkRng || !window._checkRng()) return;
    if (bj.phase !== 'playing') return;
    const p = window.currentPlayer;
    if (!p || p.balance < bj.bet) { bj._msg = 'Not enough P$ to double'; bjRefresh(); return; }
    p.balance -= bj.bet; bj.bet *= 2;
    bj.player.push(bj.deck.pop());
    if (val(bj.player) > 21) bjFinish('bust'); else bjStand();
  }

  function bjStand() {
    if (!window._checkRng || !window._checkRng()) return;
    const u = ups();
    let target = 17;
    if (u.luck && Math.random() < (u.luck || 0) * 0.14) target = 18;
    while (val(bj.dealer) < target) bj.dealer.push(bj.deck.pop());
    const pv = val(bj.player), dv = val(bj.dealer);
    if (pv > 21) bjFinish('bust');
    else if (dv > 21 || pv > dv) bjFinish('win');
    else if (pv === dv) bjFinish('push');
    else bjFinish('lose');
  }

  function bjFinish(res) {
    bj.phase = 'done'; bj.result = res;
    const p = window.currentPlayer;
    let payout = 0;
    if (res === 'win') {
      const natural = bj.player.length === 2 && val(bj.player) === 21;
      payout = applyPayout(natural ? Math.floor(bj.bet * 2.5) : bj.bet * 2);
    } else if (res === 'push') { payout = bj.bet; }
    bj.payout = payout;
    if (payout && p) p.balance += payout;
    if (p) {
      p.stats = p.stats || {};
      p.stats.gamesPlayed = (p.stats.gamesPlayed || 0) + 1;
      if (res === 'win') p.stats.totalWins = (p.stats.totalWins || 0) + 1;
      else if (res === 'lose' || res === 'bust') p.stats.totalLosses = (p.stats.totalLosses || 0) + 1;
    }
    if (window.sbSavePlayer) window.sbSavePlayer();
    bjRefresh();
  }

  function bjRefresh() {
    if (window.updateBjVrPanel) window.updateBjVrPanel(bj);
    if (bjUI && bjUI.style.display !== 'none') _bjDOM();
  }

  // ---- DOM UI (desktop) ----
  let bjUI = null;
  function _bjDOM() {
    const p = window.currentPlayer, bal = p ? Math.floor(p.balance) : 0;
    const pv = bj.player.length ? val(bj.player) : '-';
    const dv = bj.phase !== 'playing' && bj.dealer.length ? val(bj.dealer) : '?';
    const dc = bj.phase === 'playing' ? (cs(bj.dealer[0]) + ' ?') : bj.dealer.map(cs).join(' ');
    const labels = { win:`WIN +${bj.payout}P$`, lose:'DEALER WINS', bust:'BUST!', push:'PUSH' };
    const clrs = { win:'#00ff88', lose:'#ff4444', bust:'#ff4444', push:'#ffd700' };
    bjUI.innerHTML = `
      <h3 style="margin:0 0 8px">♠ Blackjack <span style="color:#ffd700;font-size:13px">P$ ${bal}</span></h3>
      <div>Dealer: ${dc} (${dv})</div>
      <div style="margin:6px 0">You: ${bj.player.map(cs).join(' ')||'-'} (${pv})</div>
      ${bj.result ? `<div style="color:${clrs[bj.result]};font-size:20px;font-weight:bold;margin:8px 0">${labels[bj.result]}</div>` : ''}
      ${bj._msg ? `<div style="color:#ff9900;margin:4px 0">${bj._msg}</div>` : ''}
      ${bj.phase !== 'playing' ? `
        <div style="margin:8px 0">Bet:
          <button onclick="window._bj.bet=Math.max(50,window._bj.bet-50);bjRefresh()">-</button>
          <strong> ${bj.bet} P$ </strong>
          <button onclick="window._bj.bet=window._bj.bet+50;bjRefresh()">+</button>
        </div>
        <button onclick="bjDeal()" style="padding:8px 20px;background:#00cc44;color:#000;border:none;cursor:pointer;border-radius:4px">Deal</button>
      ` : `
        <button onclick="bjHit()" style="padding:8px 14px;background:#0066ff;color:#fff;border:none;cursor:pointer;border-radius:4px;margin-right:6px">Hit</button>
        <button onclick="bjStand()" style="padding:8px 14px;background:#ff6600;color:#fff;border:none;cursor:pointer;border-radius:4px;margin-right:6px">Stand</button>
        <button onclick="bjDouble()" style="padding:8px 14px;background:#9900cc;color:#fff;border:none;cursor:pointer;border-radius:4px">Double</button>
      `}
      <button onclick="closeBlackjack()" style="display:block;width:100%;padding:7px;background:#cc0000;color:#fff;border:none;cursor:pointer;border-radius:4px;margin-top:10px">Exit</button>
    `;
  }

  function showBlackjack() {
    if (!bjUI) {
      bjUI = document.createElement('div');
      bjUI.style.cssText = 'position:absolute;bottom:20px;left:20px;width:400px;background:rgba(0,0,0,0.92);border:2px solid #ffd24a;border-radius:10px;padding:15px;color:white;font-family:monospace;z-index:50;display:none';
      document.body.appendChild(bjUI);
    }
    bjUI.style.display = 'block'; bjRefresh();
  }
  function closeBlackjack() { if (bjUI) bjUI.style.display = 'none'; }

  window.bjDeal = bjDeal; window.bjHit = bjHit; window.bjStand = bjStand; window.bjDouble = bjDouble;
  window.bjRefresh = bjRefresh; window.showBlackjack = showBlackjack; window.closeBlackjack = closeBlackjack;
})();
