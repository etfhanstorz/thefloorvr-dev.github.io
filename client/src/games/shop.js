// Client-side shop + upgrades.
// Purchases write directly to window.currentPlayer.cosmetics / .upgrades and cloud-save.

const SHOP_ITEMS = [
  // ---- Body colors ----
  { id:'color-crimson',  name:'Crimson',      type:'bodyColor', value:0xcc2233, cost:150 },
  { id:'color-azure',    name:'Azure',        type:'bodyColor', value:0x2266dd, cost:150 },
  { id:'color-violet',   name:'Violet',       type:'bodyColor', value:0x9933cc, cost:150 },
  { id:'color-gold',     name:'Gold',         type:'bodyColor', value:0xffd700, cost:300 },
  { id:'color-neon',     name:'Neon Green',   type:'bodyColor', value:0x00ff88, cost:200 },
  { id:'color-blaze',    name:'Blaze Orange', type:'bodyColor', value:0xff7722, cost:200 },
  { id:'color-cyan',     name:'Cyan',         type:'bodyColor', value:0x00ccff, cost:200 },
  { id:'color-rose',     name:'Rose',         type:'bodyColor', value:0xff66aa, cost:200 },
  { id:'color-lime',     name:'Lime',         type:'bodyColor', value:0xaaff00, cost:250 },
  { id:'color-platinum', name:'Platinum',     type:'bodyColor', value:0xe8e8f0, cost:350 },
  { id:'color-midnight', name:'Midnight',     type:'bodyColor', value:0x0a0a2e, cost:300 },
  { id:'color-cherry',   name:'Cherry',       type:'bodyColor', value:0xff0044, cost:250 },
  // ---- Hats ----
  { id:'hat-crown',    name:'Gold Crown',   type:'hat', value:'gold-crown',  cost:500 },
  { id:'hat-party',    name:'Party Hat',    type:'hat', value:'party-hat',   cost:200 },
  { id:'hat-top',      name:'Top Hat',      type:'hat', value:'top-hat',     cost:750 },
  { id:'hat-cowboy',   name:'Cowboy Hat',   type:'hat', value:'cowboy',      cost:600 },
  { id:'hat-wizard',   name:'Wizard Hat',   type:'hat', value:'wizard',      cost:800 },
  { id:'hat-hardhat',  name:'Hard Hat',     type:'hat', value:'hardhat',     cost:300 },
  { id:'hat-beret',    name:'Beret',        type:'hat', value:'beret',       cost:350 },
  { id:'hat-viking',   name:'Viking Helm',  type:'hat', value:'viking',      cost:900 },
  { id:'hat-halo',     name:'Halo',         type:'hat', value:'halo',        cost:1200 },
  { id:'hat-jester',   name:'Jester Hat',   type:'hat', value:'jester',      cost:650 },
  { id:'hat-crown2',   name:'Diamond Crown',type:'hat', value:'crown-diamond',cost:1500 },
  { id:'hat-cap',      name:'Cap',          type:'hat', value:'cap',         cost:150 },
  { id:'hat-horse',    name:'Mini Horse',   type:'hat', value:'horse',        cost:2500 },
  // ---- Shirts ----
  { id:'shirt-black',  name:'Black Tee',    type:'shirt', value:0x111111, cost:250 },
  { id:'shirt-white',  name:'White Tee',    type:'shirt', value:0xeeeeee, cost:250 },
  { id:'shirt-red',    name:'Red Tee',      type:'shirt', value:0xcc2222, cost:300 },
  { id:'shirt-navy',   name:'Navy Blazer',  type:'shirt', value:0x1a2255, cost:400 },
  { id:'shirt-gold',   name:'Gold Blazer',  type:'shirt', value:0xb8860b, cost:600 },
  { id:'shirt-casino', name:'Casino Red',   type:'shirt', value:0x8b0000, cost:500 },
  { id:'shirt-purple', name:'Purple Fit',   type:'shirt', value:0x5500aa, cost:450 },
  { id:'shirt-teal',   name:'Teal Jacket',  type:'shirt', value:0x007a6a, cost:400 },
  { id:'shirt-pink',   name:'Pink Hoodie',  type:'shirt', value:0xff55aa, cost:350 },
  { id:'shirt-camo',   name:'Camo Jacket',  type:'shirt', value:0x4a5c3a, cost:550 },
  { id:'shirt-vip',    name:'VIP Suit',     type:'shirt', value:0x1a1a2e, cost:800 },
  { id:'shirt-neon',   name:'Neon Hoodie',  type:'shirt', value:0x00ffcc, cost:500 },
];

