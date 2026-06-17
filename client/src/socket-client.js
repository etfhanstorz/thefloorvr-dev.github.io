// Client initialization for PeerJS P2P and MQTT admin events

let currentPlayerId = null;

function initializeGame() {
  // Load player data from localStorage
  if (window.loadPlayerData) loadPlayerData();

  // Game UIs (overlays)
  if (window.initBlackjackUI) initBlackjackUI();
  if (window.initPlinkoUI) initPlinkoUI();
  if (window.initWheelUI) initWheelUI();
  if (window.initShopUI) initShopUI();

  // The 3D scene + local avatar (main.js). Must exist before peers send state.
  if (window.initGameScene) initGameScene();

  // P2P multiplayer (PeerJS) — discovers/creates a room, no server needed.
  if (window.initPeer) {
    initPeer().then(() => console.log('✓ PeerJS ready')).catch(e => console.error('PeerJS failed', e));
  }

  // Discord admin events (MQTT public broker).
  if (window.initMqtt) initMqtt();
}

function updateUI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updatePlayerList(players) {
  const list = document.getElementById('playerList');
  if (list) {
    list.innerHTML = players.map(p => `<div class="player-item">${p.username}</div>`).join('');
  }
}

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }

  // Check if banned
  if (localStorage.getItem('floorVrBanned') === 'true') {
    alert('❌ You have been banned from this game');
    return;
  }

  // Store username for later use
  window.currentUsername = username;
  currentPlayerId = 'local-' + username;

  // For P2P, we don't strictly need server auth, but we can validate
  // For now, just proceed to game
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');

  initializeGame();

  // Init game scene
  setTimeout(() => {
    if (window.initGameScene) window.initGameScene();
  }, 100);
}

function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }

  // Store username for later use
  window.currentUsername = username;

  // For P2P, registration is just creating a local profile
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');

  initializeGame();
}

function broadcastPosition(x, y, z) {
  if (window.broadcastState) {
    window.broadcastState();
  }
}

// Global socket references for compatibility with old code
window.socket = {
  connected: true,
  emit: (event, data) => {
    // Redirect socket.emit calls to PeerJS or local handlers
    handleGameEvent(event, data);
  }
};

function handleGameEvent(event, data) {
  switch (event) {
    case 'join_blackjack':
      console.log('Player joining blackjack');
      break;
    case 'leave_blackjack_table':
      console.log('Player leaving blackjack');
      break;
    case 'blackjack_bet':
      // Simulate blackjack locally or broadcast to room
      simulateBlackjackBet(data);
      break;
    case 'plinko_play':
      simulatePlinkoPlay(data);
      break;
    case 'wheel_spin':
      simulateWheelSpin(data);
      break;
    case 'purchase_cosmetic':
      purchaseCosmetic(data);
      break;
    case 'equip_cosmetic':
      equipCosmeticItem(data);
      break;
    case 'purchase_upgrade':
      purchaseUpgrade(data);
      break;
    case 'get_shop':
      loadShopItems();
      break;
    case 'get_inventory':
      loadInventory();
      break;
    default:
      console.log('Unknown event:', event);
  }
}

// ---- shop catalog (single source of truth) ----
const COSMETICS = [
  { id: 'body-red',    name: 'Red Body',    cosKind: 'body', value: 0xff3333, cost: 500 },
  { id: 'body-blue',   name: 'Blue Body',   cosKind: 'body', value: 0x3366ff, cost: 500 },
  { id: 'body-purple', name: 'Purple Body', cosKind: 'body', value: 0xaa33ff, cost: 750 },
  { id: 'body-gold',   name: 'Gold Body',   cosKind: 'body', value: 0xffcc00, cost: 1500 },
  { id: 'hat-crown',   name: 'Gold Crown',  cosKind: 'hat',  value: 'gold-crown', cost: 2000 },
  { id: 'hat-party',   name: 'Party Hat',   cosKind: 'hat',  value: 'party-hat',  cost: 800 },
  { id: 'hat-top',     name: 'Top Hat',     cosKind: 'hat',  value: 'top-hat',    cost: 1200 },
];
const UPGRADES = [
  { key: 'luck',   name: '🍀 Luck',   baseCost: 800,  desc: '+5% better odds / level' },
  { key: 'payout', name: '💰 Payout', baseCost: 1000, desc: '+10% winnings / level' },
  { key: 'crit',   name: '💥 Crit',   baseCost: 1200, desc: '+4% chance to 3x a win / level' },
];

function upgradeCost(key, currentLevel) {
  const u = UPGRADES.find(x => x.key === key);
  return u ? u.baseCost * (currentLevel + 1) : Infinity;
}

// ---- game simulation (now upgrade-aware) ----

