const BlackjackTable = require('./blackjack');
const db = require('../../db/database');

const tables = {};
let tableIdCounter = 1;

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
  };
}

module.exports = { handleGameSockets };
