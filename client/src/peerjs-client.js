// ============================================================================
// The Floor VR — P2P multiplayer over PeerJS (no backend server)
//
// How discovery works (cross-device, no localStorage):
//   - Each room "aN" has ONE host whose PeerJS id is literally PREFIX + "aN".
//   - To join, a client first TRIES to register that id itself.
//       * success  -> the room was empty, so it becomes the host.
//       * "unavailable-id" error -> a host already exists, so it connects in
//         as a normal client instead.
//   - If a room is full (5 players) the host replies "full" and the client
//     moves on to a(N+1).
//   - Topology is a star: clients talk to the host, the host relays to all.
//   - Host migration: if the host drops, the lowest-id survivor claims the
//     room id and everyone else reconnects to it.
// ============================================================================

const PREFIX = 'thefloorvr-v1-';
const MAX_PLAYERS = 5;
const MAX_ROOMS = 50;

const PEER_OPTS = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};

const MP = {
  peer: null,          // active Peer object (host id OR random client id)
  myId: null,          // my network id (peer id)
  myName: 'Player',
  roomIndex: 0,        // which "aN" we are in (1-based)
  isHost: false,
  hostConn: null,      // client -> host DataConnection
  clients: new Map(),  // host: peerId -> DataConnection
  roster: [],          // [{id, name}] for the whole room
  lastSeen: {},        // peerId -> timestamp, for stale cleanup
};

// ---- small promise helpers ------------------------------------------------

function makePeer(id) {
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, PEER_OPTS) : new Peer(PEER_OPTS);
    let done = false;
    p.on('open', () => { if (!done) { done = true; resolve(p); } });
    p.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

function connectTo(peer, targetId, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(targetId, { reliable: true });
    let done = false;
    conn.on('open', () => { if (!done) { done = true; resolve(conn); } });
    conn.on('error', (e) => { if (!done) { done = true; reject(e); } });
    setTimeout(() => { if (!done) { done = true; reject(new Error('connect-timeout')); } }, timeoutMs);
  });
}

// Wait for a single "welcome" or "full" reply to our join request.
function awaitJoinReply(conn, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const handler = (msg) => {
      if (done) return;
      if (msg && (msg.t === 'welcome' || msg.t === 'full')) {
        done = true;
        conn.off('data', handler);
        resolve(msg);
      }
    };
    conn.on('data', handler);
    setTimeout(() => { if (!done) { done = true; conn.off('data', handler); reject(new Error('join-timeout')); } }, timeoutMs);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- public entry point ---------------------------------------------------

async function initPeer() {
  MP.myName = (typeof window.currentUsername === 'string' && window.currentUsername) || 'Player';
  await joinAnyRoom(1);
  setStatus();
  return MP.myId;
}

// Try rooms a1, a2, ... until we host or join one.
async function joinAnyRoom(startIndex) {
  for (let i = startIndex; i <= MAX_ROOMS; i++) {
    const roomId = PREFIX + 'a' + i;

    // 1) Try to BECOME the host of this room.
    try {
      const hostPeer = await makePeer(roomId);
      becomeHost(hostPeer, i);
      return;
    } catch (e) {
      if (!e || e.type !== 'unavailable-id') {
        // network/broker hiccup — wait and retry the same room once
        console.warn(`Host attempt for a${i} failed (${e && e.type}); retrying`, e);
        await sleep(500);
        try {
          const hostPeer = await makePeer(roomId);
          becomeHost(hostPeer, i);
          return;
        } catch (e2) {
          if (!e2 || e2.type !== 'unavailable-id') { continue; }
        }
      }
      // else: id taken -> a host exists, fall through to join as client
    }

    // 2) A host exists — connect as a client.
    try {
      const clientPeer = await makePeer(null);
      const conn = await connectTo(clientPeer, roomId);
      conn.send({ t: 'join', id: clientPeer.id, name: MP.myName });
      const reply = await awaitJoinReply(conn);
      if (reply.t === 'welcome') {
        becomeClient(clientPeer, conn, i, reply.roster || []);
        return;
      }
      // room full -> tidy up and try the next room
      conn.close();
      clientPeer.destroy();
    } catch (e) {
      console.warn(`Join attempt for a${i} failed`, e);
      // try the next room
    }
  }
  console.error('Could not find or create a room.');
}

// ---- becoming host --------------------------------------------------------

function becomeHost(peer, roomIndex) {
  MP.peer = peer;
  MP.myId = peer.id;
  MP.isHost = true;
  MP.hostConn = null;
  MP.roomIndex = roomIndex;
  MP.clients = new Map();
  MP.roster = [{ id: MP.myId, name: MP.myName }];

  console.log(`🏠 Hosting room a${roomIndex} (${MP.myId})`);

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      conn.on('data', (msg) => handleHostMessage(conn, msg));
    });
    conn.on('close', () => dropClient(conn));
    conn.on('error', () => dropClient(conn));
  });

  peer.on('disconnect', () => { try { peer.reconnect(); } catch (e) {} });

  startHostHeartbeat();
  applyRosterToUI();
}

