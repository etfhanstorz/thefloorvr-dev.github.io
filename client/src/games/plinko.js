let plinkoUI = null;

function initPlinkoUI() {
  plinkoUI = document.createElement('div');
  plinkoUI.id = 'plinko-ui';
  plinkoUI.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    width: 350px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ff00;
    border-radius: 10px;
    padding: 15px;
    color: white;
    font-family: monospace;
    z-index: 50;
    display: none;
  `;
  document.body.appendChild(plinkoUI);
}

function showPlinko() {
  if (!plinkoUI) initPlinkoUI();

  const username = document.getElementById('username').value;
  if (!username.endsWith('.devtest')) {
    alert('❌ Plinko is only available for .devtest accounts');
    return;
  }

  plinkoUI.style.display = 'block';
  plinkoUI.innerHTML = `
    <h3>🎯 Plinko Machine</h3>
    <div id="plinko-status">Ready to play</div>
    <div style="margin: 10px 0;">
      <input type="number" id="plinko-bet" placeholder="Bet amount" min="1" value="100" style="width: 100px; padding: 5px;">
      <button onclick="playPlinko()" style="padding: 5px 10px; background: #00ff00; color: black; border: none; cursor: pointer;">Play</button>
    </div>
    <div id="plinko-result" style="display: none; margin: 10px 0; color: #00ff00; font-weight: bold;"></div>
    <div id="plinko-balance" style="margin: 10px 0;">Balance: -</div>
    <button onclick="closePlinko()" style="width: 100%; padding: 8px; background: #ff0000; color: white; border: none; cursor: pointer; margin-top: 10px;">Close</button>
  `;
}

function closePlinko() {
  if (plinkoUI) plinkoUI.style.display = 'none';
}

function playPlinko() {
  const bet = parseInt(document.getElementById('plinko-bet').value);
  if (isNaN(bet) || bet < 1) {
    alert('Invalid bet amount');
    return;
  }

  document.getElementById('plinko-status').textContent = 'Playing...';
  document.getElementById('plinko-result').style.display = 'none';

  if (socket) {
    socket.emit('plinko_play', { betAmount: bet });
  }
}

window.onPlinkoResult = (result) => {
  if (!result.success) {
    document.getElementById('plinko-status').textContent = '❌ ' + result.error;
    return;
  }

  const resultDiv = document.getElementById('plinko-result');
  resultDiv.innerHTML = `
    ✅ Landed in bucket ${result.position}<br/>
    Multiplier: ${result.multiplier}x<br/>
    Payout: ${result.payout} P$<br/>
    <strong>New Balance: ${result.newBalance} P$</strong>
  `;
  resultDiv.style.display = 'block';
  document.getElementById('plinko-status').textContent = 'Ready to play';
};
