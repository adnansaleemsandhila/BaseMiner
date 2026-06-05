const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'game.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize and setup the SQLite DB
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) console.error("Database connection failure:", err);
    else console.log("SQLite database linked successfully.");
});

// Create tables if they do not exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY,
        wallet_address TEXT DEFAULT '',
        coins REAL DEFAULT 0,
        multiplier INTEGER DEFAULT 1,
        last_save_time INTEGER DEFAULT 0
    )`);
});

// ---------------- GAME DESIGN CONFIG ----------------
const CONFIG = {
    BASE_UPGRADE_COST: 20,
    COST_MULTIPLIER: 1.5
};

// ---------------- API ENDPOINTS ----------------

// 1. Player Login/Auth Hook
app.post('/api/auth', (req, res) => {
    const { username, walletAddress } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });

    const wallet = walletAddress || '';
    const now = Date.now();

    db.get("SELECT * FROM players WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            // New Registration
            db.run("INSERT INTO players (username, wallet_address, coins, multiplier, last_save_time) VALUES (?, ?, 0, 1, ?)",
                [username, wallet, now], function(insertErr) {
                    if (insertErr) return res.status(500).json({ error: insertErr.message });
                    res.json({ username, wallet_address: wallet, coins: 0, multiplier: 1 });
                });
        } else {
            // Returning user: Optional placeholder update for future Web3 wallet linking
            if (wallet && row.wallet_address !== wallet) {
                db.run("UPDATE players SET wallet_address = ? WHERE username = ?", [wallet, username]);
            }
            res.json(row);
        }
    });
});

// 2. Anti-Cheat Score Click Router
// Keep a temporary memory log of click speeds (clears out constantly)
const clickTrackers = {};

app.post('/api/click', (req, res) => {
    const { username, surgeActive } = req.body;
    const now = Date.now();

    // ---------------- ANTI-CHEAT BOT SECURITY LAYER ----------------
    if (!clickTrackers[username]) {
        clickTrackers[username] = { lastClickTime: now, clickStrikes: 0 };
    }

    const timeSinceLastClick = now - clickTrackers[username].lastClickTime;
    clickTrackers[username].lastClickTime = now;

    // If time between clicks is less than 85 milliseconds, it's physically inhuman speed
    if (timeSinceLastClick < 85) {
        clickTrackers[username].clickStrikes++;
        if (clickTrackers[username].clickStrikes > 5) {
            return res.status(429).json({ error: "BOT DETECTED: Auto-clicker throttling active. Slow down, rebel!" });
        }
    } else {
        // Decay strikes slowly if they click normally
        clickTrackers[username].clickStrikes = Math.max(0, clickTrackers[username].clickStrikes - 1);
    }
    // --------------------------------------------------------------

    db.get("SELECT * FROM players WHERE username = ?", [username], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Player profile not found" });

        const baseReward = 1 * row.multiplier;
        const reward = surgeActive ? (baseReward * 2) : baseReward;
        
        const newCoins = row.coins + reward;

        db.run("UPDATE players SET coins = ?, last_save_time = ? WHERE username = ?", [newCoins, now, username], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ username, coins: newCoins, multiplier: row.multiplier });
        });
    });
});

// 3. Process Multiplier Upgrade Shop Transaction
app.post('/api/upgrade', (req, res) => {
    const { username } = req.body;

    db.get("SELECT * FROM players WHERE username = ?", [username], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Player profile not found" });

        const cost = Math.floor(CONFIG.BASE_UPGRADE_COST * Math.pow(CONFIG.COST_MULTIPLIER, row.multiplier - 1));

        if (row.coins >= cost) {
            const newCoins = row.coins - cost;
            const newMultiplier = row.multiplier + 1;

            db.run("UPDATE players SET coins = ?, multiplier = ? WHERE username = ?", [newCoins, newMultiplier, username], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                res.json({ username, coins: newCoins, multiplier: newMultiplier });
            });
        } else {
            res.status(400).json({ error: "Insufficient coin balance." });
        }
    });
});

// 4. Live Global Leaderboard Endpoint
app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT username, coins, wallet_address FROM players ORDER BY coins DESC LIMIT 5", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Database-backed engine deployed active on port ${PORT}`);
});