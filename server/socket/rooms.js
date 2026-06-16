const rooms = {};

class Room {
  constructor(id) {
    this.id = id;
    this.players = {};
  }

  addPlayer(playerId, username) {
    this.players[playerId] = {
      id: playerId,
      username,
      x: 0,
      y: 0,
      z: 0
    };
  }

  removePlayer(playerId) {
    delete this.players[playerId];
  }

  getPlayers() {
    return Object.values(this.players);
  }

  updatePlayerPosition(playerId, x, y, z) {
    if (this.players[playerId]) {
      this.players[playerId].x = x;
      this.players[playerId].y = y;
      this.players[playerId].z = z;
    }
  }

  isEmpty() {
    return Object.keys(this.players).length === 0;
  }
}

function getOrCreateRoom(playerId) {
  // Find least-full room
  let targetRoom = null;
  for (const roomId in rooms) {
    if (rooms[roomId].getPlayers().length < 20) {
      targetRoom = rooms[roomId];
      break;
    }
  }

  // Create new room if none available
  if (!targetRoom) {
    const newRoomId = 'room_' + Date.now();
    targetRoom = new Room(newRoomId);
    rooms[newRoomId] = targetRoom;
  }

  return targetRoom;
}

function findPlayerRoom(playerId) {
  for (const roomId in rooms) {
    if (rooms[roomId].players[playerId]) {
      return rooms[roomId];
    }
  }
  return null;
}

function handleSocketConnection(io) {
  return (socket) => {
    const playerId = socket.playerId;
    const username = socket.username;
    let currentRoom = null;

    console.log(`Player ${playerId} (${username}) connected`);

    // Auto-join room on connect
    currentRoom = getOrCreateRoom(playerId);
    currentRoom.addPlayer(playerId, username);
    socket.join(currentRoom.id);

    console.log(`Player ${playerId} (${username}) joined room ${currentRoom.id}`);

    socket.emit('player_joined', {
      playerId,
      roomId: currentRoom.id
    });

    io.to(currentRoom.id).emit('players_in_room', currentRoom.getPlayers());

    socket.on('player_move', (data) => {
      if (currentRoom && playerId) {
        currentRoom.updatePlayerPosition(playerId, data.x, data.y, data.z);
        io.to(currentRoom.id).emit('player_moved', {
          playerId,
          x: data.x,
          y: data.y,
          z: data.z
        });
      }
    });

    socket.on('get_players_in_room', () => {
      if (currentRoom) {
        socket.emit('players_in_room', currentRoom.getPlayers());
      }
    });

    socket.on('disconnect', () => {
      if (currentRoom && playerId) {
        currentRoom.removePlayer(playerId);
        io.to(currentRoom.id).emit('player_left', { playerId });
        io.to(currentRoom.id).emit('players_in_room', currentRoom.getPlayers());

        if (currentRoom.isEmpty()) {
          delete rooms[currentRoom.id];
          console.log(`Room ${currentRoom.id} deleted`);
        }
      }
      console.log(`Player ${playerId} disconnected`);
    });
  };
}

module.exports = {
  handleSocketConnection,
  rooms
};
