const { Client, GatewayIntentBits } = require('discord.js');
const mqtt = require('mqtt');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MQTT_URL = process.env.MQTT_URL || 'wss://broker.emqx.io:8084/mqtt';
const MQTT_TOPIC = 'thefloorvr/admin-events';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });
let mqttClient = null;

// Connect to MQTT
function initMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: 'thefloorvr-bot-' + Math.random().toString(36).slice(7),
    clean: true,
    reconnectPeriod: 1000,
    rejectUnauthorized: false,
  });

  mqttClient.on('connect', () => {
    console.log('✓ Bot connected to MQTT broker');
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err);
  });
}

// Register slash commands
const commands = [
  {
    name: 'tokens',
    description: 'Give tokens to players',
    options: [
      { name: 'amount', type: 4, description: 'Amount of tokens', required: true },
      { name: 'player', type: 3, description: 'Player username (empty = everyone)', required: false }
    ]
  },
  {
    name: 'luckboost',
    description: 'Boost luck temporarily',
    options: [
      { name: 'multiplier', type: 10, description: 'Luck multiplier (e.g. 2)', required: true },
      { name: 'duration', type: 4, description: 'Duration in seconds (default 60)', required: false },
      { name: 'player', type: 3, description: 'Player username (empty = everyone)', required: false }
    ]
  },
  {
    name: 'event',
    description: 'Trigger a casino event',
    options: [
      { name: 'name', type: 3, description: 'Event name (e.g. "tokens-rain", "lucky-hour")', required: true },
      { name: 'duration', type: 4, description: 'Duration in seconds (default 60)', required: false }
    ]
  },
  {
    name: 'announce',
    description: 'Send announcement to all players',
    options: [
      { name: 'message', type: 3, description: 'Announcement message', required: true }
    ]
  }
];

async function registerCommands() {
  try {
    const rest = new (require('discord.js')).REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(
      require('discord.js').Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✓ Slash commands registered');
  } catch (e) {
    console.error('Failed to register commands:', e);
  }
}

client.on('ready', () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  // Restrict to owner
  if (interaction.user.id !== OWNER_ID) {
    await interaction.reply({ content: '❌ Only the owner can use this command', ephemeral: true });
    return;
  }

  const cmd = interaction.commandName;

  try {
    if (cmd === 'tokens') {
      const amount = interaction.options.getInteger('amount');
      const player = interaction.options.getString('player') || 'everyone';

      publishEvent({
        type: 'tokens',
        amount,
        target: player
      });

      await interaction.reply(`✅ Gave ${amount} tokens to ${player}`);
    }
    else if (cmd === 'luckboost') {
      const multiplier = interaction.options.getNumber('multiplier');
      const duration = interaction.options.getInteger('duration') || 60;
      const player = interaction.options.getString('player') || 'everyone';

      publishEvent({
        type: 'luckboost',
        multiplier,
        duration,
        target: player
      });

      await interaction.reply(`✨ Boosted luck ${multiplier}x for ${duration}s (target: ${player})`);
    }
    else if (cmd === 'event') {
      const name = interaction.options.getString('name');
      const duration = interaction.options.getInteger('duration') || 60;

      publishEvent({
        type: 'event',
        name,
        duration
      });

      await interaction.reply(`🎉 Event: ${name} (${duration}s)`);
    }
    else if (cmd === 'announce') {
      const message = interaction.options.getString('message');

      publishEvent({
        type: 'announcement',
        message
      });

      await interaction.reply(`📢 Announced: ${message}`);
    }
  } catch (e) {
    console.error('Command error:', e);
    await interaction.reply({ content: '❌ Error executing command', ephemeral: true });
  }
});

function publishEvent(event) {
  if (!mqttClient || !mqttClient.connected) {
    console.error('MQTT not connected');
    return;
  }

  mqttClient.publish(MQTT_TOPIC, JSON.stringify(event), (err) => {
    if (err) {
      console.error('MQTT publish error:', err);
    } else {
      console.log(`📤 Published: ${event.type}`);
    }
  });
}

// Start bot
client.login(DISCORD_TOKEN);
initMqtt();
