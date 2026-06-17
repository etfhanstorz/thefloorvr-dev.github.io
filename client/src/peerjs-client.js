// PeerJS P2P room management
// Auto-joins rooms a1, a2, a3... based on availability
// Max 5 players per room
// Switches hosts when host disconnects

const MAX_PLAYERS_PER_ROOM = 5;
let peer = null;
let myPeerId = null;
let currentRoom = null;
let roomConnections = []; // connections to other players in room
let isHost = false;
let allRoommates = []; // list of peer IDs in current room

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

async function initPeer() {
  return new Promise((resolve) => {
    peer = new Peer(undefined, { config: iceServers });

    peer.on('open', (id) => {
      myPeerId = id;
      console.log(`🆔 My Peer ID: ${myPeerId}`);
      autoJoinRoom();
      resolve(id);
    });

    peer.on('connection', handleIncomingConnection);
    peer.on('error', (err) => console.error('Peer error:', err));
  });
}

async function autoJoinRoom() {
  if (!myPeerId) {
    console.error('Peer not initialized');
    return;
  }

  // Try rooms a1, a2, a3... until finding one with < 5 players
  for (let i = 1; i <= 20; i++) {
    const roomName = 'room-' + String.fromCharCode(97 + (i - 1)) + i; // a1, a2, etc
    console.log(`Trying to join ${roomName}...`);

    if (await tryJoinRoom(roomName)) {
      return;
    }
  }

  console.log('All rooms full, creating new room');
}

async function tryJoinRoom(roomName) {
  // Try to connect to a "host peer" for this room
  // In PeerJS, rooms are managed by peers, not a central server
  // We'll use localStorage to track which peer is hosting which room

  const hostPeerId = localStorage.getItem(`room-host-${roomName}`);

  if (!hostPeerId || hostPeerId === myPeerId) {
    // Room doesn't exist or I'm the host
    if (!hostPeerId) {
      // I'm creating this room
      currentRoom = roomName;
      isHost = true;
      allRoommates = [myPeerId];
      localStorage.setItem(`room-host-${roomName}`, myPeerId);
      localStorage.setItem(`room-count-${roomName}`, '1');
      console.log(`✅ Created and hosting room: ${roomName}`);
      return true;
    }
  } else {
    // Try to connect to the host
    try {
      const conn = peer.connect(hostPeerId, { reliable: true });

      conn.on('open', () => {
        currentRoom = roomName;
        isHost = false;
        console.log(`✅ Joined room: ${roomName} (host: ${hostPeerId.slice(0, 6)}...)`);

        // Tell host about myself
        conn.send({
          type: 'join',
          peerId: myPeerId,
          username: document.getElementById('username')?.value || 'Player',
        });

        roomConnections.push(conn);
        conn.on('data', handleRoomMessage);
        conn.on('close', handleConnectionClosed);
        return true;
      });

      conn.on('error', (err) => {
        console.log(`Could not join ${roomName}: ${err}`);
        return false;
      });

      // Wait for connection
      return new Promise((resolve) => {
        conn.on('open', () => resolve(true));
        setTimeout(() => resolve(false), 3000); // Timeout after 3s
      });
    } catch (err) {
      console.log(`Failed to join ${roomName}: ${err}`);
      return false;
    }
  }
}

function handleIncomingConnection(conn) {
  conn.on('open', () => {
    console.log(`📥 Incoming connection from ${conn.peer.slice(0, 6)}...`);

    if (isHost && currentRoom) {
      conn.on('data', (data) => {
        if (data.type === 'join') {
          console.log(`${data.username} joined the room`);
          allRoommates.push(data.peerId);

          if (allRoommates.length > MAX_PLAYERS_PER_ROOM) {
            conn.send({ type: 'full' });
            conn.close();
            return;
          }

          // Update room count
          localStorage.setItem(`room-count-${currentRoom}`, String(allRoommates.length));

          // Send room roster to new player
          conn.send({
            type: 'roster',
            players: allRoommates.map(id => ({
              peerId: id,
              isHost: id === myPeerId,
            })),
          });

          // Broadcast new player to others
          broadcastToRoom({
            type: 'player-joined',
            peerId: data.peerId,
            username: data.username,
          }, conn);
        } else {
          // Relay messages between players
          broadcastToRoom(data, conn);
        }
      });

      roomConnections.push(conn);
      conn.on('close', handleConnectionClosed);
    }
  });
}

