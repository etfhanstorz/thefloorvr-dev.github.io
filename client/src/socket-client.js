// Client initialization for PeerJS P2P and MQTT admin events

let currentPlayerId = null;

function initializeGame() {
  // Load player data from localStorage
  loadPlayerData();

  // Initialize PeerJS for P2P multiplayer
  initPeer().then(() => {
    console.log('✓ PeerJS initialized');
    updateUI('status', 'Connected');
  });

  // Initialize MQTT for Discord admin events
  initMqtt().then(() => {
    console.log('✓ MQTT initialized');
  });

  // Initialize game UI
  initBlackjackUI();
  initPlinkoUI();
  initWheelUI();
  initShopUI();

  // Start main Three.js loop
  init();
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

  // Store username for later use
  window.currentUsername = username;

  // For P2P, we don't strictly need server auth, but we can validate
  // For now, just proceed to game
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');

  initializeGame();
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
    case 'purchase_item':
      simulatePurchaseItem(data);
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

// Game simulation functions (client-side logic)
function simulateBlackjackBet(data) {
  const result = {
    success: true,
    multiplier: Math.random() > 0.5 ? 2 : 0.5,
    payout: data.amount * (Math.random() > 0.5 ? 2 : 0.5),
    newBalance: window.currentPlayer.balance + (Math.random() > 0.5 ? data.amount : -data.amount)
  };

  updateBalance(result.payout - data.amount);
  recordGameStat('blackjack', result.payout > 0);

  if (window.onBlackjackStateUpdate) {
    window.onBlackjackStateUpdate({
      status: 'results',
      players: [{
        id: currentPlayerId,
        result: result.payout > 0 ? 'win' : 'loss',
        payout: result.payout
      }]
    });
  }
}

function simulatePlinkoPlay(data) {
  const multipliers = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
  const multiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
  const payout = data.betAmount * multiplier;

  updateBalance(payout - data.betAmount);
  recordGameStat('plinko', multiplier > 1);

  if (window.onPlinkoResult) {
    window.onPlinkoResult({
      success: true,
      position: Math.floor(Math.random() * 9),
      multiplier,
      payout,
      newBalance: window.currentPlayer.balance
    });
  }
}

function simulateWheelSpin(data) {
  const multipliers = [-5, -2, -1, 0.5, 1, 1.5, 2, 5, 10, 25, 50];
  const multiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
  const payout = data.baseAmount * multiplier;

  updateBalance(payout);
  recordGameStat('wheel', multiplier > 1);

  if (window.onWheelResult) {
    window.onWheelResult({
      success: true,
      multiplier,
      payout,
      newBalance: window.currentPlayer.balance
    });
  }
}

function simulatePurchaseItem(data) {
  const items = [
    { id: 'red-avatar', name: 'Red Avatar', cost: 500 },
    { id: 'blue-avatar', name: 'Blue Avatar', cost: 500 },
    { id: 'gold-hat', name: 'Gold Hat', cost: 1000 },
  ];

  const item = items.find(i => i.id === data.itemId);
  if (!item) {
    if (window.onPurchaseResult) {
      window.onPurchaseResult({ success: false, error: 'Item not found' });
    }
    return;
  }

  if (window.currentPlayer.balance < item.cost) {
    if (window.onPurchaseResult) {
      window.onPurchaseResult({ success: false, error: 'Not enough balance' });
    }
    return;
  }

  updateBalance(-item.cost);
  addInventoryItem(item.id, item.name);

  if (window.onPurchaseResult) {
    window.onPurchaseResult({
      success: true,
      item,
      newBalance: window.currentPlayer.balance
    });
  }
}

function loadShopItems() {
  const items = [
    { id: 'red-avatar', name: 'Red Avatar', type: 'cosmetic', cost: 500 },
    { id: 'blue-avatar', name: 'Blue Avatar', type: 'cosmetic', cost: 500 },
    { id: 'gold-hat', name: 'Gold Hat', type: 'cosmetic', cost: 1000 },
    { id: '2x-payout', name: '2x Payout Boost', type: 'upgrade', cost: 2000 },
  ];

  if (window.onShopItems) {
    window.onShopItems(items);
  }
}

function loadInventory() {
  if (window.onInventory) {
    window.onInventory(getInventory());
  }
}
