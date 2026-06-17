const AGORA_APP_ID = '0e5607f3365c457eb583f9bb5b3f1e57';
let agoraClient = null;
let localAudioTrack = null;
let remoteUsers = {};
let voiceEnabled = false;
const VOICE_DISTANCE = 30; // Only hear players within 30 units

async function initVoiceChat(playerId, username) {
  try {
    // Create Agora client
    agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // Handle remote user audio
    agoraClient.on('user-published', async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        remoteUsers[user.uid] = user;
        console.log(`Remote user ${user.uid} audio subscribed`);
      }
    });

    agoraClient.on('user-unpublished', (user) => {
      delete remoteUsers[user.uid];
      console.log(`Remote user ${user.uid} left`);
    });

    // Join channel
    const token = null; // For testing, no token needed with default auth
    const channel = 'floor-vr-' + Math.floor(currentRoom / 1000); // Group by room

    await agoraClient.join(AGORA_APP_ID, channel, token, playerId);
    console.log(`Joined Agora channel: ${channel}`);

    // Create local audio track
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    await agoraClient.publish(localAudioTrack);
    voiceEnabled = true;
    console.log('Voice chat enabled');
  } catch (error) {
    console.error('Voice chat init failed:', error);
  }
}

function updateVoiceVolumes(localPlayerPos, remoteAvatars) {
  if (!voiceEnabled || !agoraClient) return;

  // Adjust volume based on distance (proximity audio)
  Object.entries(remoteUsers).forEach(([uid, user]) => {
    const remoteAvatar = remoteAvatars[uid];
    if (!remoteAvatar) return;

    const distance = Math.hypot(
      remoteAvatar.position.x - localPlayerPos.x,
      remoteAvatar.position.z - localPlayerPos.z
    );

    if (distance > VOICE_DISTANCE) {
      // Too far, mute
      user.audioTrack?.setVolume(0);
    } else {
      // Scale volume inversely with distance
      const volume = Math.max(0, 100 - (distance / VOICE_DISTANCE) * 100);
      user.audioTrack?.setVolume(volume);
    }
  });
}

async function leaveVoiceChat() {
  try {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (agoraClient) {
      await agoraClient.leave();
      agoraClient = null;
    }
    voiceEnabled = false;
    console.log('Left voice chat');
  } catch (error) {
    console.error('Error leaving voice chat:', error);
  }
}
