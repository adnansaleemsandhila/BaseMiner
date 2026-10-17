# BaseMiner — "Cockroach Resistance: Meme Launchpad"

> **Early standalone demo.** BaseMiner's tap economy now lives inside
> **[LingoForge](https://github.com/adnansaleemsandhila/lingoforge)** — the evolved,
> server-authoritative successor that reuses this game's wallet → points → multiplier →
> Base ERC-20 claim model and 85ms anti-autoclick guard. This repo is kept public as a
> historical artifact and is no longer developed.

A lightweight, browser-based **tap-to-earn meme game built for the Base network** (Ethereum L2).
Players "mine" virtual points by tapping a glowing cockroach, upgrade a mining multiplier, and
compete on a live top-5 leaderboard. Points are intended to be claimed as the **$COCKROACH**
token on Base (claim is a stub — see *Not yet real* below).

- **In-game brand:** Cockroach Resistance: Meme Launchpad
- **Token / ticker:** $COCKROACH
- **Login screen:** "COCKROACH LOGIN"
- **Leaderboard:** "Top 5 Rebels"
- **Repo:** https://github.com/adnansaleemsandhila/BaseMiner (public)

## Stack

- **Node.js** (tested on Node 24) + **Express** + **sqlite3** (`sqlite3` native driver)
- **cors** for cross-origin API access
- Vanilla HTML/CSS/JS single page (`public/index.html`) — no build step, no framework
- SQLite database `game.db`, auto-created on first run

Dependencies (`package.json`): `cors ^2.8.5`, `express ^4.19.2`, `sqlite3 ^5.1.7`.

## Run it

```powershell
npm install
npm start            # runs "node server.js"
```

Then open the printed URL (default **http://localhost:3000**).

- The port is `process.env.PORT || 3000`. To avoid clashing with another local server:
  ```powershell
  $env:PORT=3001; node server.js
  ```
- `game.db` is created automatically next to `server.js` on first request. Delete it to wipe all
  progress and the leaderboard.
- The server logs `Secured Network Engine active on port <PORT>` when ready.

## How to play

1. **Sign in (mock).** On the "COCKROACH LOGIN" overlay, type a rebel handle (e.g. `Ali_CJP`)
   and click **Continue with Google** or **Continue with X / Twitter**. There is no real OAuth —
   the button generates a random `0x…` wallet address client-side and registers it via `/api/auth`.
2. **Tap the cockroach.** Each tap on the glowing roach SVG awards `1 × multiplier` points
   (a laser blip plays; floating text and particles spawn).
3. **System Surge.** After ~18 taps there is a chance (60%) a surge triggers: **2× points for 10
   seconds** (the roach glows pink, a banner flashes).
4. **Upgrade the multiplier.** The "Staking Upgrade" button costs `floor(20 × 1.5^(multiplier - 1))`
   points and adds **+1×** to the multiplier (so every tap earns more).
5. **Leaderboard.** The right-hand panel polls `/api/leaderboard` every 3 seconds and shows the
   **Top 5 Rebels** by total points.
6. **Claim (stub).** "Claim On-Chain $COCKROACH Tokens" is **not wired** — it only shows an alert
   describing the future Web3 flow.

## Economy

| Rule | Value |
|---|---|
| Points per tap | `1 × multiplier` |
| Surge bonus | `×2` for 10s, chance-based after ~18 taps |
| Upgrade cost | `floor(20 × 1.5^(multiplier - 1))` points |
| Upgrade effect | `+1` multiplier |
| Insufficient points | HTTP 400 `Insufficient points.` |
| Anti-autoclick | taps closer than **85ms** add a strike; **>4 strikes → HTTP 429** lockdown |
| Strike decay | one strike removed per tap that respects the 85ms gap |

## HTTP API (`server.js`)

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/auth` | `{ walletAddress, socialHandle }` | the player row (creates it if new) |
| `POST /api/click` | `{ walletAddress, surgeActive }` | `{ wallet_address, virtual_points, multiplier }` (429 on bot lockout) |
| `POST /api/upgrade` | `{ walletAddress }` | `{ wallet_address, virtual_points, multiplier }` (400 if too few points) |
| `GET /api/leaderboard` | — | top 5 rows by `virtual_points` (`social_handle`, `wallet_address`, `virtual_points`) |

Static files are served from `public/`.

## Data model

Single table `rebels` in `game.db`:

| Column | Type | Notes |
|---|---|---|
| `wallet_address` | TEXT PRIMARY KEY | lowercased `0x…` address (mock-generated on the client) |
| `social_handle` | TEXT | player-chosen name |
| `virtual_points` | REAL | unclaimed points |
| `multiplier` | INTEGER | starts at 1 |
| `last_click_time` | INTEGER | epoch ms of the last tap |

The anti-cheat rate-limiter keeps an in-memory `rateLimiterCache` keyed by wallet (not persisted).

## Not yet real (stubs / planned)

- **No real auth.** The SSO buttons and wallet address are simulated client-side.
- **No real token / on-chain claim.** The "Claim On-Chain $COCKROACH Tokens" button is an alert
  only. The intended next step is a real Base mint (e.g. via a wallet-signing provider).
- Not audited for production; the API is CORS-open (`app.use(cors())`).

## License

MIT.
