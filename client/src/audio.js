const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

// Simple synth sound generator (no external audio files needed)
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playSound(name) {
  switch (name) {
    case 'click':
      playTone(400, 0.1, 'sine', 0.2);
      break;
    case 'win':
      playTone(523, 0.2, 'sine', 0.3); // C5
      setTimeout(() => playTone(659, 0.2, 'sine', 0.3), 100); // E5
      setTimeout(() => playTone(784, 0.3, 'sine', 0.3), 200); // G5
      break;
    case 'loss':
      playTone(220, 0.3, 'sine', 0.2); // A3
      break;
    case 'plinko_drop':
      playTone(300, 0.1, 'sine', 0.2);
      break;
    case 'wheel_spin':
      playTone(440, 0.05, 'square', 0.15);
      setTimeout(() => playTone(550, 0.05, 'square', 0.15), 50);
      setTimeout(() => playTone(660, 0.05, 'square', 0.15), 100);
      break;
    case 'purchase':
      playTone(659, 0.15, 'sine', 0.3); // E5
      setTimeout(() => playTone(784, 0.15, 'sine', 0.3), 150); // G5
      break;
    case 'blackjack_deal':
      playTone(262, 0.1, 'sine', 0.2); // C4
      setTimeout(() => playTone(330, 0.1, 'sine', 0.2), 50); // E4
      break;
    case 'notification':
      playTone(800, 0.08, 'sine', 0.15);
      break;
  }
}

// Mute button functionality
window.isMuted = false;

function toggleMute() {
  window.isMuted = !window.isMuted;
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) {
    muteBtn.innerHTML = window.isMuted ? '🔇' : '🔊';
  }
}

// Play sound only if not muted
function playSoundIfNotMuted(name) {
  if (!window.isMuted) {
    playSound(name);
  }
}

// Music background (low volume ambient tone)
function playAmbientMusic() {
  if (window.isMuted) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 110; // A2
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);

  oscillator.start();
  // Let it play indefinitely (until context closes)
}
