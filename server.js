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

// Auto-generates game.db locally on the server if missing
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) console.error("Database initialization error:", err);
    else console.log("SQLite secure data registry online.");
});

// Structural layout for the production ledger (Keyed by Real Wallet Address)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rebels (
        wallet_address TEXT PRIMARY KEY,
        social_handle TEXT DEFAULT '',
        virtual_points REAL DEFAULT 0,
        multiplier INTEGER DEFAULT 1,
        last_click_time INTEGER DEFAULT 0
    )`);
});

const rateLimiterCache = {};

// ---------------- API ENDPOINTS ----------------

// 1. Identity Mapping
app.post('/api/auth', (req, res) => {
    const { walletAddress, socialHandle } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Cryptographic Address required." });

    const cleanWallet = walletAddress.toLowerCase();
    const handle = socialHandle || 'Anonymous Rebel';

    db.get("SELECT * FROM rebels WHERE wallet_address = ?", [cleanWallet], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!row) {
            db.run("INSERT INTO rebels (wallet_address, social_handle, virtual_points, multiplier, last_click_time) VALUES (?, ?, 0, 1, ?)",
                [cleanWallet, handle, Date.now()], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ wallet_address: cleanWallet, social_handle: handle, virtual_points: 0, multiplier: 1 });
                });
        } else {
            res.json(row);
        }
    });
});

// 2. Anti-Cheat Score Processor
app.post('/api/click', (req, res) => {
    const { walletAddress, surgeActive } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Missing identity vector." });
    
    const cleanWallet = walletAddress.toLowerCase();
    const now = Date.now();

    // ---- BOT THROTTLING ENGINE ----
    if (!rateLimiterCache[cleanWallet]) {
        rateLimiterCache[cleanWallet] = { lastClick: now, strikes: 0 };
    }
    const msSinceLastClick = now - rateLimiterCache[cleanWallet].lastClick;
    rateLimiterCache[cleanWallet].lastClick = now;

    if (msSinceLastClick < 85) { 
        rateLimiterCache[cleanWallet].strikes++;
        if (rateLimiterCache[cleanWallet].strikes > 4) {
            return res.status(429).json({ error: "🚨 BOT WARNING: Auto-clicker detected! Anti-cheat lockdown active." });
        }
    } else {
        rateLimiterCache[cleanWallet].strikes = Math.max(0, rateLimiterCache[cleanWallet].strikes - 1);
    }
    // ----------------------------------------

    db.get("SELECT * FROM rebels WHERE wallet_address = ?", [cleanWallet], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Rebel node profile missing." });

        const basePayout = 1 * row.multiplier;
        const reward = surgeActive ? (basePayout * 2) : basePayout;
        const totalPoints = row.virtual_points + reward;

        db.run("UPDATE rebels SET virtual_points = ?, last_click_time = ? WHERE wallet_address = ?", [totalPoints, now, cleanWallet], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ wallet_address: cleanWallet, virtual_points: totalPoints, multiplier: row.multiplier });
        });
    });
});

// 3. Multiplier Level Shop Processor
app.post('/api/upgrade', (req, res) => {
    const { walletAddress } = req.body;
    const cleanWallet = walletAddress.toLowerCase();

    db.get("SELECT * FROM rebels WHERE wallet_address = ?", [cleanWallet], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Profile missing." });

        const cost = Math.floor(20 * Math.pow(1.5, row.multiplier - 1));

        if (row.virtual_points >= cost) {
            const nextPoints = row.virtual_points - cost;
            const nextMult = row.multiplier + 1;

            db.run("UPDATE rebels SET virtual_points = ?, multiplier = ? WHERE wallet_address = ?", [nextPoints, nextMult, cleanWallet], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ wallet_address: cleanWallet, virtual_points: nextPoints, multiplier: nextMult });
            });
        } else {
            res.status(400).json({ error: "Insufficient points." });
        }
    });
});

// 4. Public Top 5 Leaderboard
app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT social_handle, wallet_address, virtual_points FROM rebels ORDER BY virtual_points DESC LIMIT 5", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Secured Network Engine active on port ${PORT}`);
});