function handleHostMessage(conn, msg) {
  if (!msg || !msg.t) return;

  if (msg.t === 'join') {
    // Reject if the room is already full.
    if (MP.roster.length >= MAX_PLAYERS) {
      try { conn.send({ t: 'full' }); } catch (e) {}
      return;
    }
    conn._peerId = msg.id;
    conn._name = msg.name || 'Player';
    MP.clients.set(msg.id, conn);
    MP.roster.push({ id: msg.id, name: conn._name });
    MP.lastSeen[msg.id] = Date.now();

    conn.send({ t: 'welcome', roster: MP.roster });
    broadcastRoster();
    applyRosterToUI();
    return;
  }

  if (msg.t === 'state') {
    MP.lastSeen[msg.id] = Date.now();
    applyRemoteState(msg);
    relay(msg, conn); // relay to every OTHER client
    return;
  }

  if (msg.t === 'gamewin') {
    if (window.showToast) window.showToast(`🎉 ${msg.name || 'Player'} won P$ ${msg.payout} on ${msg.game}`, '#5dff8f');
    relay(msg, conn);
    return;
  }

  if (msg.t === 'poker') {
    if (window.onPokerHostMsg) window.onPokerHostMsg(conn._peerId, msg);
    return;
  }

  if (msg.t === 'leave') {
    dropClient(conn);
    return;
  }
}

function dropClient(conn) {
  const id = conn && conn._peerId;
  if (!id) return;
  MP.clients.delete(id);
  MP.roster = MP.roster.filter(p => p.id !== id);
  delete MP.lastSeen[id];
  if (window.removeRemoteAvatar) window.removeRemoteAvatar(id);
  broadcastRoster();
  applyRosterToUI();
  console.log(`👋 ${id} left room a${MP.roomIndex}`);
}

function relay(msg, exceptConn) {
  for (const conn of MP.clients.values()) {
    if (conn !== exceptConn && conn.open) {
      try { conn.send(msg); } catch (e) {}
    }
  }
}

function broadcastRoster() {
  const msg = { t: 'roster', roster: MP.roster };
  for (const conn of MP.clients.values()) {
    if (conn.open) { try { conn.send(msg); } catch (e) {} }
  }
}

let hostHeartbeat = null;
function startHostHeartbeat() {
  clearInterval(hostHeartbeat);
  hostHeartbeat = setInterval(() => {
    const now = Date.now();
    for (const id of Object.keys(MP.lastSeen)) {
      if (now - MP.lastSeen[id] > 10000) {
        const conn = MP.clients.get(id);
        if (conn) dropClient(conn);
      }
    }
    broadcastRoster();
  }, 3000);
}

// ---- becoming client ------------------------------------------------------

function becomeClient(peer, hostConn, roomIndex, roster) {
  MP.peer = peer;
  MP.myId = peer.id;
  MP.isHost = false;
  MP.hostConn = hostConn;
  MP.roomIndex = roomIndex;
  MP.clients = new Map();
  MP.roster = roster.length ? roster : [{ id: MP.myId, name: MP.myName }];

  console.log(`🙋 Joined room a${roomIndex} as client (${MP.myId})`);

  hostConn.on('data', (msg) => handleClientMessage(msg));
  hostConn.on('close', () => onHostLost());
  hostConn.on('error', () => onHostLost());
  peer.on('disconnect', () => { try { peer.reconnect(); } catch (e) {} });

  applyRosterToUI();
}

function handleClientMessage(msg) {
  if (!msg || !msg.t) return;

  if (msg.t === 'roster') {
    MP.roster = msg.roster || MP.roster;
    applyRosterToUI();
    return;
  }
  if (msg.t === 'state') {
    applyRemoteState(msg);
    return;
  }
  if (msg.t === 'gamewin') {
    if (window.showToast) window.showToast(`🎉 ${msg.name || 'Player'} won P$ ${msg.payout} on ${msg.game}`, '#5dff8f');
    return;
  }
  if (msg.t === 'poker') {
    if (window.onPokerClientMsg) window.onPokerClientMsg(msg);
    return;
  }
}

