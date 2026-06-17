let wheelUI = null;

function initWheelUI() {
  wheelUI = document.createElement('div');
  wheelUI.id = 'wheel-ui';
  wheelUI.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 390px;
    width: 350px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ffff00;
    border-radius: 10px;
    padding: 15px;
    color: white;
    font-family: monospace;
    z-index: 50;
    display: none;
  `;
  document.body.appendChild(wheelUI);
}

function showWheel() {
  if (!wheelUI) initWheelUI();

  const username = document.getElementById('username').value;
  if (!username.endsWith('.devtest')) {
    alert('❌ Wheel is only available for .devtest accounts');
    return;
  }

  wheelUI.style.display = 'block';
  wheelUI.innerHTML = `
    <h3>🎡 Wheel of Fortune</h3>
    <div id="wheel-status">Ready to spin</div>
    <div style="margin: 10px 0;">
      <input type="number" id="wheel-bet" placeholder="Base amount" min="1" value="100" style="width: 100px; padding: 5px;">
      <button onclick="spinWheel()" style="padding: 5px 10px; background: #ffff00; color: black; border: none; cursor: pointer;">Spin</button>
    </div>
    <div id="wheel-result" style="display: none; margin: 10px 0; color: #ffff00; font-weight: bold;"></div>
    <div id="wheel-balance" style="margin: 10px 0;">Balance: -</div>
    <button onclick="closeWheel()" style="width: 100%; padding: 8px; background: #ff0000; color: white; border: none; cursor: pointer; margin-top: 10px;">Close</button>
  `;
}

function closeWheel() {
  if (wheelUI) wheelUI.style.display = 'none';
}

function spinWheel() {
  const bet = parseInt(document.getElementById('wheel-bet').value);
  if (isNaN(bet) || bet < 1) {
    alert('Invalid amount');
    return;
  }

  playSoundIfNotMuted('wheel_spin');
  document.getElementById('wheel-status').textContent = 'Spinning...';
  document.getElementById('wheel-result').style.display = 'none';

  if (socket) {
    socket.emit('wheel_spin', { baseAmount: bet });
  }
}

window.onWheelResult = (result) => {
  if (!result.success) {
    playSoundIfNotMuted('loss');
    document.getElementById('wheel-status').textContent = '❌ ' + result.error;
    return;
  }

  playSoundIfNotMuted(result.multiplier > 1 ? 'win' : 'loss');

  const resultDiv = document.getElementById('wheel-result');
  const color = result.multiplier > 1 ? '#00ff00' : result.multiplier < 0 ? '#ff0000' : '#ffff00';
  resultDiv.innerHTML = `
    <span style="color: ${color}">
    ${result.multiplier > 0 ? '✅' : '❌'} ${result.multiplier}x Multiplier<br/>
    Payout: ${result.payout} P$<br/>
    <strong>New Balance: ${result.newBalance} P$</strong>
    </span>
  `;
  resultDiv.style.display = 'block';
  document.getElementById('wheel-status').textContent = 'Ready to spin';
};
