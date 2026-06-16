let socket = null;
let currentPlayerId = null;
let currentRoom = null;

function initSocket(token) {
  // In development, connect to localhost:3001. In production, connect to the same host.
  const serverUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : window.location.origin;

  socket = io(serverUrl, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    updateUI('status', 'Yes');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    updateUI('status', 'No');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on('player_joined', (data) => {
    currentPlayerId = data.playerId;
    currentRoom = data.roomId;
    updateUI('playerId', data.playerId);
    updateUI('roomId', data.roomId);
    console.log('Joined room:', data.roomId, 'as player:', data.playerId);
  });

  socket.on('players_in_room', (players) => {
    console.log('Players in room:', players);
    updatePlayerList(players);
    // Create avatars for all players
    if (window.onPlayersUpdated) {
      window.onPlayersUpdated(players);
    }
  });

  socket.on('player_moved', (data) => {
    if (window.onPlayerMoved) window.onPlayerMoved(data);
  });

  socket.on('player_left', (data) => {
    console.log('Player left:', data.playerId);
    if (window.onPlayerLeft) window.onPlayerLeft(data);
  });
}

function updateUI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updatePlayerList(players) {
  const list = document.getElementById('playerList');
  list.innerHTML = players.map(p => `<div class="player-item">${p.username} (${p.id})</div>`).join('');
}

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : window.location.origin;

  fetch(apiUrl + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(r => r.json())
  .then(data => {
    if (data.token) {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('ui').classList.remove('hidden');
      initSocket(data.token);
    } else {
      alert(data.error || 'Login failed');
    }
  })
  .catch(e => alert('Error: ' + e.message));
}

function register() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const apiUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : window.location.origin;

  fetch(apiUrl + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(r => r.json())
  .then(data => {
    if (data.token) {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('ui').classList.remove('hidden');
      initSocket(data.token);
    } else {
      alert(data.error || 'Register failed');
    }
  })
  .catch(e => alert('Error: ' + e.message));
}

function broadcastPosition(x, y, z) {
  if (socket && socket.connected) {
    socket.emit('player_move', { x, y, z });
  }
}
