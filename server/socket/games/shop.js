const db = require('../../db/database');

const SHOP_ITEMS = {
  // Cosmetics
  'avatar_red': { name: 'Red Avatar', cost: 500, type: 'cosmetic' },
  'avatar_blue': { name: 'Blue Avatar', cost: 500, type: 'cosmetic' },
  'avatar_green': { name: 'Green Avatar', cost: 500, type: 'cosmetic' },
  'avatar_gold': { name: 'Gold Avatar', cost: 2000, type: 'cosmetic' },
  'hat_top': { name: 'Top Hat', cost: 1000, type: 'cosmetic' },
  'hat_crown': { name: 'Crown', cost: 5000, type: 'cosmetic' },

  // Upgrades
  'upgrade_2x_payout': { name: '2x Payout Multiplier', cost: 10000, type: 'upgrade', effect: 'payout_2x' },
  'upgrade_lucky': { name: 'Lucky Streak (10%)', cost: 5000, type: 'upgrade', effect: 'lucky_streak' }
};

function getShop() {
  return Object.entries(SHOP_ITEMS).map(([id, item]) => ({
    id,
    ...item
  }));
}

function purchaseItem(playerId, itemId) {
  const item = SHOP_ITEMS[itemId];
  if (!item) {
    return { success: false, error: 'Item not found' };
  }

  const balance = db.getBalance(playerId);
  if (balance < item.cost) {
    return { success: false, error: 'Insufficient balance' };
  }

  // Deduct cost
  db.updateBalance(playerId, -item.cost);

  // Add to inventory
  db.addInventoryItem(playerId, itemId);

  return {
    success: true,
    item: { id: itemId, ...item },
    newBalance: db.getBalance(playerId)
  };
}

module.exports = {
  getShop,
  purchaseItem,
  SHOP_ITEMS
};