const UPGRADE_DEFS = [
  { key:'luck',   name:'Lucky Streak',  icon:'🍀', desc:'Reduces house edge',         max:5, costs:[300,600,1200,2500,5000] },
  { key:'payout', name:'Payout Boost',  icon:'💰', desc:'+10% win payout per level',  max:5, costs:[500,1000,2000,4000,8000] },
  { key:'crit',   name:'Critical Win',  icon:'⚡', desc:'+5% chance for 2× bonus',    max:3, costs:[800,2000,5000] },
  { key:'chips',  name:'Chip Overflow', icon:'🎰', desc:'+250 P$ bonus on login',     max:3, costs:[400,1000,2500] },
  { key:'speed',  name:'Quick Draw',    icon:'💨', desc:'Faster game animations',      max:3, costs:[200,500,1200] },
  { key:'streak', name:'Hot Streak',    icon:'🔥', desc:'+15% after 3 wins in a row', max:3, costs:[1000,2500,6000] },
];
window.SHOP_ITEMS = SHOP_ITEMS;
window.UPGRADE_DEFS = UPGRADE_DEFS;

// Apply chips upgrade bonus once per session (run after login)
window.applyLoginBonuses = function () {
  const p = window.currentPlayer; if (!p) return;
  const lvl = (p.upgrades && p.upgrades.chips) || 0;
  if (lvl > 0 && !window._chipsApplied) {
    window._chipsApplied = true;
    p.balance += lvl * 250;
    if (window.sbSavePlayer) window.sbSavePlayer();
    if (window.showToast) showToast(`🎰 Chip Overflow: +${lvl * 250} P$ bonus!`, '#ffd700');
  }
};

// ---- purchase helpers ----

function shopBuyItem(itemId) {
  const p = window.currentPlayer; if (!p) return;
  const item = SHOP_ITEMS.find(i => i.id === itemId); if (!item) return;
  const cos = p.cosmetics || {};
  const owned = cos.owned || [];
  if (owned.includes(itemId)) { shopEquipItem(itemId); return; }
  if (p.balance < item.cost) {
    if (window.showToast) showToast('❌ Not enough P$', '#ff4444');
    if (window.refreshShopVrPanel) window.refreshShopVrPanel();
    return;
  }
  p.balance -= item.cost;
  cos.owned = [...owned, itemId];
  p.cosmetics = cos;
  shopEquipItem(itemId);
}

function shopEquipItem(itemId) {
  const p = window.currentPlayer; if (!p) return;
  const item = SHOP_ITEMS.find(i => i.id === itemId); if (!item) return;
  const cos = p.cosmetics || {};
  if (item.type === 'bodyColor') cos.bodyColor = item.value;
  else if (item.type === 'hat') cos.hat = item.value;
  else if (item.type === 'shirt') cos.shirt = item.value;
  p.cosmetics = cos;
  const av = window.localAvatarRef;
  if (av) {
    if (item.type === 'bodyColor') av.setBodyColor(item.value);
    else if (item.type === 'hat') av.setHat(item.value);
    else if (item.type === 'shirt' && av.setShirt) av.setShirt(item.value);
  }
  if (window.sbSavePlayer) window.sbSavePlayer();
  if (window.showToast) showToast(`✅ ${item.name} equipped!`, '#00ff88');
  if (window.refreshShopVrPanel) window.refreshShopVrPanel();
}

