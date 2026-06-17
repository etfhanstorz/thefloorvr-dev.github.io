// MQTT client for Discord admin events
// Connects to public MQTT broker (emqx.io) and listens for admin commands

const MQTT_URL = 'wss://broker.emqx.io:8084/mqtt';
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
      clientId: initDeviceId(),
      clean: true,
      reconnectPeriod: 1000,
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
  const { type, amount, multiplier, duration, name } = event;

  switch (type) {
    case 'tokens':
      if (window.currentPlayer) {
        window.currentPlayer.balance += amount;
        savePlayerData();
        console.log(`🎁 Admin gave ${amount} tokens! Balance: ${window.currentPlayer.balance}`);
      }
      break;
    case 'luckboost':
      console.log(`✨ Luck boosted by ${multiplier}x for ${duration}s`);
      window.luckBoostActive = multiplier;
      window.luckBoostEnd = Date.now() + (duration * 1000);
      setTimeout(() => {
        window.luckBoostActive = 1;
      }, duration * 1000);
      break;
    case 'event':
      console.log(`🎉 Admin event: ${name}`);
      triggerAdminEvent(name, event);
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