// weighted pick that biases toward higher-index (better) entries as luck rises
function luckyPick(values, luck) {
  const n = values.length;
  let total = 0;
  const weights = values.map((_, i) => {
    const w = 1 + luck * (i / (n - 1)) * 4; // luck boosts upper entries
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < n; i++) { r -= weights[i]; if (r <= 0) return i; }
  return n - 1;
}

function broadcastIfBig(game, payout) {
  if (payout >= 1000 && window.sendGameResult) window.sendGameResult({ game, payout });
}

function simulateBlackjackBet(data) {
  const bet = data.amount;
  const win = Math.random() < Math.min(0.5 + getLuckFactor(), 0.9);
  let net = win ? bet : -bet;
  let crit = false;
  if (net > 0) { const m = applyWinModifiers(net); net = m.payout; crit = m.crit; }
  updateBalance(net);
  recordGameStat('blackjack', win);
  if (win) broadcastIfBig('Blackjack', net);

  if (window.onBlackjackStateUpdate) {
    window.onBlackjackStateUpdate({
      status: 'results',
      maxPlayers: 4,
      dealer: { hand: [], value: 0 },
      players: [{
        id: currentPlayerId,
        result: win ? 'win' : 'loss',
        status: win ? 'win' : 'lost',
        payout: Math.round(net),
        crit,
        hand: [],
        value: 0,
      }]
    });
  }
}

function simulatePlinkoPlay(data) {
  const bet = data.betAmount;
  const multipliers = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
  const idx = luckyPick(multipliers, getLuckFactor());
  const multiplier = multipliers[idx];
  let net = bet * multiplier - bet;
  let crit = false;
  if (net > 0) { const m = applyWinModifiers(net); net = m.payout; crit = m.crit; }
  updateBalance(net);
  recordGameStat('plinko', multiplier > 1);
  if (net > 0) broadcastIfBig('Plinko', net);

  if (window.onPlinkoResult) {
    window.onPlinkoResult({
      success: true, position: idx, multiplier,
      payout: Math.round(bet + net), crit,
      newBalance: window.currentPlayer.balance
    });
  }
}

function simulateWheelSpin(data) {
  const bet = data.baseAmount;
  const multipliers = [-5, -2, -1, 0.5, 1, 1.5, 2, 5, 10, 25, 50];
  const idx = luckyPick(multipliers, getLuckFactor());
  const multiplier = multipliers[idx];
  let payout = bet * multiplier;
  let crit = false;
  if (payout > 0) { const m = applyWinModifiers(payout); payout = m.payout; crit = m.crit; }
  updateBalance(payout);
  recordGameStat('wheel', multiplier > 1);
  if (payout > 0) broadcastIfBig('Wheel', payout);

  if (window.onWheelResult) {
    window.onWheelResult({
      success: true, multiplier, payout: Math.round(payout), crit,
      newBalance: window.currentPlayer.balance
    });
  }
}

// ---- shop purchase / equip / upgrade ----

function purchaseCosmetic(data) {
  const item = COSMETICS.find(c => c.id === data.itemId);
  if (!item) return purchaseFail('Item not found');
  if (ownsCosmetic(item.id)) return purchaseFail('Already owned');
  if (window.currentPlayer.balance < item.cost) return purchaseFail('Not enough P$');

  updateBalance(-item.cost);
  addOwnedCosmetic(item.id);
  equipCosmetic(item.cosKind, item.value); // auto-equip on buy
  purchaseOk(item.name, 'Purchased & equipped');
}

function equipCosmeticItem(data) {
  const item = COSMETICS.find(c => c.id === data.itemId);
  if (!item) return purchaseFail('Item not found');
  if (!ownsCosmetic(item.id)) return purchaseFail("You don't own that");
  equipCosmetic(item.cosKind, item.value);
  purchaseOk(item.name, 'Equipped');
}

function purchaseUpgrade(data) {
  const u = UPGRADES.find(x => x.key === data.key);
  if (!u) return purchaseFail('Unknown upgrade');
  const level = getUpgradeLevel(u.key);
  if (level >= window.MAX_UPGRADE_LEVEL) return purchaseFail('Max level');
  const cost = upgradeCost(u.key, level);
  if (window.currentPlayer.balance < cost) return purchaseFail('Not enough P$');

  updateBalance(-cost);
  setUpgradeLevel(u.key, level + 1);
  purchaseOk(u.name, `Now level ${level + 1}`);
}

function purchaseOk(name, note) {
  if (window.onPurchaseResult) {
    window.onPurchaseResult({ success: true, item: { name }, note, newBalance: window.currentPlayer.balance });
  }
}
function purchaseFail(error) {
  if (window.onPurchaseResult) window.onPurchaseResult({ success: false, error });
}

function loadShopItems() {
  const cosmetics = COSMETICS.map(c => ({
    id: c.id, name: c.name, type: 'cosmetic', cosKind: c.cosKind, cost: c.cost,
    owned: ownsCosmetic(c.id),
    equipped: (c.cosKind === 'body' && window.currentPlayer.cosmetics.bodyColor === c.value)
           || (c.cosKind === 'hat' && window.currentPlayer.cosmetics.hat === c.value),
  }));
  const upgrades = UPGRADES.map(u => {
    const level = getUpgradeLevel(u.key);
    return {
      key: u.key, name: u.name, type: 'upgrade', desc: u.desc,
      level, maxLevel: window.MAX_UPGRADE_LEVEL,
      nextCost: level >= window.MAX_UPGRADE_LEVEL ? null : upgradeCost(u.key, level),
    };
  });
  if (window.onShopItems) window.onShopItems({ cosmetics, upgrades });
}

function loadInventory() {
  if (window.onInventory) window.onInventory(getInventory());
}
