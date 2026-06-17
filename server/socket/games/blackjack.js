const db = require('../../db/database');

class BlackjackTable {
  constructor(tableId, maxPlayers = 4) {
    this.tableId = tableId;
    this.maxPlayers = maxPlayers;
    this.players = {};
    this.dealer = { hand: [], value: 0 };
    this.status = 'waiting'; // waiting, betting, playing, results
    this.currentBet = 0;
  }

  addPlayer(playerId, username) {
    if (Object.keys(this.players).length >= this.maxPlayers) {
      return false;
    }
    this.players[playerId] = {
      id: playerId,
      username,
      hand: [],
      value: 0,
      bet: 0,
      status: 'waiting'
    };
    return true;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
  }

  placeBet(playerId, amount) {
    if (!this.players[playerId]) return false;
    const balance = db.getBalance(playerId);
    if (balance < amount) return false;

    this.players[playerId].bet = amount;
    return true;
  }

  dealCards() {
    // Reset hands
    this.dealer.hand = [this.drawCard(), this.drawCard()];
    this.dealer.value = this.calculateHand(this.dealer.hand);

    Object.values(this.players).forEach(p => {
      p.hand = [this.drawCard(), this.drawCard()];
      p.value = this.calculateHand(p.hand);
      p.status = 'playing';
    });

    this.status = 'playing';
  }

  hit(playerId) {
    if (!this.players[playerId]) return false;
    const player = this.players[playerId];
    player.hand.push(this.drawCard());
    player.value = this.calculateHand(player.hand);

    if (player.value > 21) {
      player.status = 'bust';
    }
    return true;
  }

  stand(playerId) {
    if (!this.players[playerId]) return false;
    this.players[playerId].status = 'stand';

    // Check if all players have stood
    const allStood = Object.values(this.players).every(p => p.status === 'stand' || p.status === 'bust');
    if (allStood) {
      this.dealerPlay();
    }
    return true;
  }

  dealerPlay() {
    while (this.dealer.value < 17) {
      this.dealer.hand.push(this.drawCard());
      this.dealer.value = this.calculateHand(this.dealer.hand);
    }
    this.status = 'results';
  }

  getResults() {
    const results = {};
    Object.entries(this.players).forEach(([playerId, player]) => {
      let result = 'loss';
      let payout = 0;

      if (player.status === 'bust') {
        result = 'bust';
        payout = 0;
      } else if (this.dealer.value > 21) {
        result = 'win';
        payout = player.bet * 2;
      } else if (player.value > this.dealer.value) {
        result = 'win';
        payout = player.bet * 2;
      } else if (player.value === this.dealer.value) {
        result = 'push';
        payout = player.bet;
      }

      results[playerId] = { result, payout, hand: player.hand, dealerHand: this.dealer.hand };

      // Apply payout
      if (payout > 0) {
        db.updateBalance(playerId, payout);
      }
    });

    return results;
  }

  drawCard() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return {
      suit: suits[Math.floor(Math.random() * 4)],
      rank: ranks[Math.floor(Math.random() * 13)]
    };
  }

  calculateHand(hand) {
    let value = 0;
    let aces = 0;

    hand.forEach(card => {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['J', 'Q', 'K'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank);
      }
    });

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  getState() {
    return {
      tableId: this.tableId,
      status: this.status,
      players: Object.values(this.players),
      dealer: { hand: this.dealer.hand, value: this.dealer.value }
    };
  }
}

module.exports = BlackjackTable;
