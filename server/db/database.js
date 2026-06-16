// In-memory database for testing
const players = {};
let nextPlayerId = 1;

function initDb() {
  // No-op for in-memory DB
  console.log('Database initialized (in-memory)');
}

function getPlayerByUsername(username) {
  return Object.values(players).find(p => p.username === username);
}

function createPlayer(username, passwordHash) {
  const id = nextPlayerId++;
  const player = { id, username, password_hash: passwordHash, balance: 1000 };
  players[id] = player;
  return { id, username, balance: 1000 };
}

function getPlayerById(id) {
  return players[id];
}

function updateBalance(playerId, amount) {
  if (players[playerId]) {
    players[playerId].balance += amount;
  }
}

function getBalance(playerId) {
  return players[playerId] ? players[playerId].balance : 0;
}

module.exports = {
  initDb,
  getPlayerByUsername,
  createPlayer,
  getPlayerById,
  updateBalance,
  getBalance
};