// ---- poker transport helpers (used by games/poker.js) ----
window.pokerIsHost = () => MP.isHost;
window.pokerMyId = () => MP.myId;
window.pokerMyName = () => MP.myName;
window.pokerRoster = () => MP.roster.slice();
// host -> all clients
window.pokerBroadcast = (msg) => { if (MP.isHost) relay(msg, null); };
// client -> host (host calls its own handler directly)
window.pokerToHost = (msg) => {
  if (MP.isHost) { if (window.onPokerHostMsg) window.onPokerHostMsg(MP.myId, msg); }
  else if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send(msg); } catch (e) {} }
};
// host -> one specific peer (or itself)
window.pokerToPeer = (peerId, msg) => {
  if (peerId === MP.myId) { if (window.onPokerClientMsg) window.onPokerClientMsg(msg); return; }
  const c = MP.clients.get(peerId);
  if (c && c.open) { try { c.send(msg); } catch (e) {} }
};

let migrating = false;
async function onHostLost() {
  if (migrating) return;
  migrating = true;
  console.warn('Host lost — starting migration');

  const oldHostId = PREFIX + 'a' + MP.roomIndex;
  if (window.removeRemoteAvatar) window.removeRemoteAvatar(oldHostId);

  // rank survivors by peer id; lowest goes first so we don't all collide
  const survivors = MP.roster.map(p => p.id).filter(id => id !== oldHostId).sort();
  const rank = Math.max(0, survivors.indexOf(MP.myId));

  try { if (MP.peer) MP.peer.destroy(); } catch (e) {}
  MP.peer = null; MP.hostConn = null;

  await sleep(rank * 500 + 200);

  migrating = false;
  await joinAnyRoom(MP.roomIndex); // take over THIS room, or join its new host
  setStatus();
}

// ---- sending our state ----------------------------------------------------

function broadcastState() {
  if (!MP.peer || !MP.myId) return;

  const pos = getLocalPosition();
  if (!pos) return;

  const cos = (window.getLocalCosmetics ? window.getLocalCosmetics() : null);
  const msg = { t: 'state', id: MP.myId, name: MP.myName, pos, cos };

  if (MP.isHost) {
    relay(msg, null);
  } else if (MP.hostConn && MP.hostConn.open) {
    try { MP.hostConn.send(msg); } catch (e) {}
  }
}

function getLocalPosition() {
  if (typeof localAvatar !== 'undefined' && localAvatar && localAvatar.position) {
    return { x: localAvatar.position.x, y: localAvatar.position.y, z: localAvatar.position.z };
  }
  return null;
}

function sendGameResult(result) {
  const msg = {
    t: 'gamewin', id: MP.myId, name: MP.myName,
    game: result.game, payout: result.payout, ts: Date.now(),
  };
  if (MP.isHost) relay(msg, null);
  else if (MP.hostConn && MP.hostConn.open) { try { MP.hostConn.send(msg); } catch (e) {} }
  if (window.savePlayerData) savePlayerData();
}

// ---- applying remote state to the 3D scene --------------------------------

function applyRemoteState(msg) {
  if (!msg || msg.id === MP.myId) return;
  if (typeof scene === 'undefined' || !scene) return; // scene not built yet

  let avatar = getAvatar(msg.id);
  if (!avatar) {
    avatar = createAvatar(msg.id, msg.name || 'Player', false);
    scene.add(avatar.getGroup());
  }
  if (msg.pos) avatar.setPosition(msg.pos.x, msg.pos.y, msg.pos.z);
  if (msg.cos && avatar.applyCosmetics) avatar.applyCosmetics(msg.cos);
}

window.removeRemoteAvatar = function (id) {
  if (typeof removeAvatar === 'function' && getAvatar(id)) removeAvatar(id);
};

// ---- UI glue --------------------------------------------------------------

function setStatus() {
  if (window.updateUI) {
    updateUI('status', MP.isHost ? 'Hosting' : 'Connected');
    updateUI('roomId', 'a' + MP.roomIndex + (MP.isHost ? ' (host)' : ''));
    updateUI('playerId', MP.myId ? MP.myId.slice(0, 10) : '-');
  }
}

function applyRosterToUI() {
  setStatus();
  if (window.updatePlayerList) {
    updatePlayerList(MP.roster.map(p => ({ username: p.name })));
  }
}

// ---- exports --------------------------------------------------------------

window.initPeer = initPeer;
window.broadcastState = broadcastState;
window.sendGameResult = sendGameResult;
window.getCurrentRoom = () => 'a' + MP.roomIndex;
window.isRoomHost = () => MP.isHost;
window.MP = MP;
