const db = require('../../db/database');

class PlinkoGame {
  constructor() {
    this.rows = 8;
    this.buckets = 9;
    this.multipliers = [0.5, 1, 2, 5, 10, 5, 2, 1, 0.5]; // Pyramid distribution
  }

  play(playerId, betAmount) {
    const balance = db.getBalance(playerId);
    if (balance < betAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Deduct bet
    db.updateBalance(playerId, -betAmount);

    // Drop ball through pegs
    let position = 4; // Start in middle (0-8)
    for (let i = 0; i < this.rows; i++) {
      // Random left or right
      position += Math.random() < 0.5 ? -1 : 1;
      // Clamp to bounds
      position = Math.max(0, Math.min(this.buckets - 1, position));
    }

    // Calculate payout
    const multiplier = this.multipliers[position];
    const payout = Math.floor(betAmount * multiplier);

    // Award payout
    db.updateBalance(playerId, payout);

    return {
      success: true,
      position,
      multiplier,
      betAmount,
      payout,
      newBalance: db.getBalance(playerId)
    };
  }
}

module.exports = PlinkoGame;
