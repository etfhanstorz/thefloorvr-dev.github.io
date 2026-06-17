const { Client, GatewayIntentBits } = require('discord.js');
const mqtt = require('mqtt');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MQTT_URL = process.env.MQTT_URL || 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'thefloorvr/admin-events';
const MQTT_WIPE = 'thefloorvr/wipe-window';

// parse "1pm" / "13:00" / "3:30pm" -> epoch ms today, in the bot machine's local TZ
function parseLocalTime(s) {
  if (!s) return null;
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const ap = m[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  const d = new Date(); d.setHours(h, min, 0, 0); return d.getTime();
}
const MQTT_QUERY = 'thefloorvr/admin-query';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });
let mqttClient = null;
let onlinePlayers = {}; // Track players who respond to queries

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
    // Subscribe to player responses
    mqttClient.subscribe(MQTT_QUERY + '/response', (err) => {
      if (!err) console.log('✓ Subscribed to query responses');
    });
  });

  mqttClient.on('message', (topic, message) => {
    if (topic === MQTT_QUERY + '/response') {
      try {
        const data = JSON.parse(message.toString());
        onlinePlayers[data.peerId] = data;
      } catch (e) {
        console.error('Failed to parse player response:', e);
      }
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err);
  });
}

// Register slash commands
const commands = [
  {
    name: 'listplayers',
    description: 'List all online players and their stats'
  },
  {
    name: 'editplayer',
    description: 'Edit a player (ban/mute/balance)',
    options: [
      { name: 'username', type: 3, description: 'Player username', required: true },
      { name: 'action', type: 3, description: 'ban, unban, mute, unmute, balance', required: true },
      { name: 'value', type: 3, description: 'yes/no for ban/mute, amount for balance', required: false }
    ]
  },
  {
    name: 'shutdown',
    description: 'Kick all players from the game'
  },
  {
    name: 'event',
    description: 'Trigger a casino event',
    options: [
      { name: 'name', type: 3, description: 'Event name', required: true },
      { name: 'duration', type: 4, description: 'Duration in seconds', required: false }
    ]
  },
  {
    name: 'announce',
    description: 'Send announcement to all players',
    options: [
      { name: 'message', type: 3, description: 'Announcement message', required: true }
    ]
  },
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
      { name: 'duration', type: 4, description: 'Duration in seconds', required: false },
      { name: 'player', type: 3, description: 'Player username (empty = everyone)', required: false }
    ]
  },
  {
    name: 'devmode',
    description: 'Toggle dev mode (enables cheats)'
  },
  {
    name: 'currentstatus',
    description: 'Show current game status'
  },
  {
    name: 'resetdatabase',
    description: 'DANGER: wipe accounts of players who log in during a window (+1000 P$ goodwill)',
    options: [
      { name: 'confirm', type: 5, description: 'Set to True to confirm this destructive reset', required: true },
      { name: 'from', type: 3, description: 'Window start in your local time, e.g. 1pm or 13:00 (blank = now)', required: false },
      { name: 'to', type: 3, description: 'Window end, e.g. 3pm or 15:00 (blank = everyone, immediately)', required: false }
    ]
  }
];

async function registerCommands() {
  try {
    const { REST, Routes } = require('discord.js');
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      // guild-scoped commands appear INSTANTLY (great for dev)
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
      console.log(`✓ Slash commands registered to guild ${guildId} (instant)`);
    } else {
      // global commands can take up to ~1 hour to appear
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('✓ Slash commands registered globally (may take up to ~1h to appear)');
    }
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
    if (cmd === 'listplayers') {
      await interaction.deferReply();

      // Query all players
      publishEvent({ type: 'query-players' });

      // Wait for responses
      await new Promise(resolve => setTimeout(resolve, 2000));

      const playerList = Object.values(onlinePlayers);
      if (playerList.length === 0) {
        await interaction.editReply('No players online');
        return;
      }

      const playerText = playerList.map((p, i) =>
        `${i+1}. **${p.username}** (ID: ${p.peerId.slice(0, 8)}...)\n   Balance: ${p.balance} P$ | Games: ${p.stats?.gamesPlayed || 0}`
      ).join('\n');

      await interaction.editReply(`📋 **Online Players (${playerList.length})**\n\n${playerText}`);
      onlinePlayers = {}; // Reset
    }
    else if (cmd === 'editplayer') {
      const username = interaction.options.getString('username');
      const action = interaction.options.getString('action');
      const value = interaction.options.getString('value') || '';

      publishEvent({
        type: 'admin-action',
        action,
        username,
        value
      });

      await interaction.reply(`✅ Admin action: **${action}** on **${username}** (value: ${value || 'N/A'})`);
    }
    else if (cmd === 'shutdown') {
      publishEvent({ type: 'shutdown' });
      await interaction.reply('🔴 Shutdown command sent to all players');
    }
    else if (cmd === 'event') {
      const name = interaction.options.getString('name');
      const duration = interaction.options.getInteger('duration') || 60;

      publishEvent({
        type: 'event',
        name,
        duration
      });

      await interaction.reply(`🎉 Event: **${name}** (${duration}s)`);
    }
    else if (cmd === 'announce') {
      const message = interaction.options.getString('message');

      publishEvent({
        type: 'announcement',
        message
      });

      await interaction.reply(`📢 Announced: ${message}`);
    }
    else if (cmd === 'tokens') {
      const amount = interaction.options.getInteger('amount');
      const player = interaction.options.getString('player') || 'everyone';

      publishEvent({
        type: 'tokens',
        amount,
        target: player
      });

      await interaction.reply(`💰 Gave ${amount} tokens to ${player}`);
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

      await interaction.reply(`✨ Luck ${multiplier}x for ${duration}s (${player})`);
    }
    else if (cmd === 'devmode') {
      publishEvent({ type: 'devmode-toggle' });
      await interaction.reply('🔧 Dev mode toggled');
    }
    else if (cmd === 'currentstatus') {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);

      await interaction.reply(`
📊 **Game Status**
- Bot uptime: ${hours}h ${mins}m
- Online players: ${Object.keys(onlinePlayers).length}
- MQTT broker: ✓ Connected
- Discord: ✓ Connected
      `);
    }
    else if (cmd === 'resetdatabase') {
      const confirm = interaction.options.getBoolean('confirm');
      if (!confirm) {
        await interaction.reply({ content: '❌ Set `confirm:True` to run this destructive reset.', ephemeral: true });
        return;
      }
      const fromStr = interaction.options.getString('from');
      const toStr = interaction.options.getString('to');
      const from = parseLocalTime(fromStr);
      const to = parseLocalTime(toStr);
      const immediate = !from && !to;
      const payload = { id: Date.now(), from, to, immediate };

      // retained for a window (so mid-window logins are caught); one-shot if immediate
      mqttClient.publish(MQTT_WIPE, JSON.stringify(payload), { retain: !immediate, qos: 1 }, (err) => {
        if (err) console.error('wipe publish error:', err);
      });

      const when = immediate
        ? 'EVERYONE online right now'
        : `players who log in between **${fromStr || 'now'}** and **${toStr || 'later'}** (bot local time)`;
      await interaction.reply(`🗑️ Account reset armed for ${when}. Wiped players get +1000 P$.`);
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
