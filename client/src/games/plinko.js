// Client-side Plinko. Ball through 8 peg rows → 9 buckets with multipliers.
// RNG integrity checked before each drop.

(function () {
  const MULTS = [10, 3, 2, 1.5, 0.5, 1.5, 2, 3, 10];
  const COLS  = ['#ffd700','#ff8833','#33cc66','#3399ff','#555','#3399ff','#33cc66','#ff8833','#ffd700'];
  window.PLINKO_MULTS = MULTS; window.PLINKO_COLS = COLS;

  let pl = { bet:200, dropping:false, lastBucket:null, lastMult:null, lastPayout:0, path:[], _msg:'' };
  window._pl = pl;

  function ups() { return (window.currentPlayer && window.currentPlayer.upgrades) || {}; }

  function playPlinko() {
    if (!window._checkRng || !window._checkRng()) return;
    if (pl.dropping) return;
    const p = window.currentPlayer; if (!p) return;
    if (pl.bet < 50) { pl._msg = 'Min bet: 50 P$'; plRefresh(); return; }
    if (pl.bet > p.balance) { pl._msg = 'Not enough P$'; plRefresh(); return; }
    p.balance -= pl.bet;
    pl.dropping = true; pl._msg = 'Dropping…'; plRefresh();
    const u = ups();
    const bias = (u.luck || 0) * 0.06; // luck biases ball toward center
    const path = [];
    for (let i = 0; i < 8; i++) {
      const pos = path.reduce((s,v) => s+v, 0); // current x offset (0-i)
      const center = i / 2;
      const centerPull = pos < center ? bias : -bias;
      path.push(Math.random() < 0.5 + centerPull ? 1 : 0);
    }
    const bucket = path.reduce((s,v) => s+v, 0); // 0-8
    pl.path = path;
    if (window.animatePlinkoDrop) {
      window.animatePlinkoDrop(path, 1800, () => plFinish(bucket));
    } else {
      setTimeout(() => plFinish(bucket), 600);
    }
  }

  function plFinish(bucket) {
    pl.dropping = false;
    const p = window.currentPlayer;
    const u = ups();
    const mult = MULTS[bucket];
    let payout = Math.floor(pl.bet * mult);
    payout = Math.floor(payout * (1 + (u.payout || 0) * 0.10));
    if (u.crit && Math.random() < (u.crit || 0) * 0.05) payout = Math.floor(payout * 2);
    pl.lastBucket = bucket; pl.lastMult = mult; pl.lastPayout = payout;
    if (payout && p) p.balance += payout;
    if (p) {
      p.stats = p.stats || {};
      p.stats.gamesPlayed = (p.stats.gamesPlayed || 0) + 1;
      if (payout > pl.bet) p.stats.totalWins = (p.stats.totalWins || 0) + 1;
      else p.stats.totalLosses = (p.stats.totalLosses || 0) + 1;
    }
    if (window.sbSavePlayer) window.sbSavePlayer();
    pl._msg = mult === 0.5 ? `0.5x → half back (${payout}P$)` : mult > 1 ? `${mult}x → +${payout} P$!` : 'Just the bucket…';
    plRefresh();
  }

  function plRefresh() {
    if (window.updatePlinkoVrPanel) window.updatePlinkoVrPanel(pl);
    if (plUI && plUI.style.display !== 'none') _plDOM();
  }

  // ---- DOM UI ----
  let plUI = null;
  function _plDOM() {
    const p = window.currentPlayer, bal = p ? Math.floor(p.balance) : 0;
    const buckets = MULTS.map((m,i) => {
      const active = pl.lastBucket === i;
      return `<span style="background:${COLS[i]};color:#000;padding:2px 5px;border-radius:3px;font-weight:${active?'900':'400'};outline:${active?'2px solid #fff':'none'}">${m}x</span>`;
    }).join(' ');
    const col = pl.lastMult && pl.lastMult > 1 ? '#00ff88' : '#ff9900';
    plUI.innerHTML = `
      <h3 style="margin:0 0 8px">🎯 Plinko <span style="color:#ffd700;font-size:13px">P$ ${bal}</span></h3>
      <div style="color:${col};font-size:15px;margin:6px 0">${pl._msg || 'Drop the ball!'}</div>
      <div style="margin:8px 0;font-size:12px;line-height:1.8">${buckets}</div>
      <div style="margin:10px 0">Bet:
        <button onclick="window._pl.bet=Math.max(50,window._pl.bet-50);plRefresh()">-</button>
        <strong> ${pl.bet} P$ </strong>
        <button onclick="window._pl.bet=window._pl.bet+50;plRefresh()">+</button>
      </div>
      <button onclick="playPlinko()" ${pl.dropping?'disabled':''} style="padding:8px 20px;background:#33ccff;color:#000;border:none;cursor:pointer;border-radius:4px">Drop!</button>
      <button onclick="closePlinko()" style="display:block;width:100%;padding:7px;background:#cc0000;color:#fff;border:none;cursor:pointer;border-radius:4px;margin-top:10px">Exit</button>
    `;
    pl._msg = '';
  }

  function showPlinko() {
    if (!plUI) {
      plUI = document.createElement('div');
      plUI.style.cssText = 'position:absolute;bottom:20px;left:20px;width:360px;background:rgba(0,0,0,0.92);border:2px solid #33ccff;border-radius:10px;padding:15px;color:white;font-family:monospace;z-index:50;display:none';
      document.body.appendChild(plUI);
    }
    plUI.style.display = 'block'; plRefresh();
  }
  function closePlinko() { if (plUI) plUI.style.display = 'none'; }

  window.playPlinko = playPlinko; window.plRefresh = plRefresh;
  window.showPlinko = showPlinko; window.closePlinko = closePlinko;
})();
