const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const transactionsFile = path.join(dataDir, "transactions.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(transactionsFile)) {
    fs.writeFileSync(transactionsFile, "[]", "utf8");
}

app.get("/api/health", (req, res) => {
    res.json({
        status: "running",
        message: "Offline UPI demo server is working"
    });
});

app.get("/api/transactions", (req, res) => {
    const transactions = JSON.parse(
        fs.readFileSync(transactionsFile, "utf8")
    );

    res.json(transactions);
});

app.post("/api/payments", (req, res) => {
    const { recipient, amount } = req.body;

    if (
        typeof recipient !== "string" ||
        recipient.trim() === ""
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid recipient."
        });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid amount."
        });
    }

    const transactions = JSON.parse(
        fs.readFileSync(transactionsFile, "utf8")
    );

    const transaction = {
        id: Date.now().toString(),
        recipient: recipient.trim(),
        amount: paymentAmount,
        status: "SIMULATED",
        createdAt: new Date().toISOString()
    };

    transactions.unshift(transaction);

    fs.writeFileSync(
        transactionsFile,
        JSON.stringify(transactions, null, 2),
        "utf8"
    );

    res.status(201).json({
        success: true,
        message: "Demo payment recorded. No real money was transferred.",
        transaction
    });
});

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Demo server running at http://127.0.0.1:${PORT}`);
    console.log("This is a payment simulator, not a real UPI service.");
});