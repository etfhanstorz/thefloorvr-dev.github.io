let shopUI = null;
let shopItems = [];

function initShopUI() {
  shopUI = document.createElement('div');
  shopUI.id = 'shop-ui';
  shopUI.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 760px;
    width: 400px;
    max-height: 500px;
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid #ff6600;
    border-radius: 10px;
    padding: 15px;
    color: white;
    font-family: monospace;
    z-index: 50;
    display: none;
    overflow-y: auto;
  `;
  document.body.appendChild(shopUI);
}

function showShop() {
  if (!shopUI) initShopUI();

  const username = document.getElementById('username').value;
  if (!username.endsWith('.devtest')) {
    alert('❌ Shop is only available for .devtest accounts');
    return;
  }

  shopUI.style.display = 'block';
  shopUI.innerHTML = `<h3>🛍️ Shop</h3><div id="shop-loading">Loading items...</div>`;

  if (socket) {
    socket.emit('get_shop');
  }
}

function closeShop() {
  if (shopUI) shopUI.style.display = 'none';
}

window.onShopItems = (items) => {
  shopItems = items;
  let html = '<h3>🛍️ Shop</h3>';

  const cosmetics = items.filter(i => i.type === 'cosmetic');
  const upgrades = items.filter(i => i.type === 'upgrade');

  if (cosmetics.length > 0) {
    html += '<strong>👗 Cosmetics</strong><div style="margin-bottom: 10px;">';
    cosmetics.forEach(item => {
      html += `<div style="margin: 5px 0; padding: 5px; background: #333; border-radius: 3px;">
        ${item.name} - ${item.cost} P$
        <button onclick="buyItem('${item.id}')" style="float: right; padding: 2px 8px; background: #00ff00; color: black; border: none; cursor: pointer; font-size: 12px;">Buy</button>
      </div>`;
    });
    html += '</div>';
  }

  if (upgrades.length > 0) {
    html += '<strong>⚡ Upgrades</strong><div style="margin-bottom: 10px;">';
    upgrades.forEach(item => {
      html += `<div style="margin: 5px 0; padding: 5px; background: #333; border-radius: 3px;">
        ${item.name} - ${item.cost} P$
        <button onclick="buyItem('${item.id}')" style="float: right; padding: 2px 8px; background: #ffff00; color: black; border: none; cursor: pointer; font-size: 12px;">Buy</button>
      </div>`;
    });
    html += '</div>';
  }

  html += `<button onclick="closeShop()" style="width: 100%; padding: 8px; background: #ff0000; color: white; border: none; cursor: pointer; margin-top: 10px;">Close</button>`;

  shopUI.innerHTML = html;
};

function buyItem(itemId) {
  playSoundIfNotMuted('purchase');
  if (socket) {
    socket.emit('purchase_item', { itemId });
  }
}

window.onPurchaseResult = (result) => {
  if (!result.success) {
    alert('❌ ' + result.error);
    return;
  }

  alert(`✅ Purchased: ${result.item.name}\nNew Balance: ${result.newBalance} P$`);
  if (socket) socket.emit('get_shop'); // Refresh shop
};
