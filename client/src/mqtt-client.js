// MQTT client for Discord admin events
// Connects to a public MQTT broker and listens for admin commands.
// HiveMQ's public broker is anonymous + reliable (emqx.io was refusing with
// "Not authorized" under load).

const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'thefloorvr/admin-events';

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
      mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (err) console.error('MQTT subscribe error:', err);
        else console.log(`✓ Subscribed to ${MQTT_TOPIC}`);
      });
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const event = JSON.parse(message.toString());
        handleAdminEvent(event);
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
