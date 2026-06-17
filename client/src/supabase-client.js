// Supabase: real accounts + cloud saves. Runs entirely in the browser with the
// publishable key (safe — Row Level Security protects every row). Username/password
// auth is done via a synthetic email <username>@floorvr.app so we keep the
// username UX while Supabase handles hashing + uniqueness.
//
// If Supabase fails to load/configure, the game falls back to localStorage accounts.

const SUPABASE_URL = 'https://cegzhgqotdjimiedzgqk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-sSL2MjQ9sHMuOHHQ3AMqQ_m_qpAZUc';

let sb = null;
window.sbActive = false;

(function initSupabase() {
  try {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('✓ Supabase client ready');
    } else {
      console.warn('Supabase library not loaded — using localStorage accounts');
    }
  } catch (e) {
    console.error('Supabase init failed:', e);
  }
})();

// Supabase validates the email domain, so we base the synthetic address on a real
// domain (gmail) with a floorvr. prefix. No email is ever sent (confirmations off);
// this is purely an internal unique key derived from the username.
function emailFor(username) {
  const u = username.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^[.]+|[.]+$/g, '');
  return 'floorvr.' + u + '@gmail.com';
}

function loginError(msg) {
  const el = document.getElementById('loginError');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function setLoginBusy(busy) {
  ['btnLogin', 'btnRegister'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.disabled = busy; b.style.opacity = busy ? '0.6' : '1'; }
  });
}

function authMessage(err, mode) {
  const m = (err && err.message) || 'Something went wrong';
  if (/already registered/i.test(m)) return 'That username is taken — try Login instead.';
  if (/invalid login credentials/i.test(m)) return 'Wrong username or password.';
  if (/at least 6/i.test(m)) return 'Password must be at least 6 characters.';
  return m;
}

// main entry called by the login/register buttons
async function handleAuth(mode) {
  const username = (document.getElementById('username').value || '').trim();
  const password = document.getElementById('password').value || '';
  loginError('');
  if (!username || !password) { loginError('Enter a username and password.'); return; }
  if (localStorage.getItem('floorVrBanned') === 'true') { loginError('You are banned.'); return; }

  // no Supabase -> local-only fallback (old behaviour)
  if (!sb) { localEnter(username); return; }

  setLoginBusy(true);
  try {
    const email = emailFor(username);
    if (mode === 'register') {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      const uid = data.user && data.user.id;
      if (uid) {
        const ins = await sb.from('players').insert({ id: uid, username });
        if (ins.error && ins.error.code !== '23505') throw ins.error; // ignore "already exists"
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await loadPlayerFromSupabase(username);
    enterGame(username);
  } catch (e) {
    console.error('Auth error:', e);
    loginError(authMessage(e, mode));
  } finally {
    setLoginBusy(false);
  }
}

async function loadPlayerFromSupabase(username) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('No session');

  let { data, error } = await sb.from('players').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;

  if (!data) {
    // first time: create the row
    const def = { id: user.id, username };
    const r = await sb.from('players').insert(def).select('*').single();
    if (r.error) throw r.error;
    data = r.data;
  }

  window.currentPlayer = {
    username: data.username,
    balance: data.balance,
    c_balance: data.c_balance || 0,
    time_played: data.time_played || 0,
    is_admin: !!data.is_admin,
    cosmetics: data.cosmetics || { bodyColor: null, hat: null, owned: [] },
    upgrades: data.upgrades || { luck: 0, payout: 0, crit: 0 },
    stats: data.stats || { gamesPlayed: 0, totalWins: 0, totalLosses: 0 },
    inventory: [],
  };
  window.sbActive = true;
}

// ---- leaderboard / admin reads (public-read RLS) ----
async function sbFetchLeaderboard(column, limit) {
  if (!sb) return [];
  const { data, error } = await sb.from('players')
    .select('username, balance, c_balance, time_played')
    .order(column, { ascending: false })
    .limit(limit || 15);
  if (error) { console.error('leaderboard fetch:', error); return []; }
  return data || [];
}

async function sbFetchAllPlayers() {
  if (!sb) return [];
  const { data, error } = await sb.from('players')
    .select('username, balance, c_balance, time_played, is_admin, updated_at')
    .order('balance', { ascending: false });
  if (error) { console.error('admin fetch:', error); return []; }
  return data || [];
}
window.sbFetchLeaderboard = sbFetchLeaderboard;
window.sbFetchAllPlayers = sbFetchAllPlayers;

// debounced cloud save (called by player-data.savePlayerData)
let _sbSaveTimer = null;
function sbSavePlayer() {
  if (!sb || !window.sbActive) return;
  clearTimeout(_sbSaveTimer);
  _sbSaveTimer = setTimeout(async () => {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const p = window.currentPlayer;
      await sb.from('players').update({
        balance: Math.floor(p.balance),
        c_balance: Math.floor(p.c_balance || 0),
        time_played: Math.floor(p.time_played || 0),
        cosmetics: p.cosmetics,
        upgrades: p.upgrades,
        stats: p.stats,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    } catch (e) { console.error('Cloud save failed:', e); }
  }, 1500);
}

function enterGame(username) {
  window.currentUsername = username;
  window.currentPlayerId = 'local-' + username;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');
  // reveal the admin console button for admins
  const ab = document.getElementById('adminBtn');
  if (ab) ab.style.display = (window.currentPlayer && window.currentPlayer.is_admin) ? '' : 'none';
  if (window.initializeGame) window.initializeGame();
  setTimeout(() => window.initGameScene && window.initGameScene(), 100);
}

// localStorage-only fallback (when Supabase isn't available)
function localEnter(username) {
  window.currentUsername = username;
  window.currentPlayerId = 'local-' + username;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');
  if (window.initializeGame) window.initializeGame();
  setTimeout(() => window.initGameScene && window.initGameScene(), 100);
}

window.handleAuth = handleAuth;
window.sbSavePlayer = sbSavePlayer;
