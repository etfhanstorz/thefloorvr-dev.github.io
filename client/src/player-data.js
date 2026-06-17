// Player data persistence using localStorage
// Auto-saves every action or every 60 seconds

const SAVE_INTERVAL = 60000; // 60 seconds
let saveTimeout = null;

window.currentPlayer = {
  username: '',
  balance: 1000,
  inventory: [],
  stats: {
    gamesPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
  },
};

function loadPlayerData() {
  const username = document.getElementById('username')?.value;
  if (!username) return;

  const key = `player-${username}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      window.currentPlayer = JSON.parse(stored);
      console.log(`✓ Loaded player data for ${username}`);
    } catch (e) {
      console.error('Failed to load player data:', e);
      window.currentPlayer.username = username;
      window.currentPlayer.balance = 1000;
    }
  } else {
    window.currentPlayer.username = username;
    window.currentPlayer.balance = 1000;
    window.currentPlayer.inventory = [];
    savePlayerData();
  }
}

function savePlayerData() {
  const username = window.currentPlayer.username;
  if (!username) return;

  const key = `player-${username}`;
  localStorage.setItem(key, JSON.stringify(window.currentPlayer));

  // Schedule next auto-save
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(savePlayerData, SAVE_INTERVAL);
}

function updateBalance(amount) {
  window.currentPlayer.balance += amount;
  savePlayerData();
  return window.currentPlayer.balance;
}

function addInventoryItem(itemId, itemName) {
  if (!window.currentPlayer.inventory) {
    window.currentPlayer.inventory = [];
  }
  window.currentPlayer.inventory.push({
    id: itemId,
    name: itemName,
    acquiredAt: Date.now(),
  });
  savePlayerData();
}

function getInventory() {
  return window.currentPlayer.inventory || [];
}

function recordGameStat(game, won) {
  if (!window.currentPlayer.stats) {
    window.currentPlayer.stats = { gamesPlayed: 0, totalWins: 0, totalLosses: 0 };
  }
  window.currentPlayer.stats.gamesPlayed++;
  if (won) {
    window.currentPlayer.stats.totalWins++;
  } else {
    window.currentPlayer.stats.totalLosses++;
  }
  savePlayerData();
}

// Broadcast state periodically for other players to see
setInterval(() => {
  if (window.broadcastState) {
    window.broadcastState();
  }
}, 100);

window.loadPlayerData = loadPlayerData;
window.savePlayerData = savePlayerData;
window.updateBalance = updateBalance;
window.addInventoryItem = addInventoryItem;
window.getInventory = getInventory;
window.recordGameStat = recordGameStat;
