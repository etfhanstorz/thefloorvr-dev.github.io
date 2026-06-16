const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

const authRoutes = require('./routes/auth');
const { handleSocketConnection } = require('./socket/rooms');
const db = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST']
  }
});

const SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);

// Serve client
app.use(express.static(path.join(__dirname, '../client')));

// Socket.io middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Token required'));
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    socket.playerId = decoded.playerId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Socket connections
io.on('connection', handleSocketConnection(io));

// Start server
db.initDb();
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
