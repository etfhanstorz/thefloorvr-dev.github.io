const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

let updateScheduled = null;
let eventStatus = {};

// Register slash commands
const commands = [
  {
    name: 'listplayers',
    description: 'List all registered players and their data'
  },
  {
    name: 'editplayer',
    description: 'Edit player: ban, mute voice, add/remove P$, edit inventory',
    options: [
      { name: 'playerid', type: 3, description: 'Player ID', required: true },
      { name: 'action', type: 3, description: 'ban, mute, balance, or inventory', required: true },
      { name: 'value', type: 3, description: 'yes (for ban/mute), +/-amount (for balance)', required: false }
    ]
  },
  {
    name: 'shutdown',
    description: 'Kick everyone in a server',
    options: [
      { name: 'serverid', type: 3, description: 'Server ID (room ID)', required: true }
    ]
  },
  {
    name: 'event',
    description: 'Create or stop an event',
    options: [
      { name: 'eventname', type: 3, description: 'Event name', required: true },
      { name: 'action', type: 3, description: 'start or stop', required: true, choices: [
        { name: 'start', value: 'start' },
        { name: 'stop', value: 'stop' }
      ]},
      { name: 'time', type: 3, description: 'Duration in minutes (for start)', required: false }
    ]
  },
  {
    name: 'update',
    description: 'Schedule server shutdown after N minutes',
    options: [
      { name: 'minutes', type: 4, description: 'Minutes until shutdown', required: true }
    ]
  },
  {
    name: 'devmode',
    description: 'Give a user 1e50 P$',
    options: [
      { name: 'userid', type: 3, description: 'Player ID', required: true }
    ]
  },
  {
    name: 'currentstatus',
    description: 'Show bot, game, and update status'
  },
  {
    name: 'getpassword',
    description: 'View player password',
    options: [
      { name: 'playerid', type: 3, description: 'Player ID', required: true }
    ]
  },
  {
    name: 'resetpassword',
    description: 'Reset player password',
    options: [
      { name: 'playerid', type: 3, description: 'Player ID', required: true },
      { name: 'newpassword', type: 3, description: 'New password', required: true }
    ]
  }
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

client.on('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Check if user is owner
  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: '❌ Only the bot owner can use these commands', ephemeral: true });
  }

  try {
    switch (interaction.commandName) {
      case 'listplayers':
        await listPlayers(interaction);
        break;
      case 'editplayer':
        await editPlayer(interaction);
        break;
      case 'shutdown':
        await shutdownServer(interaction);
        break;
      case 'event':
        await manageEvent(interaction);
        break;
      case 'update':
        await scheduleUpdate(interaction);
        break;
      case 'devmode':
        await devMode(interaction);
        break;
      case 'currentstatus':
        await currentStatus(interaction);
        break;
      case 'getpassword':
        await getPassword(interaction);
        break;
      case 'resetpassword':
        await resetPassword(interaction);
        break;
    }
  } catch (error) {
    console.error('Command error:', error);
    interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
  }
});

async function listPlayers(interaction) {
  await interaction.deferReply();
  try {
    // Get player list from game server
    const response = await axios.get(`${SERVER_URL}/api/players`);
    const players = response.data;

    if (!players || players.length === 0) {
      return interaction.editReply('📭 No players registered');
    }

    const embed = new EmbedBuilder()
      .setTitle('👥 Registered Players')
      .setColor(0x00ff00)
      .setTimestamp();

    players.slice(0, 25).forEach(p => {
      embed.addFields({
        name: `${p.username} (ID: ${p.id})`,
        value: `Balance: ${p.balance} P$ | Status: ${p.banned ? '🚫 BANNED' : '✅ Active'}`
      });
    });

    if (players.length > 25) {
      embed.setFooter({ text: `+${players.length - 25} more players` });
    }

    interaction.editReply({ embeds: [embed] });
  } catch (error) {
    interaction.editReply(`❌ Failed to fetch players: ${error.message}`);
  }
}

async function editPlayer(interaction) {
  const playerId = interaction.options.getString('playerid');
  const action = interaction.options.getString('action');
  const value = interaction.options.getString('value');

  await interaction.deferReply();

  try {
    if (action === 'ban') {
      await axios.post(`${SERVER_URL}/admin/editplayer`, { playerId, action: 'ban' });
      interaction.editReply(`✅ Player #${playerId} has been banned`);
    } else if (action === 'mute') {
      await axios.post(`${SERVER_URL}/admin/editplayer`, { playerId, action: 'mute' });
      interaction.editReply(`🔇 Player #${playerId} voice chat muted (can still hear)`);
    } else if (action === 'balance') {
      const amount = parseInt(value);
      if (isNaN(amount)) {
        return interaction.editReply('❌ Balance must be a number (e.g., +100 or -50)');
      }
      await axios.post(`${SERVER_URL}/admin/editplayer`, { playerId, action: 'balance', value: amount });
      interaction.editReply(`💰 Player #${playerId} balance adjusted by ${amount} P$`);
    } else if (action === 'inventory') {
      const player = await axios.get(`${SERVER_URL}/api/players`);
      const p = player.data.find(x => x.id == playerId);
      if (!p) return interaction.editReply('❌ Player not found');
      interaction.editReply(`📦 Player #${playerId} inventory: ${p.inventory?.join(', ') || 'Empty'}`);
    } else {
      interaction.editReply('❌ Invalid action. Use: ban, mute, balance, or inventory');
    }
  } catch (error) {
    interaction.editReply(`❌ Error: ${error.message}`);
  }
}

