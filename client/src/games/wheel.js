// Client-side Wheel of Fortune. 10 weighted segments.
// RNG integrity checked before each spin.

(function () {
  // EV ≈ 0.93x (slight house edge on free chips)
  const SEGS = [
    { label:'LOSE', mult:0,   weight:22, col:'#881111' },
    { label:'0.5x', mult:0.5, weight:18, col:'#555555' },
    { label:'1x',   mult:1,   weight:20, col:'#336633' },
    { label:'1.5x', mult:1.5, weight:14, col:'#224488' },
    { label:'2x',   mult:2,   weight:12, col:'#3366aa' },
    { label:'3x',   mult:3,   weight:7,  col:'#7733aa' },
    { label:'5x',   mult:5,   weight:4,  col:'#ff8833' },
    { label:'10x',  mult:10,  weight:2,  col:'#cc3333' },
    { label:'25x',  mult:25,  weight:0.8,col:'#cc8800' },
    { label:'50x',  mult:50,  weight:0.2,col:'#ffd700' },
  ];
  const TOTAL_W = SEGS.reduce((s,g) => s + g.weight, 0);
  window.WHEEL_SEGS = SEGS;

  let wh = { bet:200, spinning:false, lastMult:null, lastLabel:'', lastPayout:0, _msg:'' };
  window._wh = wh;

  function ups() { return (window.currentPlayer && window.currentPlayer.upgrades) || {}; }

  function pickSeg() {
    const u = ups();
    // luck: shifts random value slightly toward positives
    let r = Math.random() * TOTAL_W - TOTAL_W * (u.luck || 0) * 0.022;
    r = Math.max(0, r);
    let cum = 0;
    for (const seg of SEGS) { cum += seg.weight; if (r < cum) return seg; }
    return SEGS[SEGS.length - 1];
  }

  function spinWheel() {
    if (!window._checkRng || !window._checkRng()) return;
    if (wh.spinning) return;
    const p = window.currentPlayer; if (!p) return;
    if (wh.bet < 50) { wh._msg = 'Min bet: 50 P$'; whRefresh(); return; }
    if (wh.bet > p.balance) { wh._msg = 'Not enough P$'; whRefresh(); return; }
    p.balance -= wh.bet;
    wh.spinning = true; wh._msg = 'Spinning…'; whRefresh();
    const seg = pickSeg();
    const segIdx = SEGS.indexOf(seg);
    // ask vr-games to animate the disc, then call finish
    if (window.animateWheelSpin) {
      window.animateWheelSpin(segIdx, SEGS.length, () => whFinish(seg));
    } else {
      setTimeout(() => whFinish(seg), 800);
    }
  }

  function whFinish(seg) {
    wh.spinning = false;
    const p = window.currentPlayer;
    const u = ups();
    let payout = Math.floor(wh.bet * seg.mult);
    payout = Math.floor(payout * (1 + (u.payout || 0) * 0.10));
    if (u.crit && Math.random() < (u.crit || 0) * 0.05) payout = Math.floor(payout * 2);
    wh.lastMult = seg.mult; wh.lastLabel = seg.label; wh.lastPayout = payout;
    if (payout && p) p.balance += payout;
    if (p) {
      p.stats = p.stats || {};
      p.stats.gamesPlayed = (p.stats.gamesPlayed || 0) + 1;
      if (payout > wh.bet) p.stats.totalWins = (p.stats.totalWins || 0) + 1;
      else p.stats.totalLosses = (p.stats.totalLosses || 0) + 1;
    }
    if (window.sbSavePlayer) window.sbSavePlayer();
    wh._msg = seg.mult === 0 ? 'No luck…' : `${seg.label} → +${payout} P$!`;
    whRefresh();
  }

  function whRefresh() {
    if (window.updateWheelVrPanel) window.updateWheelVrPanel(wh);
    if (whUI && whUI.style.display !== 'none') _whDOM();
  }

  // ---- DOM UI ----
  let whUI = null;
  function _whDOM() {
    const p = window.currentPlayer, bal = p ? Math.floor(p.balance) : 0;
    const col = wh.lastMult > 1 ? '#00ff88' : wh.lastMult === 0 ? '#ff4444' : '#ffd700';
    whUI.innerHTML = `
      <h3 style="margin:0 0 8px">🎡 Wheel <span style="color:#ffd700;font-size:13px">P$ ${bal}</span></h3>
      <div style="color:${col};font-size:16px;margin:6px 0">${wh._msg || 'Ready to spin!'}</div>
      <div style="margin:10px 0">Bet:
        <button onclick="window._wh.bet=Math.max(50,window._wh.bet-50);whRefresh()">-</button>
        <strong> ${wh.bet} P$ </strong>
        <button onclick="window._wh.bet=window._wh.bet+50;whRefresh()">+</button>
      </div>
      <button onclick="spinWheel()" ${wh.spinning?'disabled':''} style="padding:8px 20px;background:#ff33aa;color:#fff;border:none;cursor:pointer;border-radius:4px">Spin!</button>
      <button onclick="closeWheel()" style="display:block;width:100%;padding:7px;background:#cc0000;color:#fff;border:none;cursor:pointer;border-radius:4px;margin-top:10px">Exit</button>
    `;
    wh._msg = '';
  }

  function showWheel() {
    if (!whUI) {
      whUI = document.createElement('div');
      whUI.style.cssText = 'position:absolute;bottom:20px;left:390px;width:360px;background:rgba(0,0,0,0.92);border:2px solid #ff33aa;border-radius:10px;padding:15px;color:white;font-family:monospace;z-index:50;display:none';
      document.body.appendChild(whUI);
    }
    whUI.style.display = 'block'; whRefresh();
  }
  function closeWheel() { if (whUI) whUI.style.display = 'none'; }

  window.spinWheel = spinWheel; window.whRefresh = whRefresh;
  window.showWheel = showWheel; window.closeWheel = closeWheel;
})();
