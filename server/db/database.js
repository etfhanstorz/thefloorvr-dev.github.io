// In-memory database for testing
const players = {};
let nextPlayerId = 1;

function initDb() {
  console.log('Database initialized (in-memory)');
}

function getPlayerByUsername(username) {
  return Object.values(players).find(p => p.username === username);
}

function createPlayer(username, password) {
  const id = nextPlayerId++;
  const player = {
    id,
    username,
    password: password,
    balance: 1000,
    banned: 0,
    muted: 0,
    created_at: new Date().toISOString(),
    inventory: []
  };
  players[id] = player;
  return { id, username, balance: 1000 };
}

function getPlayerById(id) {
  return players[id];
}

function getAllPlayers() {
  return players;
}

function updateBalance(playerId, amount) {
  if (players[playerId]) {
    players[playerId].balance += amount;
  }
}

function getBalance(playerId) {
  return players[playerId] ? players[playerId].balance : 0;
}

function banPlayer(playerId) {
  if (players[playerId]) {
    players[playerId].banned = 1;
  }
}

function mutePlayer(playerId) {
  if (players[playerId]) {
    players[playerId].muted = 1;
  }
}

function unmutePlayer(playerId) {
  if (players[playerId]) {
    players[playerId].muted = 0;
  }
}

function isDevTestUser(username) {
  return username.endsWith('.devtest');
}

function resetPassword(playerId, newPassword) {
  if (players[playerId]) {
    players[playerId].password = newPassword;
  }
}

module.exports = {
  initDb,
  getPlayerByUsername,
  createPlayer,
  getPlayerById,
  getAllPlayers,
  updateBalance,
  getBalance,
  banPlayer,
  mutePlayer,
  unmutePlayer,
  isDevTestUser,
  resetPassword
};
