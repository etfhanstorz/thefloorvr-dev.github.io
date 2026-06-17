// Player data persistence (localStorage) + cosmetics/upgrades model.
// Auto-saves on every change and every 60s.

const SAVE_INTERVAL = 60000;
let saveTimeout = null;

function defaultPlayer() {
  return {
    username: '',
    balance: 1000,
    c_balance: 0,
    time_played: 0,   // seconds
    is_admin: false,
    inventory: [],
    // cosmetics: which body colour / hat is equipped, and what's owned
    cosmetics: { bodyColor: null, hat: null, owned: [] },
    // upgrade levels (0..MAX_UPGRADE_LEVEL)
    upgrades: { luck: 0, payout: 0, crit: 0 },
    stats: { gamesPlayed: 0, totalWins: 0, totalLosses: 0 },
  };
}

window.currentPlayer = defaultPlayer();
const MAX_UPGRADE_LEVEL = 5;

function loadPlayerData() {
  // Cloud session already loaded the player from Supabase — don't overwrite it.
  if (window.sbActive) return;

  const username = document.getElementById('username')?.value;
  if (!username) return;

  const key = `player-${username}`;
  const stored = localStorage.getItem(key);

  if (stored) {
    try {
      const data = JSON.parse(stored);
      // merge onto defaults so old saves gain new fields
      window.currentPlayer = Object.assign(defaultPlayer(), data);
      window.currentPlayer.cosmetics = Object.assign({ bodyColor: null, hat: null, owned: [] }, data.cosmetics || {});
      window.currentPlayer.upgrades = Object.assign({ luck: 0, payout: 0, crit: 0 }, data.upgrades || {});
      window.currentPlayer.username = username;
      console.log(`✓ Loaded player data for ${username}`);
    } catch (e) {
      console.error('Failed to load player data:', e);
      window.currentPlayer = defaultPlayer();
      window.currentPlayer.username = username;
    }
  } else {
    window.currentPlayer = defaultPlayer();
    window.currentPlayer.username = username;
    savePlayerData();
  }
}

function savePlayerData() {
  const username = window.currentPlayer.username;
  if (!username) return;
  // local cache (offline / fallback)
  localStorage.setItem(`player-${username}`, JSON.stringify(window.currentPlayer));
  // cloud save when signed in via Supabase
  if (window.sbSavePlayer) window.sbSavePlayer();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(savePlayerData, SAVE_INTERVAL);
}

function updateBalance(amount) {
  window.currentPlayer.balance += amount;
  if (window.currentPlayer.balance < 0) window.currentPlayer.balance = 0;
  savePlayerData();
  return window.currentPlayer.balance;
}

function addInventoryItem(itemId, itemName) {
  if (!window.currentPlayer.inventory) window.currentPlayer.inventory = [];
  window.currentPlayer.inventory.push({ id: itemId, name: itemName, acquiredAt: Date.now() });
  savePlayerData();
}

function getInventory() {
  return window.currentPlayer.inventory || [];
}

// Admin reset: wipe this account back to a fresh state, with a goodwill bonus.
function wipeLocalAccount(bonus) {
  const name = window.currentPlayer.username;
  if (name) localStorage.removeItem('player-' + name);
  window.currentPlayer = defaultPlayer();
  window.currentPlayer.username = name;
  window.currentPlayer.balance = 1000 + (bonus || 0);
  savePlayerData();
  if (window.applyCosmeticsToLocalAvatar) window.applyCosmeticsToLocalAvatar();
}

function recordGameStat(game, won) {
  const s = window.currentPlayer.stats || (window.currentPlayer.stats = { gamesPlayed: 0, totalWins: 0, totalLosses: 0 });
  s.gamesPlayed++;
  if (won) s.totalWins++; else s.totalLosses++;
  savePlayerData();
}

// ---- cosmetics ----

function ownsCosmetic(id) {
  return (window.currentPlayer.cosmetics.owned || []).includes(id);
}

function addOwnedCosmetic(id) {
  const c = window.currentPlayer.cosmetics;
  if (!c.owned) c.owned = [];
  if (!c.owned.includes(id)) c.owned.push(id);
  savePlayerData();
}

function equipCosmetic(kind, value) {
  // kind: 'body' | 'hat'
  if (kind === 'body') window.currentPlayer.cosmetics.bodyColor = value;
  else if (kind === 'hat') window.currentPlayer.cosmetics.hat = value;
  applyCosmeticsToLocalAvatar();
  savePlayerData();
}

function applyCosmeticsToLocalAvatar() {
  if (typeof localAvatar !== 'undefined' && localAvatar && localAvatar.applyCosmetics) {
    localAvatar.applyCosmetics(window.currentPlayer.cosmetics);
  }
}

function getLocalCosmetics() {
  return window.currentPlayer.cosmetics;
}

// ---- upgrades & derived effects ----

function getUpgradeLevel(key) {
  return (window.currentPlayer.upgrades && window.currentPlayer.upgrades[key]) || 0;
}

function setUpgradeLevel(key, level) {
  window.currentPlayer.upgrades[key] = Math.min(level, MAX_UPGRADE_LEVEL);
  savePlayerData();
}

// luck: nudges odds upward (+5% weight toward better outcomes per level)
function getLuckFactor() { return getUpgradeLevel('luck') * 0.05; }
// payout: +10% winnings per level
function getPayoutMul() { return 1 + getUpgradeLevel('payout') * 0.10; }
// crit: chance to triple a win, +4% per level
function getCritChance() { return getUpgradeLevel('crit') * 0.04; }

// Apply payout boost + crit roll to a positive winning amount.
function applyWinModifiers(net) {
  let payout = net * getPayoutMul();
  let crit = false;
  if (Math.random() < getCritChance()) { payout *= 3; crit = true; }
  return { payout: Math.round(payout), crit };
}

// Track play time (seconds) while logged in.
setInterval(() => {
  if (window.currentPlayer && window.currentPlayer.username) {
    window.currentPlayer.time_played = (window.currentPlayer.time_played || 0) + 1;
  }
}, 1000);

// Periodic state broadcast for remote avatars.
setInterval(() => { if (window.broadcastState) window.broadcastState(); }, 100);

// exports
window.loadPlayerData = loadPlayerData;
window.savePlayerData = savePlayerData;
window.updateBalance = updateBalance;
window.addInventoryItem = addInventoryItem;
window.getInventory = getInventory;
window.recordGameStat = recordGameStat;
window.wipeLocalAccount = wipeLocalAccount;
window.ownsCosmetic = ownsCosmetic;
window.addOwnedCosmetic = addOwnedCosmetic;
window.equipCosmetic = equipCosmetic;
window.applyCosmeticsToLocalAvatar = applyCosmeticsToLocalAvatar;
window.getLocalCosmetics = getLocalCosmetics;
window.getUpgradeLevel = getUpgradeLevel;
window.setUpgradeLevel = setUpgradeLevel;
window.getLuckFactor = getLuckFactor;
window.getPayoutMul = getPayoutMul;
window.getCritChance = getCritChance;
window.applyWinModifiers = applyWinModifiers;
window.MAX_UPGRADE_LEVEL = MAX_UPGRADE_LEVEL;