function shopPurchaseUpgrade(key) {
  const p = window.currentPlayer; if (!p) return;
  const def = UPGRADE_DEFS.find(u => u.key === key); if (!def) return;
  const upgrades = p.upgrades || {};
  const lvl = upgrades[key] || 0;
  if (lvl >= def.max) { if (window.showToast) showToast('Already max level!', '#ffd700'); return; }
  const cost = def.costs[lvl];
  if (p.balance < cost) { if (window.showToast) showToast('❌ Not enough P$', '#ff4444'); return; }
  p.balance -= cost; upgrades[key] = lvl + 1; p.upgrades = upgrades;
  if (window.sbSavePlayer) window.sbSavePlayer();
  if (window.showToast) showToast(`⬆️ ${def.name} → Level ${lvl + 1}`, '#ffd700');
  if (window.refreshUpgradeWall) window.refreshUpgradeWall();
}

// ---- DOM shop (desktop fallback) ----
let shopUI = null;
function showShop() {
  if (!shopUI) {
    shopUI = document.createElement('div');
    shopUI.style.cssText = 'position:absolute;bottom:20px;left:760px;width:440px;max-height:540px;background:rgba(0,0,0,0.95);border:2px solid #ff8833;border-radius:10px;padding:15px;color:white;font-family:monospace;z-index:50;display:none;overflow-y:auto';
    document.body.appendChild(shopUI);
  }
  shopUI.style.display = 'block';
  _shopDOM();
}
function closeShop() { if (shopUI) shopUI.style.display = 'none'; }

// Apply a custom hex color (750 P$) to body or shirt
function shopApplyCustomColor(type) {
  const input = document.getElementById('shopCustomHex_' + type);
  if (!input) return;
  let raw = input.value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    if (window.showToast) showToast('Enter a valid 6-digit hex code (e.g. FF3300)', '#ff4444');
    return;
  }
  const hex = parseInt(raw, 16);
  const p = window.currentPlayer; if (!p) return;
  const CUSTOM_COST = 750;
  if (p.balance < CUSTOM_COST) { if (window.showToast) showToast('❌ Not enough P$ (750 needed)', '#ff4444'); return; }
  p.balance -= CUSTOM_COST;
  const cos = p.cosmetics || {};
  if (type === 'bodyColor') cos.bodyColor = hex;
  else if (type === 'shirt') cos.shirt = hex;
  p.cosmetics = cos;
  const av = window.localAvatarRef;
  if (av) {
    if (type === 'bodyColor') av.setBodyColor(hex);
    else if (type === 'shirt' && av.setShirt) av.setShirt(hex);
  }
  if (window.sbSavePlayer) sbSavePlayer();
  if (window.showToast) showToast(`✅ Custom color applied!`, '#00ff88');
  _shopDOM();
}

function _shopDOM() {
  if (!shopUI) return;
  const p = window.currentPlayer, bal = p ? Math.floor(p.balance) : 0;
  const cos = (p && p.cosmetics) || { owned:[] };
  const owned = cos.owned || [];
  let html = `<h3>🛍️ Shop <span style="color:#ffd700;font-size:14px">P$ ${bal}</span></h3>`;
  const groups = { bodyColor:'🎨 Body Color', hat:'🎩 Hats', shirt:'👕 Shirts' };
  for (const [type, label] of Object.entries(groups)) {
    html += `<strong>${label}</strong><div style="margin:6px 0 12px">`;
    SHOP_ITEMS.filter(i => i.type === type).forEach(item => {
      const isOwned = owned.includes(item.id);
      const isEq = (type==='bodyColor'&&cos.bodyColor===item.value)||(type==='hat'&&cos.hat===item.value)||(type==='shirt'&&cos.shirt===item.value);
      const btn = isEq
        ? `<span style="float:right;color:#0f0">✓ On</span>`
        : isOwned
          ? `<button onclick="shopEquipItem('${item.id}')" style="float:right;padding:3px 8px;background:#00aaff;color:white;border:none;cursor:pointer;font-size:12px">Equip</button>`
          : `<button onclick="shopBuyItem('${item.id}')" style="float:right;padding:3px 8px;background:#00ff00;color:black;border:none;cursor:pointer;font-size:12px">Buy·${item.cost}P$</button>`;
      html += `<div style="margin:5px 0;padding:6px;background:#333;border-radius:4px">${item.name} ${btn}</div>`;
    });
    // Custom hex color input for body and shirt types
    if (type === 'bodyColor' || type === 'shirt') {
      html += `<div style="margin:5px 0;padding:8px;background:#222;border:1px solid #555;border-radius:4px;display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:#aaa">Custom hex</span>
        <input id="shopCustomHex_${type}" maxlength="7" placeholder="#FF3300" style="width:90px;padding:4px 6px;background:#111;color:#fff;border:1px solid #888;border-radius:4px;font-family:monospace;font-size:13px" oninput="this.value=this.value.replace(/[^#0-9a-fA-F]/g,'')">
        <button onclick="shopApplyCustomColor('${type}')" style="padding:4px 10px;background:#ff8833;color:#000;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold">Apply · 750P$</button>
      </div>`;
    }
    html += '</div>';
  }
  html += `<button onclick="closeShop()" style="width:100%;padding:8px;background:#ff0000;color:white;border:none;cursor:pointer;margin-top:10px">Close</button>`;
  shopUI.innerHTML = html;
}

