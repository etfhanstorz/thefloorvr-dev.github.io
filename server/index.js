const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const { handleSocketConnection } = require('./socket/rooms');
const { handleGameSockets } = require('./socket/games');
const db = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'https://thefloorvr-dev.github.io',
      'https://*.replit.dev'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const PORT = process.env.PORT || 3000;

// Middleware - CORS for GitHub Pages
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/api', adminRoutes);
app.use('/admin', adminRoutes);

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
io.on('connection', (socket) => {
  // Room management
  handleSocketConnection(io)(socket);

  // Game handlers
  handleGameSockets(io)(socket);
});

// Start server
db.initDb();
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
