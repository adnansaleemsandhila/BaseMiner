const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
// Serve the static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback database load function
function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({}));
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (err) {
        console.error("Database reading error:", err);
        return {};
    }
}

// Database saving function
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Database saving error:", err);
    }
}

// ---------------- GAME BALANCE CONFIGURATION ----------------
const CONFIG = {
    CLICK_VALUE: 1,
    AUTO_MINER_BASE_COST: 15,
    AUTO_MINER_EFFICIENCY: 1, // Gold per second per miner
    COST_MULTIPLIER: 1.15     // Exponential pricing curves
};

// ---------------- API ENDPOINTS ----------------

// 1. Authenticate or Register Player
app.post('/api/auth', (req, pathResponse) => {
    const { username } = req.body;
    if (!username) return pathResponse.status(400).json({ error: "Username required" });

    const db = loadDatabase();
    
    // If user doesn't exist, build a pristine account profile
    if (!db[username]) {
        db[username] = {
            username: username,
            gold: 0,
            autoMiners: 0,
            lastSaveTime: Date.now()
        };
        saveDatabase(db);
    } else {
        // Run passive idle progression logic on login hook
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - db[username].lastSaveTime) / 1000);
        if (elapsedSeconds > 0 && db[username].autoMiners > 0) {
            const dynamicEarnings = elapsedSeconds * db[username].autoMiners * CONFIG.AUTO_MINER_EFFICIENCY;
            db[username].gold += dynamicEarnings;
        }
        db[username].lastSaveTime = now;
        saveDatabase(db);
    }

    pathResponse.json(db[username]);
});

// 2. Verified Click Endpoint (Anti-Cheat Server-Side Math Verification)
app.post('/api/click', (req, pathResponse) => {
    const { username } = req.body;
    const db = loadDatabase();

    if (!db[username]) return pathResponse.status(404).json({ error: "User profile missing" });

    // Process idle income generation since last update timestamp
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - db[username].lastSaveTime) / 1000);
    const passiveGold = elapsedSeconds > 0 ? elapsedSeconds * db[username].autoMiners * CONFIG.AUTO_MINER_EFFICIENCY : 0;

    // Apply the math explicitly on backend hardware
    db[username].gold += CONFIG.CLICK_VALUE + passiveGold;
    db[username].lastSaveTime = now;
    
    saveDatabase(db);
    pathResponse.json(db[username]);
});

// 3. Verified Upgrade Purchase
app.post('/api/upgrade', (req, pathResponse) => {
    const { username } = req.body;
    const db = loadDatabase();

    if (!db[username]) return pathResponse.status(404).json({ error: "User profile missing" });

    // Deduce item cost mathematically using an exponential curve
    const currentMiners = db[username].autoMiners;
    const upgradeCost = Math.floor(CONFIG.AUTO_MINER_BASE_COST * Math.pow(CONFIG.COST_MULTIPLIER, currentMiners));

    // Validate financial solvency before processing ledger
    if (db[username].gold >= upgradeCost) {
        db[username].gold -= upgradeCost;
        db[username].autoMiners += 1;
        db[username].lastSaveTime = Date.now();
        saveDatabase(db);
        pathResponse.json(db[username]);
    } else {
        pathResponse.status(400).json({ error: "Insufficient Gold balance for this transaction." });
    }
});

app.listen(PORT, () => {
    console.log(`Secured clicker engine running live on port ${PORT}`);
});