// ---- DOM upgrade wall (desktop fallback) ----
let upgradeUI = null;
function showUpgrades() {
  if (!upgradeUI) {
    upgradeUI = document.createElement('div');
    upgradeUI.style.cssText = 'position:absolute;bottom:20px;left:760px;width:480px;max-height:560px;background:rgba(0,0,0,0.95);border:2px solid #7733ff;border-radius:10px;padding:15px;color:white;font-family:monospace;z-index:50;display:none;overflow-y:auto';
    document.body.appendChild(upgradeUI);
  }
  upgradeUI.style.display = 'block';
  _upgradeDOM();
}
function closeUpgrades() { if (upgradeUI) upgradeUI.style.display = 'none'; }

function _upgradeDOM() {
  if (!upgradeUI) return;
  const p = window.currentPlayer, bal = p ? Math.floor(p.balance) : 0;
  const upg = (p && p.upgrades) || {};
  let html = `<h3>⬆️ Upgrades <span style="color:#ffd700;font-size:14px">P$ ${bal}</span></h3>`;
  (window.UPGRADE_DEFS || []).forEach(def => {
    const lvl = upg[def.key] || 0;
    const maxed = lvl >= def.max;
    const cost = maxed ? null : def.costs[lvl];
    const dots = '●'.repeat(lvl) + '○'.repeat(def.max - lvl);
    const btn = maxed
      ? `<span style="float:right;color:#ffd700">MAX ✓</span>`
      : `<button onclick="shopPurchaseUpgrade('${def.key}');_upgradeDOM&&_upgradeDOM()" style="float:right;padding:3px 8px;background:#7733ff;color:white;border:none;cursor:pointer;font-size:12px">Buy·${cost}P$</button>`;
    html += `<div style="margin:6px 0;padding:8px;background:#1a1030;border:1px solid #7733ff;border-radius:6px">
      <strong>${def.icon} ${def.name}</strong> <span style="color:#aaa;font-size:11px">${dots}</span>${btn}
      <div style="font-size:11px;color:#888;margin-top:3px">${def.desc}</div>
    </div>`;
  });
  html += `<button onclick="closeUpgrades()" style="width:100%;padding:8px;background:#ff0000;color:white;border:none;cursor:pointer;margin-top:10px">Close</button>`;
  upgradeUI.innerHTML = html;
}
window._upgradeDOM = _upgradeDOM;
window.showUpgrades = showUpgrades;
window.closeUpgrades = closeUpgrades;

window.shopBuyItem = shopBuyItem;
window.shopEquipItem = shopEquipItem;
window.shopPurchaseUpgrade = shopPurchaseUpgrade;
window.shopApplyCustomColor = shopApplyCustomColor;
window.showShop = showShop;
window.closeShop = closeShop;
