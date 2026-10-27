---
name: baseminer
description: Use for ANY question about BaseMiner — "Cockroach Resistance: Meme Launchpad," a Base Network tap-to-earn clicker game that is Adnan Saleem Sandhila's own product, now archived/superseded (active development moved to LingoForge). Covers both the business/status side (what it is, why it's archived, what's faux vs real) and the coding side (Express/sqlite3 server, the 85ms anti-autoclick guard, the API). For the living, actively-developed version of this game concept, use the `lingoforge` skill instead. Keywords: BaseMiner, Cockroach Resistance, $COCKROACH, Base Network, tap-to-earn, clicker, anti-autoclick, LingoForge ancestor, archived, superseded, base-pelican-clicker-db.
---

# BaseMiner — orientation (coding + business)

**BaseMiner** is one of Adnan Saleem Sandhila's own products — a small, public, **archived**
repository: a browser tap-to-earn clicker game built for the Base network (an Ethereum L2), in-game
branded **"Cockroach Resistance: Meme Launchpad."** It is **LingoForge's direct ancestor** — on
2026-10-17 its entire tap/points economy was ported into LingoForge as that game's "mining rig"
feature, and **no further development happens in this repo**. BaseMiner itself was never deleted or
folded into LingoForge as a repo — it stays public on GitHub exactly as a historical artifact, with
its own README pointing readers to LingoForge. This file orients any agent on BaseMiner specifically,
as the standalone piece it still is; for the actively-developed, server-authoritative version of this
same game concept, read the **`lingoforge`** skill instead (in the LingoForge repo and the shared
brain) — that is where real work on this idea happens now.

---

## Part 1 — Business & status

### Status: archived, public, not developed further
The repo's own README states this explicitly at the top: *"Early standalone demo... This repo is
kept public as a historical artifact and is no longer developed."* The vault's decision record
(`Repos/BaseMiner/Decisions/Archived in favour of LingoForge.md`, 2026-10-17) confirms the same:
BaseMiner "stays public as a historical artifact... No further development — new work on mining goes
into LingoForge Economy." Not deployed anywhere — it only ever runs locally (`npm start` →
`http://localhost:3000`).

### Brand facts — "Cockroach" and "BaseMiner" are the same project
- In-game brand: **Cockroach Resistance: Meme Launchpad**. Token/ticker shown in the UI: **$COCKROACH**.
- Login screen: "COCKROACH LOGIN." Leaderboard panel: "Top 5 Rebels." Tap target: a glowing cockroach
  SVG the player clicks to "mine."
- `package.json`'s internal name is `base-pelican-clicker-db`, author field `"Future Web3
  Billionaire"` — a placeholder/joke string, not a real claim about anyone's wealth or a company name.
- There is **no separate "Cockroach" repo or project** — don't ever treat the two names as different
  things; they're the same codebase.

### Nothing on-chain is real — verified directly from the code
The README says plainly under "Not yet real": no real auth (the Google/X sign-in buttons are fake —
clicking either just generates a random `0x…` string client-side and registers it, no OAuth happens),
and **no real token or on-chain claim** — the "Claim On-Chain $COCKROACH Tokens" button only shows a
JavaScript `alert()` describing a hypothetical future flow; nothing calls out to Base, no wallet
signing happens, no transaction is ever sent. **Confirmed directly in `server.js`**: there is no
blockchain library, no RPC client, no contract address, and no mint/claim endpoint anywhere in the
code — the entire "Web3" surface is UI only. There is no real money, no real token, and no real wallet
anywhere in this project, full stop.

### Relationship to LingoForge and BeastBrawl
BaseMiner → LingoForge is a direct lineage, not just inspiration: LingoForge's "mining rig" reuses the
exact same wallet → points → multiplier → claim model and the same 85ms anti-autoclick guard (see
Part 3) as a second earn mode alongside its card-battler duels — see the `lingoforge` skill's "The
mining rig (ex-BaseMiner)" section for the current, server-authoritative version of this same idea.
**BeastBrawl** ("A Game built for Ronin Network," a separate private repo) is a sibling in the same
one-game-per-chain pattern as BaseMiner — a different, unrelated codebase on a different chain; it
gets its own skill separately, not covered here.

### Monetization
None, and none was ever built — the claim button is explicitly a stub, confirmed above. There is no
monetization question to answer for this project; it demonstrates a game-economy *pattern*, not a
live or planned revenue source.

---

## Part 2 — Architecture

