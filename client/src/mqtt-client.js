// MQTT client for Discord admin events
// Connects to a public MQTT broker and listens for admin commands.
// HiveMQ's public broker is anonymous + reliable (emqx.io was refusing with
// "Not authorized" under load).

const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'thefloorvr/admin-events';
const MQTT_WIPE = 'thefloorvr/wipe-window'; // retained: an active account-reset window

let mqttClient = null;
let deviceId = null;

function initDeviceId() {
  if (!deviceId) {
    const stored = localStorage.getItem('floorVrDeviceId');
    if (stored) {
      deviceId = stored;
    } else {
      deviceId = 'player-' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('floorVrDeviceId', deviceId);
    }
  }
  return deviceId;
}

async function initMqtt() {
  if (mqttClient) return;

  try {
    const mqtt = window.mqtt; // Loaded via CDN
    if (!mqtt) {
      console.warn('MQTT library not loaded');
      return;
    }

    mqttClient = mqtt.connect(MQTT_URL, {
      // unique per connection so two tabs / reconnects never collide
      clientId: 'floorvr-' + initDeviceId() + '-' + Math.random().toString(16).slice(2, 8),
      clean: true,
      reconnectPeriod: 4000,
    });

    mqttClient.on('connect', () => {
      console.log('✓ Connected to MQTT broker');
      mqttClient.subscribe([MQTT_TOPIC, MQTT_WIPE], (err) => {
        if (err) console.error('MQTT subscribe error:', err);
        else console.log(`✓ Subscribed to ${MQTT_TOPIC} + wipe window`);
      });
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic === MQTT_WIPE) handleWipeWindow(data);
        else handleAdminEvent(data);
      } catch (e) {
        console.error('Failed to parse MQTT message:', e);
      }
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT error:', err);
    });

    mqttClient.on('disconnect', () => {
      console.log('MQTT disconnected');
    });
  } catch (err) {
    console.error('Failed to init MQTT:', err);
  }
}

// Account-reset window. {id, from, to, immediate}. A player who is logged in
// during [from, to] (or any time, if immediate) gets wiped once and a +1000 P$
// goodwill bonus. Retained, so people who log in mid-window are caught too.
function handleWipeWindow(win) {
  if (!win || !win.id) return;
  if (localStorage.getItem('floorVrWipeId') === String(win.id)) return; // already applied

  const now = Date.now();
  const inWindow = win.immediate || ((!win.from || now >= win.from) && (!win.to || now <= win.to));
  if (!inWindow) return;
  if (!window.currentPlayer || !window.currentPlayer.username) return; // not logged in yet

  localStorage.setItem('floorVrWipeId', String(win.id)); // mark first so we never loop
  if (window.wipeLocalAccount) window.wipeLocalAccount(1000);
  if (window.playSoundIfNotMuted) playSoundIfNotMuted('notification');
  if (window.showToast) window.showToast('🗑️ Account reset by admin — here\'s 1000 P$ for the trouble!', '#ffd24a');
}

function handleAdminEvent(event) {
  const { type, amount, multiplier, duration, name, action, username, value, target } = event;

  switch (type) {
    case 'query-players':
      // Respond with player data
      publishToMqtt('thefloorvr/admin-query/response', {
        peerId: initDeviceId(),
        username: window.currentPlayer.username,
        balance: window.currentPlayer.balance,
        stats: window.currentPlayer.stats || {}
      });
      break;

    case 'tokens':
      if (target === 'everyone' || target === window.currentPlayer.username) {
        window.currentPlayer.balance += amount;
        savePlayerData();
        console.log(`🎁 Admin gave ${amount} tokens! Balance: ${window.currentPlayer.balance}`);
      }
      break;

    case 'luckboost':
      if (target === 'everyone' || target === window.currentPlayer.username) {
        console.log(`✨ Luck boosted by ${multiplier}x for ${duration}s`);
        window.luckBoostActive = multiplier;
        window.luckBoostEnd = Date.now() + (duration * 1000);
        setTimeout(() => {
          window.luckBoostActive = 1;
        }, duration * 1000);
      }
      break;

    case 'admin-action':
      if (action === 'ban' && value === 'yes') {
        if (username === window.currentPlayer.username) {
          console.log('❌ You have been banned');
          localStorage.setItem('floorVrBanned', 'true');
          if (window.showToast) window.showToast('🚫 You have been banned', '#ff6b6b');
          setTimeout(() => location.reload(), 2500);
        }
      } else if (action === 'unban') {
        localStorage.removeItem('floorVrBanned');
      } else if (action === 'balance' && username === window.currentPlayer.username) {
        const newBalance = parseInt(value);
        if (!isNaN(newBalance)) {
          window.currentPlayer.balance = newBalance;
          savePlayerData();
          console.log(`💰 Balance set to ${newBalance}`);
        }
      }
      break;

    case 'announcement':
      console.log(`📢 ${event.message}`);
      playSoundIfNotMuted('notification');
      if (window.showToast) window.showToast('📢 ' + event.message, '#ffd24a');
      break;

    case 'event':
      console.log(`🎉 Event: ${name}`);
      if (window.showToast) window.showToast('🎉 Event: ' + name, '#ff33aa');
      triggerAdminEvent(name, event);
      break;

    case 'shutdown':
      console.log('🔴 Server shutdown - disconnecting');
      if (window.showToast) window.showToast('🔴 Server is shutting down', '#ff6b6b');
      setTimeout(() => location.reload(), 2500);
      break;

    case 'devmode-toggle':
      window.devModeEnabled = !window.devModeEnabled;
      console.log(`🔧 Dev mode: ${window.devModeEnabled ? 'ON' : 'OFF'}`);
      break;
  }
}

function triggerAdminEvent(name, event) {
  // Admin events can be handled here
  // Examples: Token Rain, Golden Hour, etc.
  playSoundIfNotMuted('notification');
}

// For future: send messages to MQTT (e.g., player joined, big win)
function publishToMqtt(topic, message) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(message));
  }
}

window.initMqtt = initMqtt;
window.publishToMqtt = publishToMqtt;
