const BlackjackTable = require('./blackjack');
const PlinkoGame = require('./plinko');
const WheelGame = require('./wheel');
const { getShop, purchaseItem } = require('./shop');
const db = require('../../db/database');

const tables = {};
let tableIdCounter = 1;
const plinkoGame = new PlinkoGame();
const wheelGame = new WheelGame();

function handleGameSockets(io) {
  return (socket) => {
    const playerId = socket.playerId;
    const username = socket.username;
    const isDevTest = db.isDevTestUser(username);

    socket.on('join_blackjack', (data) => {
      if (!isDevTest) {
        socket.emit('error', 'Blackjack only available for .devtest accounts');
        return;
      }

      // Find or create table
      let table = Object.values(tables).find(t => Object.keys(t.players).length < t.maxPlayers && t.status === 'waiting');
      if (!table) {
        const tableId = `table_${tableIdCounter++}`;
        table = new BlackjackTable(tableId);
        tables[tableId] = table;
      }

      table.addPlayer(playerId, username);
      socket.join(`blackjack_${table.tableId}`);

      // Notify all players at this table
      io.to(`blackjack_${table.tableId}`).emit('blackjack_update', table.getState());
    });

    socket.on('blackjack_bet', (data) => {
      const table = Object.values(tables).find(t => t.players[playerId]);
      if (!table) return;

      if (table.placeBet(playerId, data.amount)) {
        // Check if all players have bet
        const allBet = Object.values(table.players).every(p => p.bet > 0);
        if (allBet && Object.keys(table.players).length >= 1) {
          table.dealCards();
        }
        io.to(`blackjack_${table.tableId}`).emit('blackjack_update', table.getState());
      }
    });

    socket.on('blackjack_hit', () => {
      const table = Object.values(tables).find(t => t.players[playerId]);
      if (!table) return;

      table.hit(playerId);
      io.to(`blackjack_${table.tableId}`).emit('blackjack_update', table.getState());
    });

    socket.on('blackjack_stand', () => {
      const table = Object.values(tables).find(t => t.players[playerId]);
      if (!table) return;

      table.stand(playerId);
      io.to(`blackjack_${table.tableId}`).emit('blackjack_update', table.getState());
    });

    socket.on('leave_blackjack_table', () => {
      const table = Object.values(tables).find(t => t.players[playerId]);
      if (table) {
        table.removePlayer(playerId);
        socket.leave(`blackjack_${table.tableId}`);

        if (Object.keys(table.players).length === 0) {
          delete tables[table.tableId];
        } else {
          io.to(`blackjack_${table.tableId}`).emit('blackjack_update', table.getState());
        }
      }
    });

    // Plinko
    socket.on('plinko_play', (data) => {
      const result = plinkoGame.play(playerId, data.betAmount);
      socket.emit('plinko_result', result);
    });

    // Wheel
    socket.on('wheel_spin', (data) => {
      const result = wheelGame.spin(playerId, data.baseAmount || 100);
      socket.emit('wheel_result', result);
    });

    // Shop
    socket.on('get_shop', () => {
      socket.emit('shop_items', getShop());
    });

    socket.on('purchase_item', (data) => {
      const result = purchaseItem(playerId, data.itemId);
      socket.emit('purchase_result', result);
    });

    socket.on('get_inventory', () => {
      const inventory = db.getInventory(playerId);
      socket.emit('inventory', inventory);
    });
  };
}

module.exports = { handleGameSockets };