async function shutdownServer(interaction) {
  const serverId = interaction.options.getString('serverid');
  await interaction.deferReply();

  try {
    // Kick everyone in that room
    await axios.post(`${SERVER_URL}/admin/shutdown`, { roomId: serverId });
    interaction.editReply(`✅ Kicked all players in server ${serverId}`);
  } catch (error) {
    interaction.editReply(`❌ Failed: ${error.message}`);
  }
}

async function manageEvent(interaction) {
  const eventName = interaction.options.getString('eventname');
  const action = interaction.options.getString('action');
  const time = interaction.options.getInteger('time');

  if (action === 'start') {
    eventStatus[eventName] = { started: Date.now(), duration: (time || 60) * 60 * 1000 };
    const embed = new EmbedBuilder()
      .setTitle(`🎉 Event Started: ${eventName}`)
      .setColor(0x00ff00)
      .addFields({ name: 'Duration', value: `${time || 60} minutes` })
      .setTimestamp();
    interaction.reply({ embeds: [embed] });
  } else {
    delete eventStatus[eventName];
    interaction.reply(`✅ Event "${eventName}" stopped`);
  }
}

async function scheduleUpdate(interaction) {
  const minutes = interaction.options.getInteger('minutes');
  const shutdownTime = Date.now() + minutes * 60 * 1000;

  updateScheduled = { shutdownTime, minutes };

  const embed = new EmbedBuilder()
    .setTitle('⏰ Server Update Scheduled')
    .setColor(0xffff00)
    .addFields(
      { name: 'Shutdown in', value: `${minutes} minutes` },
      { name: 'Affected Servers', value: 'All servers will be shut down' }
    )
    .setTimestamp();

  interaction.reply({ embeds: [embed] });
}

async function devMode(interaction) {
  const userId = interaction.options.getString('userid');

  try {
    await axios.post(`${SERVER_URL}/admin/devmode`, { playerId: userId });
    interaction.reply(`✅ Gave player #${userId} 1e50 P$`);
  } catch (error) {
    interaction.reply(`❌ Failed: ${error.message}`);
  }
}

async function currentStatus(interaction) {
  const botUptime = Math.floor(client.uptime / 1000);
  const uptimeStr = `${Math.floor(botUptime / 3600)}h ${Math.floor((botUptime % 3600) / 60)}m`;

  let updateInfo = '❌ No update scheduled';
  if (updateScheduled) {
    const timeLeft = Math.max(0, updateScheduled.shutdownTime - Date.now());
    const mins = Math.floor(timeLeft / 60000);
    updateInfo = `⏰ Shutdown in ${mins}m`;
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Current Status')
    .setColor(0x00ffff)
    .addFields(
      { name: '🤖 Discord Bot', value: `✅ Online | Uptime: ${uptimeStr}` },
      { name: '🎮 Game Server', value: `✅ Running | Port: 3001` },
      { name: '📦 Version', value: '1.0.0' },
      { name: '⏰ Update Status', value: updateInfo },
      { name: '🎉 Active Events', value: Object.keys(eventStatus).join(', ') || 'None' }
    )
    .setTimestamp();

  interaction.reply({ embeds: [embed] });
}

async function getPassword(interaction) {
  const playerId = interaction.options.getString('playerid');
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await axios.get(`${SERVER_URL}/api/players`);
    const player = response.data.find(p => p.id == playerId);

    if (!player) {
      return interaction.editReply(`❌ Player #${playerId} not found`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔐 Player #${playerId} - ${player.username}`)
      .setColor(0xff6600)
      .addFields(
        { name: 'Password', value: `\`\`\`${player.password}\`\`\`` },
        { name: 'Balance', value: `${player.balance} P$` },
        { name: 'Status', value: player.banned ? '🚫 BANNED' : '✅ Active' }
      );

    interaction.editReply({ embeds: [embed] });
  } catch (error) {
    interaction.editReply(`❌ Error: ${error.message}`);
  }
}

async function resetPassword(interaction) {
  const playerId = interaction.options.getString('playerid');
  const newPassword = interaction.options.getString('newpassword');
  await interaction.deferReply({ ephemeral: true });

  try {
    await axios.post(`${SERVER_URL}/admin/resetpassword`, { playerId, newPassword });
    interaction.editReply(`✅ Reset password for player #${playerId} to: \`${newPassword}\``);
  } catch (error) {
    interaction.editReply(`❌ Error: ${error.message}`);
  }
}

client.login(BOT_TOKEN);
