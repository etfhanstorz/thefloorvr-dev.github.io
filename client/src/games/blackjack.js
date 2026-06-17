let currentTable = null;
let tableUI = null;

function initBlackjackUI() {
  tableUI = document.createElement('div');
  tableUI.id = 'blackjack-ui';
  tableUI.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 20px;
    width: 400px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ff00;
    border-radius: 10px;
    padding: 15px;
    color: white;
    font-family: monospace;
    z-index: 50;
    display: none;
  `;
  document.body.appendChild(tableUI);
}

function showBlackjack() {
  if (!tableUI) initBlackjackUI();
  tableUI.style.display = 'block';
  tableUI.innerHTML = `
    <h3>♠️ Blackjack Table</h3>
    <div id="game-status">Waiting for players...</div>
    <div id="dealer-hand" style="margin: 10px 0;">
      <strong>Dealer:</strong> <span id="dealer-cards">-</span>
    </div>
    <div id="player-hand" style="margin: 10px 0;">
      <strong>Your Hand:</strong> <span id="player-cards">-</span> (Value: <span id="player-value">0</span>)
    </div>
    <div id="bet-section" style="margin: 10px 0;">
      <input type="number" id="bet-amount" placeholder="Bet amount" min="1" value="100" style="width: 100px; padding: 5px;">
      <button onclick="placeBet()" style="padding: 5px 10px; background: #00ff00; color: black; border: none; cursor: pointer;">Bet</button>
    </div>
    <div id="action-buttons" style="display: none; margin: 10px 0;">
      <button onclick="hit()" style="padding: 5px 10px; background: #0066ff; color: white; border: none; cursor: pointer; margin-right: 5px;">Hit</button>
      <button onclick="stand()" style="padding: 5px 10px; background: #ff6600; color: white; border: none; cursor: pointer;">Stand</button>
    </div>
    <div id="result" style="margin: 10px 0; display: none; color: #00ff00; font-weight: bold;"></div>
    <button onclick="closeBlackjack()" style="width: 100%; padding: 8px; background: #ff0000; color: white; border: none; cursor: pointer; margin-top: 10px;">Exit Game</button>
  `;
}

function closeBlackjack() {
  if (tableUI) tableUI.style.display = 'none';
  if (socket) socket.emit('leave_blackjack_table');
}

function placeBet() {
  const amount = parseInt(document.getElementById('bet-amount').value);
  if (isNaN(amount) || amount < 1) {
    alert('Invalid bet amount');
    return;
  }
  if (socket) socket.emit('blackjack_bet', { amount });
}

function hit() {
  if (socket) socket.emit('blackjack_hit');
}

function stand() {
  if (socket) socket.emit('blackjack_stand');
}

function updateBlackjackUI(state) {
  if (!tableUI || !state) return;

  const statusDiv = document.getElementById('game-status');
  const dealerDiv = document.getElementById('dealer-cards');
  const playerDiv = document.getElementById('player-cards');
  const valueDiv = document.getElementById('player-value');
  const actionDiv = document.getElementById('action-buttons');
  const resultDiv = document.getElementById('result');
  const betSection = document.getElementById('bet-section');

  statusDiv.textContent = `Status: ${state.status} | Players: ${Object.keys(state.players).length}/${state.maxPlayers}`;

  // Show dealer
  if (state.dealer && state.dealer.hand) {
    dealerDiv.textContent = state.dealer.hand.map(c => c.rank + c.suit).join(' ') + ` (${state.dealer.value})`;
  }

  // Show player hand
  const player = state.players.find(p => p.id === currentPlayerId);
  if (player) {
    playerDiv.textContent = player.hand.map(c => c.rank + c.suit).join(' ');
    valueDiv.textContent = player.value;

    if (state.status === 'playing' && player.status === 'playing') {
      actionDiv.style.display = 'block';
      betSection.style.display = 'none';
    } else {
      actionDiv.style.display = 'none';
    }

    if (state.status === 'results') {
      actionDiv.style.display = 'none';
      betSection.style.display = 'none';
      resultDiv.style.display = 'block';
      resultDiv.textContent = `Result: ${player.status.toUpperCase()} - Payout: ${player.payout} P$`;
    }
  }
}

// Socket listeners
window.onBlackjackStateUpdate = (state) => {
  updateBlackjackUI(state);
};