### Stack (small, single-purpose — this is a demo-sized codebase, not production infrastructure)
| Layer | What |
|---|---|
| Server | Node.js (tested on Node 24) + Express — `server.js`, ~130 lines, all server logic in one file |
| Database | SQLite via the **native `sqlite3` driver** (needs a native build toolchain on some machines — unlike LingoForge, which later switched to Node's built-in `node:sqlite` specifically to avoid this) — `game.db`, auto-created on first run, gitignored |
| Frontend | Vanilla HTML/CSS/JS, one page (`public/index.html`, ~289 lines per the vault note) — no framework, no build step |
| CORS | Fully open (`app.use(cors())`) — any origin can call the API; a documented, accepted weakness for an archived demo, not something to "fix" |
| CI | None — no `.github/workflows/` exists in this repo |

### Data model
One table, `rebels`, in `game.db`:
| Column | Type | Notes |
|---|---|---|
| `wallet_address` | TEXT PRIMARY KEY | lowercased `0x…` string — generated client-side, not a real wallet |
| `social_handle` | TEXT | player-chosen display name |
| `virtual_points` | REAL | unclaimed points |
| `multiplier` | INTEGER | starts at 1 |
| `last_click_time` | INTEGER | epoch ms of last tap |

### API (`server.js`)
| Route | Body | Does |
|---|---|---|
| `POST /api/auth` | `{ walletAddress, socialHandle }` | creates or returns the player row |
| `POST /api/click` | `{ walletAddress, surgeActive }` | awards `1 × multiplier` points (×2 if `surgeActive`); 429 after >4 fast-tap strikes |
| `POST /api/upgrade` | `{ walletAddress }` | pays `floor(20 × 1.5^(multiplier-1))` points, multiplier +1; 400 if insufficient |
| `GET /api/leaderboard` | — | top 5 rows by `virtual_points` |

---

## Part 3 — Deep mechanics

### The economy
Each tap on the cockroach awards `1 × multiplier` points. After roughly 18 taps there's a 60% chance
of a "System Surge" — 2× points for 10 seconds (the roach glows pink, a banner flashes). The
"Staking Upgrade" shop costs `floor(20 × 1.5^(multiplier-1))` points per level and adds `+1` to the
multiplier. This exact cost curve and reward model is what LingoForge's mining rig reuses verbatim.

### The 85ms anti-autoclick guard — the piece with the longest lineage
`POST /api/click` keeps an **in-memory** `rateLimiterCache` keyed by wallet address: any two taps
less than 85ms apart adds a "strike," any tap respecting the gap removes one, and more than 4 strikes
triggers a 429 "Auto-clicker detected" lockout. This specific `85` constant (`MIN_CLICK_GAP_MS` in
spirit) is the single piece of BaseMiner that traveled furthest — it's reused essentially unchanged
in LingoForge's own click-throttle, shared there across both duel-casting and mining. The cache is
**not persisted** — a server restart or a new wallet address resets all strikes to zero.

### Why this stayed a demo — real, documented weaknesses (not worth fixing, since it's archived)
From the vault's `BaseMiner Gotchas.md`, confirmed against the code:
1. **The client decides the surge** — `/api/click` trusts a `surgeActive` boolean sent by the
   browser itself; a modified client could send `true` on every request for a permanent 2×.
   (LingoForge's whole design principle — the server, never the client, judges correctness — exists
   specifically because of lessons like this one.)
2. **No identity check anywhere** — any request can act as any `walletAddress`, including spending
   another player's points via `/api/upgrade`. There's no auth token, no session, nothing binding a
   request to the wallet it claims to be.
3. **The mock wallet is random per page load** — refreshing the browser generates a new address and
   loses all progress; there's no real persistence of "who you are" across visits.
4. **`/api/upgrade` called without `walletAddress` throws** (`undefined.toLowerCase()`) and returns a
   500 instead of a clean 400 — a real, reproducible bug, just never worth fixing on an archived repo.
5. **CORS is fully open** and the native `sqlite3` driver needs a build toolchain on some machines —
   both are accepted tradeoffs for a small public demo, not oversights to flag as urgent.
6. **Public repo — never add real keys, RPC URLs, or a real token contract address here**, even
   though nothing currently touches the blockchain; if this repo is ever revived with a real claim
   path, that's exactly the kind of secret that must never land in a public repo's source.

None of this is "worth fixing while archived" (the vault's own words) — it's recorded in case the
repo is ever revived, not as an active backlog.

---

## Where to go deeper

- **This repo's own `README.md`** — the complete play guide, economy table, and API reference; short
  enough to read in full, and the single most authoritative source for exact current behavior.
- **The `lingoforge` skill** (in the LingoForge repo's `.claude/skills/lingoforge/` and the shared
  brain's `brain/shared/skills/lingoforge/`) — for the actively-developed, server-authoritative
  version of this same tap-to-earn idea, now folded into LingoForge's broader card-battler economy.
  Read that skill, not this one, for anything about where real development on this concept happens.
- **The vault code-brain**, `Second Brain/Repos/BaseMiner/`: `BaseMiner Overview.md`,
  `BaseMiner Server and API.md`, `BaseMiner Frontend.md`, `BaseMiner Gotchas.md`, and
  `Decisions/Archived in favour of LingoForge.md` (the settled decision record) — all last updated
  2026-10-18, consistent with this skill as of its own compile date.
- **`Second Brain/Projects/BaseMiner.md`** — a short product-level summary note.

## This file lives in two places — keep both in sync

Same convention as SayFlick/LingoForge/WahYarWah: this file is committed **here**, in BaseMiner's own
repo (`.claude/skills/baseminer/SKILL.md`), and **also** synced to the cross-agent shared-knowledge
repo, `hermes-with-general-agents`, at `brain/shared/skills/baseminer/SKILL.md`. Since this repo is
archived, this file should need very little future maintenance — but if the repo is ever genuinely
revived, update both copies in the same session, same as any other project skill.

---
*Comprehensive orientation file — distilled from this repo's own `README.md` and `server.js` (read in
full), `package.json`, the vault's full `Repos/BaseMiner/` code-brain, the `Archived in favour of
LingoForge` decision record, and `Projects/BaseMiner.md`. All factual claims about the faux claim
button, the auth stub, and the economy formulas were verified directly against the current source
code, not assumed from older notes. Last compiled: 2026-10-27. This repo is archived and moves slowly
by design — unlike the other skills built this session, there is little reason to expect this file to
go stale quickly, but re-verify against the repo's own README if anything seems inconsistent.*