function handleRoomMessage(data) {
  if (data.type === 'roster') {
    allRoommates = data.players.map(p => p.peerId);
    console.log(`📋 Room roster: ${allRoommates.length} players`);
  } else if (data.type === 'player-joined') {
    console.log(`${data.username} joined`);
  } else if (data.type === 'game-result') {
    // Handle game results from other players
    handleGameResult(data);
  } else if (data.type === 'state-sync') {
    // Sync player state
    handleStateSync(data);
  }
}

function broadcastToRoom(message, exceptConn = null) {
  if (isHost) {
    roomConnections.forEach(conn => {
      if (conn !== exceptConn && conn.open) {
        try {
          conn.send(message);
        } catch (e) {
          console.error('Failed to send:', e);
        }
      }
    });
  }
}

function handleConnectionClosed(conn) {
  console.log(`Connection closed: ${conn.peer.slice(0, 6)}...`);
  roomConnections = roomConnections.filter(c => c !== conn);

  if (isHost && currentRoom) {
    allRoommates = allRoommates.filter(id => id !== conn.peer);
    localStorage.setItem(`room-count-${currentRoom}`, String(allRoommates.length));
  }

  // If host disconnects, elect new host
  if (conn.peer === localStorage.getItem(`room-host-${currentRoom}`)) {
    if (isHost) {
      console.log('Host left, I am new host');
    } else {
      console.log('Host left, electing new host...');
      electNewHost();
    }
  }
}

function electNewHost() {
  // Oldest peer (by ID) becomes new host
  if (allRoommates.length === 0) return;
  const newHostId = allRoommates.sort()[0];

  if (newHostId === myPeerId) {
    isHost = true;
    console.log('🔄 I am now the host');
    localStorage.setItem(`room-host-${currentRoom}`, myPeerId);
  }
}

function sendGameResult(result) {
  const msg = {
    type: 'game-result',
    peerId: myPeerId,
    game: result.game,
    amount: result.amount,
    payout: result.payout,
    timestamp: Date.now(),
  };

  if (isHost) {
    broadcastToRoom(msg);
  } else if (roomConnections.length > 0) {
    roomConnections[0].send(msg);
  }

  savePlayerData();
}

function handleGameResult(data) {
  // Host can verify/log game results from other players
  console.log(`${data.peerId.slice(0, 6)}... won ${data.payout} P$ on ${data.game}`);
}

function handleStateSync(data) {
  // Sync player position and state
  if (data.peerId !== myPeerId) {
    const avatar = window.MP?.avatars?.[data.peerId];
    if (avatar) {
      avatar.t.head.p.fromArray(data.head.p);
      avatar.t.head.q.fromArray(data.head.q);
      (data.hands || []).forEach((h, i) => {
        if (avatar.t.hands[i]) {
          avatar.t.hands[i].p.fromArray(h.p);
          avatar.t.hands[i].q.fromArray(h.q);
        }
      });
    }
  }
}

function broadcastState() {
  if (!currentRoom) return;

  const camera = window.camera; // From main.js
  const controllers = window.controllers; // From main.js

  if (!camera) return;

  const hp = new THREE.Vector3(), hq = new THREE.Quaternion(), s = new THREE.Vector3();
  camera.matrixWorld.decompose(hp, hq, s);
  const hands = (controllers || []).map(c => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    c.matrixWorld.decompose(p, q, s);
    return { p: [p.x, p.y, p.z], q: [q.x, q.y, q.z, q.w] };
  });

  const msg = {
    type: 'state-sync',
    peerId: myPeerId,
    username: document.getElementById('username')?.value || 'Player',
    head: { p: [hp.x, hp.y, hp.z], q: [hq.x, hq.y, hq.z, hq.w] },
    hands,
  };

  if (isHost) {
    broadcastToRoom(msg);
  } else if (roomConnections.length > 0) {
    roomConnections[0].send(msg);
  }
}

// Export functions
window.initPeer = initPeer;
window.broadcastState = broadcastState;
window.sendGameResult = sendGameResult;
window.getCurrentRoom = () => currentRoom;
window.isRoomHost = () => isHost;
