const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Middleware: Check for admin secret
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/players - List all players
router.get('/players', (req, res) => {
  const players = Object.values(db.getAllPlayers());
  res.json(players.map(p => ({
    id: p.id,
    username: p.username,
    password_hash: p.password_hash,
    balance: p.balance,
    banned: p.banned,
    createdAt: p.created_at
  })));
});

// POST /admin/shutdown - Kick all players in a room
router.post('/admin/shutdown', adminAuth, (req, res) => {
  const { roomId } = req.body;
  // This would be handled by Socket.io to broadcast disconnect
  // For now, just acknowledge
  res.json({ success: true, message: `Shutdown command sent to room ${roomId}` });
});

// POST /admin/devmode - Give player 1e50 P$
router.post('/admin/devmode', adminAuth, (req, res) => {
  const { playerId } = req.body;
  db.updateBalance(playerId, 1e50);
  res.json({ success: true, message: `Dev mode: gave player ${playerId} 1e50 P$` });
});

// POST /admin/editplayer - Ban/mute/balance a player
router.post('/admin/editplayer', adminAuth, (req, res) => {
  const { playerId, action, value } = req.body;

  if (action === 'ban') {
    db.banPlayer(playerId);
    res.json({ success: true, message: `Player ${playerId} banned` });
  } else if (action === 'mute') {
    db.mutePlayer(playerId);
    res.json({ success: true, message: `Player ${playerId} voice muted` });
  } else if (action === 'balance') {
    const amount = parseInt(value);
    db.updateBalance(playerId, amount);
    res.json({ success: true, message: `Player ${playerId} balance adjusted by ${amount}` });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

module.exports = router;
