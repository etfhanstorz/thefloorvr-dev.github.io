const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev-secret-key';

router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: 'Username and password required' });
  }

  if (db.getPlayerByUsername(username)) {
    return res.json({ error: 'Username already taken' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const player = db.createPlayer(username, hash);

  const token = jwt.sign({ playerId: player.id, username }, SECRET, { expiresIn: '7d' });
  res.json({ token, playerId: player.id });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: 'Username and password required' });
  }

  const player = db.getPlayerByUsername(username);
  if (!player || !bcrypt.compareSync(password, player.password_hash)) {
    return res.json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ playerId: player.id, username }, SECRET, { expiresIn: '7d' });
  res.json({ token, playerId: player.id });
});

module.exports = router;
