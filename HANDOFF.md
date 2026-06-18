# The Floor VR — Session Handoff (read this first)

You are resuming an in-progress project. This file is the full context to continue
seamlessly. Also check the auto-memory at
`C:\Users\ethan\.claude\projects\C--Users-ethan-OneDrive-Desktop-The-Floor-VR\memory\`
(MEMORY.md + notes) — on the same machine it loads automatically.

## What this is
**The Floor VR** — a multiplayer WebXR casino game. **VR is the product; the flat PC
view is a dev-only window.** Free-play currency **P$** (no real money). Repo:
`etfhanstorz/thefloorvr-dev.github.io`. Live at
https://etfhanstorz.github.io/thefloorvr-dev.github.io/ . Owner/dev: Ethan (Discord
owner id 1004915705210208386). Target: **v1.0.0 on June 27, 2026**.

## Architecture (FULLY SERVERLESS — no backend server)
- **Client**: static files in `client/`, hosted on **GitHub Pages**. Plain `<script>`
  tags, **NO build step**. Three.js **r128** (global build via CDN, NOT ES modules).
- **Multiplayer**: **PeerJS P2P**. Rooms are `thefloorvr-v1-aN`; the room **host's peer
  id IS the room id** — joiners try to claim it (success=become host, "unavailable-id"
  =join as client). Host relays in a star topology, 5 players/room. **Admins auto-host**
  (a non-admin host steps down when an admin joins; migration prefers admins). Host =
  the **poker dealer/authority**.
- **Discord admin + remote logs**: public **MQTT** broker
  `wss://broker.hivemq.com:8884/mqtt`. Topics: `thefloorvr/admin-events` (bot→clients),
  `thefloorvr/wipe-window` (retained, account-reset windows), `thefloorvr/logs`
  (clients forward console logs; admins subscribe).
- **Accounts + cloud saves**: **Supabase** (browser client + Row Level Security).
  Project `https://cegzhgqotdjimiedzgqk.supabase.co`. See "Supabase" below.
- **Offline fallback**: localStorage (used when not signed in / Supabase down).

## Deploy + conventions (IMPORTANT — follow every change)
1. Edit files in `client/src/...`.
2. **Bump the cache-buster**: every script tag in `client/index.html` is `?v=N`. After
   editing client JS, do `sed -i 's/?v=OLD/?v=NEW/g' client/index.html` (currently N=34).
   GitHub Pages caches hard; without bumping, users get stale JS.
3. `git add` + commit + `git push origin main`. A GitHub Actions workflow
   (`.github/workflows/deploy-pages.yml`) auto-deploys to Pages on push (~2 min).
4. Commit message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
5. **Devlog (default workflow, do it after each fix/update)**: append a dated entry to
   `full v1.0.0 release to-do/devlogs (update every fix or update).txt` (newest first,
   tags `[update]/[fix]/[milestone]`), then run `node "tools/send-devlog.js"` to post it
   to Discord (idempotent — it edits/replaces prior messages). Version banner comes from
   `full v1.0.0 release to-do/version.txt` (currently `0.5.0`).
6. Syntax-check JS before committing: `node -e "new Function(require('fs').readFileSync('FILE','utf8'))"`.

## Client file map (`client/src/`)
- `main.js` — Three.js scene, render loop, **player rig** (camera in a movable group),
  desktop first-person movement (mouse-look + WASD + sprint) & VR thumbstick locomotion
  + snap-turn, HUD (P$ balance w/ pulse, toasts via `window.showToast`), VR controller
  setup (real models via XRControllerModelFactory + laser, trigger raycasts game stands),
  `buildGameStations()`, `initGameScene()`, `enforcePcGate()`, dev third-person (key C).
- `floor.js` — environment. **`window.FLOOR_ZONES`** = single source of truth for the
  multi-room layout (central boulevard, lobby spawn at west, rooms off each side).
- `decor.js` — furniture + animated "life" (sparkles, marquee, disco orb, idle wheel);
  per-frame via `window.sceneUpdaters`.
- `player-avatar.js` — avatar (cylinder body + sphere head + nametag), `setBodyColor`,
  `setHat`, `applyCosmetics`.
- `player-data.js` — `window.currentPlayer`, localStorage save/load, time_played ticker,
  cosmetics/upgrades helpers, balance clamp >=0, `wipeLocalAccount`.
- `supabase-client.js` — auth (handleAuth signup/login), cloud load/save, leaderboard +
  admin fetches. See Supabase section.
- `peerjs-client.js` — all P2P (rooms, host/client, migration, admin-host, state sync,
  poker transport helpers `pokerBroadcast/pokerToHost/pokerToPeer`).
- `mqtt-client.js` — admin events, wipe-window, remote-log publish/collect.
- `remote-console.js` — patches console.* to forward logs over MQTT.
- `socket-client.js` — `initializeGame()`, the `window.socket` shim, and the client-side
  game sims for blackjack/plinko/wheel + shop catalog/purchases (upgrade-aware).
