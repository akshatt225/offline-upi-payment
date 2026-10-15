const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readTransactions() {
    try {
        const data = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(data);

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeTransactions(transactions) {
    const temporaryFile = `${DATA_FILE}.tmp`;

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(transactions, null, 2),
        "utf8"
    );

    fs.renameSync(temporaryFile, DATA_FILE);
}

function validateAmount(amount) {
    return (
        typeof amount === "number" &&
        Number.isFinite(amount) &&
        amount >= 1 &&
        amount <= 100000 &&
        Math.round(amount * 100) === amount * 100
    );
}

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        mode: "SIMULATION_ONLY"
    });
});

// Transaction history
app.get("/api/transactions", (req, res) => {
    const transactions = readTransactions();

    res.json({
        mode: "SIMULATION_ONLY",
        transactions
    });
});

// Create a simulated payment
app.post("/api/payments", (req, res) => {
    const { recipient, amount } = req.body;

    if (
        typeof recipient !== "string" ||
        recipient.trim().length < 2 ||
        recipient.trim().length > 60
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid recipient name."
        });
    }

    if (!validateAmount(amount)) {
        return res.status(400).json({
            success: false,
            message: "Amount must be between ₹1 and ₹100,000."
        });
    }

    const transactions = readTransactions();

    const transaction = {
        id: crypto.randomUUID(),
        recipient: recipient.trim(),
        amount: Number(amount.toFixed(2)),
        status: "SIMULATED",
        mode: "DEMO_ONLY",
        createdAt: new Date().toISOString()
    };

    transactions.unshift(transaction);

    try {
        writeTransactions(transactions);
    } catch {
        return res.status(500).json({
            success: false,
            message: "Unable to save the demo transaction."
        });
    }

    res.status(201).json({
        success: true,
        message: "Demo payment recorded. No money was transferred.",
        transaction
    });
});

// Clear simulated history
app.delete("/api/transactions", (req, res) => {
    try {
        writeTransactions([]);

        res.json({
            success: true,
            message: "Demo transaction history cleared."
        });
    } catch {
        res.status(500).json({
            success: false,
            message: "Unable to clear history."
        });
    }
});

// Send a clear response for unknown API endpoints
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Demo app running at http://127.0.0.1:${PORT}`);
    console.log("SIMULATION ONLY: No real UPI payments are processed.");
});