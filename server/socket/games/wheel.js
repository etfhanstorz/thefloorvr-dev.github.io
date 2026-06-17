const db = require('../../db/database');

class WheelGame {
  constructor() {
    this.segments = [
      { multiplier: -5, weight: 1 },
      { multiplier: -2, weight: 2 },
      { multiplier: -1, weight: 3 },
      { multiplier: 0.5, weight: 5 },
      { multiplier: 1, weight: 15 },
      { multiplier: 2, weight: 10 },
      { multiplier: 3, weight: 5 },
      { multiplier: 5, weight: 3 },
      { multiplier: 10, weight: 2 },
      { multiplier: 20, weight: 1 },
      { multiplier: 50, weight: 1 }
    ];

    this.totalWeight = this.segments.reduce((sum, s) => sum + s.weight, 0);
  }

  spin(playerId, baseAmount = 100) {
    const balance = db.getBalance(playerId);
    if (balance < baseAmount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Deduct spin cost
    db.updateBalance(playerId, -baseAmount);

    // Pick segment by weighted random
    let random = Math.random() * this.totalWeight;
    let selectedSegment = this.segments[0];

    for (const segment of this.segments) {
      random -= segment.weight;
      if (random <= 0) {
        selectedSegment = segment;
        break;
      }
    }

    // Calculate payout
    const payout = Math.floor(baseAmount * selectedSegment.multiplier);
    db.updateBalance(playerId, payout);

    return {
      success: true,
      multiplier: selectedSegment.multiplier,
      baseAmount,
      payout,
      newBalance: db.getBalance(playerId)
    };
  }
}

module.exports = WheelGame;
