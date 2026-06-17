let shopUI = null;
window._shopStatus = '';

function initShopUI() {
  shopUI = document.createElement('div');
  shopUI.id = 'shop-ui';
  shopUI.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 760px;
    width: 420px;
    max-height: 520px;
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

  window._shopStatus = '';
  shopUI.style.display = 'block';
  shopUI.innerHTML = `<h3>🛍️ Shop</h3><div id="shop-loading">Loading items...</div>`;
  if (socket) socket.emit('get_shop');
}

function closeShop() {
  if (shopUI) shopUI.style.display = 'none';
}

window.onShopItems = (data) => {
  if (!shopUI) initShopUI();
  const cosmetics = data.cosmetics || [];
  const upgrades = data.upgrades || [];
  const bal = Math.floor(window.currentPlayer ? window.currentPlayer.balance : 0);

  let html = `<h3>🛍️ Shop &nbsp; <span style="color:#ffd700; font-size:14px;">P$ ${bal}</span></h3>`;

  if (window._shopStatus) {
    html += `<div style="margin:6px 0; padding:6px; background:#222; border-radius:4px; color:#9f9;">${window._shopStatus}</div>`;
  }

  // ---- Upgrades ----
  html += `<strong>⚡ Upgrades</strong><div style="margin:6px 0 12px;">`;
  upgrades.forEach(u => {
    const dots = '●'.repeat(u.level) + '○'.repeat(u.maxLevel - u.level);
    const btn = u.nextCost == null
      ? `<span style="float:right; color:#ffd700;">MAX</span>`
      : `<button onclick="shopUpgrade('${u.key}')" style="float:right; padding:3px 8px; background:#ffff00; color:black; border:none; cursor:pointer; font-size:12px;">Lv${u.level + 1} · ${u.nextCost} P$</button>`;
    html += `<div style="margin:5px 0; padding:6px; background:#333; border-radius:4px;">
      ${u.name} ${btn}<br/>
      <span style="color:#aaa; font-size:11px;">${u.desc}</span><br/>
      <span style="letter-spacing:2px; color:#ffd700;">${dots}</span>
    </div>`;
  });
  html += `</div>`;

  // ---- Cosmetics ----
  html += `<strong>👗 Cosmetics</strong><div style="margin:6px 0;">`;
  cosmetics.forEach(c => {
    let action;
    if (c.equipped) action = `<span style="float:right; color:#0f0;">✓ Equipped</span>`;
    else if (c.owned) action = `<button onclick="shopEquip('${c.id}')" style="float:right; padding:3px 8px; background:#00aaff; color:white; border:none; cursor:pointer; font-size:12px;">Equip</button>`;
    else action = `<button onclick="shopBuy('${c.id}')" style="float:right; padding:3px 8px; background:#00ff00; color:black; border:none; cursor:pointer; font-size:12px;">Buy · ${c.cost} P$</button>`;
    html += `<div style="margin:5px 0; padding:6px; background:#333; border-radius:4px;">${c.name} ${action}</div>`;
  });
  html += `</div>`;

  html += `<button onclick="closeShop()" style="width:100%; padding:8px; background:#ff0000; color:white; border:none; cursor:pointer; margin-top:10px;">Close</button>`;
  shopUI.innerHTML = html;
};

function shopBuy(id) {
  playSoundIfNotMuted('purchase');
  if (socket) socket.emit('purchase_cosmetic', { itemId: id });
}
function shopEquip(id) {
  playSoundIfNotMuted('click');
  if (socket) socket.emit('equip_cosmetic', { itemId: id });
}
function shopUpgrade(key) {
  playSoundIfNotMuted('purchase');
  if (socket) socket.emit('purchase_upgrade', { key });
}

window.onPurchaseResult = (result) => {
  if (!result.success) {
    window._shopStatus = '❌ ' + result.error;
    playSoundIfNotMuted('loss');
  } else {
    window._shopStatus = `✅ ${result.item.name} — ${result.note}`;
  }
  if (socket) socket.emit('get_shop'); // re-render with updated state + status
};

window.shopBuy = shopBuy;
window.shopEquip = shopEquip;
window.shopUpgrade = shopUpgrade;