- `leaderboard.js` — 🏆 leaderboard (Time/P$/C$ tabs) + 🛡️ admin console (Players tab +
  live Console tab of everyone's logs). Admin button shows only if `is_admin`.
- `games/blackjack.js, plinko.js, wheel.js, shop.js` — DOM overlay game UIs (single-player
  sims in socket-client.js).
- `games/poker.js` — **multiplayer 5-Card Draw** (host-authoritative). DONE: ante, deal,
  two betting rounds (check/bet/call/raise/fold, rotating dealer, raise cap 3, 45s
  auto-fold, fold-to-win), simultaneous draw, showdown, pot payout. Host logs deal/draw/
  showdown to console.
- `vr-games.js` — 3D game station meshes (blackjack table, plinko cabinet, wheel, shop).
- `vr-ui.js` — in-VR controller-clickable bet panels on the stations.
- `audio.js` (synth SFX + mute), `voice.js` (Agora proximity voice, not yet verified on Quest).

## Supabase (accounts + cloud saves) — LIVE
- URL `https://cegzhgqotdjimiedzgqk.supabase.co`; **publishable** key is embedded in
  `supabase-client.js` (safe with RLS). NEVER put the secret key in client/repo.
- Auth: username/password via a **synthetic email** `floorvr.<username>@gmail.com`
  (Supabase rejects made-up domains; must be a real mail domain). **Email confirmation
  must stay OFF** (Auth→Providers→Email) or signups hit "email rate limit exceeded".
- `players` table: id, username(unique), balance, c_balance, time_played, is_admin,
  pc_able, cosmetics(jsonb), upgrades(jsonb), stats(jsonb), updated_at.
- RLS: public read (leaderboard); insert/update own only; UPDATE on (is_admin, pc_able)
  REVOKED from anon/authenticated — set those in the Table Editor only.
- `is_admin=true` → 🛡️ admin console + auto-host + can see everyone's logs.
  `pc_able=true` → may use flat PC mode (else gated to VR; admins/offline exempt).
- Full schema SQL lives in chat history / the memory note `supabase-accounts.md`.
- Free project **pauses after ~1 week idle** — unpause in dashboard.

## Discord bot (`bot/`) — optional, run locally
- Needs `bot/.env` (GITIGNORED, NOT in repo — must be recreated on this/new machine):
  `DISCORD_TOKEN=...`, `OWNER_ID=1004915705210208386`, `GUILD_ID=1512845726198005760`
  (guild id makes slash commands instant; leave MQTT_URL unset → HiveMQ default).
- Run: `cd bot && NODE_TLS_REJECT_UNAUTHORIZED=0 node index.js` (the TLS flag is needed —
  this machine's root CAs don't verify the MQTT/Discord chain; the devlog sender uses
  `rejectUnauthorized:false` for the same reason).
- `npm install` in `bot/` if `node_modules` missing.
- Commands: /tokens /luckboost /event /announce /listplayers /editplayer /shutdown
  /devmode /currentstatus /resetdatabase(confirm,from,to). Publishes to MQTT; clients react.
- The bot stops when the process dies — restart when admin commands are needed.

## Current status (as of this handoff)
- Cache version **v=34**; devlog banner version **0.5.0**.
- DONE recently: Supabase accounts/cloud saves, leaderboard, admin console + live remote
  logs, pc_able gate, admin-auto-host, **multiplayer poker (Stages 1+2)**, negative-balance
  fix, login screen polish, multi-room floor, decor/"life" pass, sign auto-shrink fix.
- Everything is committed and pushed to `origin/main`.

## Remaining for v1.0.0 (June 27)
- Verify **voice chat** (Agora proximity) on Quest 3.
- Full **playtest** on Quest 3 + bug buffer.
- **README / how-to-play / share link**.

## Future content (user's plan)
- Poker = 0.9.0 beta content (now built). **Slots = 1.1.0**. **Token Exchange = 1.1.5**.
- Wishlist: better avatar/controller models, single-player option, save slots, poker
  Stage 3 (VR table seats, all-in/side-pots, animations).

## Gotchas / lessons learned
- **Always bump `?v=N`** or GitHub Pages serves stale JS (caused hours of "fixed but not
  updating" confusion early on).
- Three.js **r128**: no `CapsuleGeometry` (use CylinderGeometry); `MeshBasicMaterial` has
  no `emissive` (use MeshStandard for glow, or canvas/Basic for signs).
- MQTT: emqx public broker rejected clients ("Not authorized") → switched to **HiveMQ**.
- Browser writes its own balance (RLS allows own-row), so it's **not cheat-proof** —
  acceptable for free-play; Edge Functions would harden it later.
- Stray untracked `_site/` and `src/` at repo root are leftovers — ignore.
- To run the client locally: `cd client && npx serve -l 8000` (P2P/MQTT/Supabase still work).
