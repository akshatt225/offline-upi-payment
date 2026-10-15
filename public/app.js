const paymentForm = document.getElementById("paymentForm");
const recipientInput = document.getElementById("recipient");
const amountInput = document.getElementById("amount");
const message = document.getElementById("message");
const transactionsContainer = document.getElementById("transactions");
const balanceDisplay = document.getElementById("balance");
const payButton = document.getElementById("payButton");

const STORAGE_KEY = "offlinepay-demo-transactions";
const INITIAL_BALANCE = 10000;

function readLocalTransactions() {
    try {
        const data = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );

        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveLocalTransactions(transactions) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions)
    );
}

function calculateBalance(transactions) {
    const spent = transactions.reduce((total, transaction) => {
        return total + Number(transaction.amount || 0);
    }, 0);

    return Math.max(0, INITIAL_BALANCE - spent);
}

function formatAmount(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(amount);
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    element.className = className;
    element.textContent = text;

    return element;
}

function renderTransactions(transactions) {
    transactionsContainer.replaceChildren();

    if (transactions.length === 0) {
        transactionsContainer.append(
            createElement(
                "p",
                "empty-state",
                "No demo transactions yet."
            )
        );
    }

    for (const transaction of transactions) {
        const row = document.createElement("div");
        row.className = "transaction";

        const details = document.createElement("div");

        details.append(
            createElement(
                "div",
                "transaction-name",
                transaction.recipient
            )
        );

        const date = new Date(transaction.createdAt);

        details.append(
            createElement(
                "div",
                "transaction-meta",
                Number.isNaN(date.getTime())
                    ? "Date unavailable"
                    : date.toLocaleString()
            )
        );

        details.append(
            createElement(
                "div",
                "transaction-status",
                "SIMULATED — NOT A REAL PAYMENT"
            )
        );

        const amount = createElement(
            "div",
            "transaction-amount",
            `−${formatAmount(Number(transaction.amount))}`
        );

        row.append(details, amount);
        transactionsContainer.append(row);
    }

    balanceDisplay.textContent = formatAmount(
        calculateBalance(transactions)
    );
}

async function loadTransactions() {
    try {
        const response = await fetch("/api/transactions");

        if (!response.ok) {
            throw new Error("Backend unavailable");
        }

        const result = await response.json();

        if (!Array.isArray(result.transactions)) {
            throw new Error("Invalid transaction response");
        }

        saveLocalTransactions(result.transactions);
        renderTransactions(result.transactions);
    } catch {
        renderTransactions(readLocalTransactions());
    }
}

paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const recipient = recipientInput.value.trim();
    const amount = Number(amountInput.value);

    if (recipient.length < 2 || recipient.length > 60) {
        showMessage(
            "Enter a recipient name between 2 and 60 characters.",
            "error"
        );

        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount < 1 ||
        amount > 100000 ||
        Math.round(amount * 100) !== amount * 100
    ) {
        showMessage(
            "Enter a valid amount between ₹1 and ₹100,000.",
            "error"
        );

        return;
    }

    const currentTransactions = readLocalTransactions();
    const currentBalance = calculateBalance(currentTransactions);

    if (amount > currentBalance) {
        showMessage(
            "Insufficient demo wallet balance.",
            "error"
        );

        return;
    }

    payButton.disabled = true;

    try {
        let transaction;

        try {
            const response = await fetch("/api/payments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    recipient,
                    amount
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Payment request failed."
                );
            }

            transaction = result.transaction;
        } catch (error) {
            if (
                error.message &&
                error.message !== "Failed to fetch" &&
                error.name !== "TypeError"
            ) {
                throw error;
            }

            transaction = {
                id: crypto.randomUUID(),
                recipient,
                amount,
                status: "SIMULATED",
                mode: "LOCAL_BROWSER_ONLY",
                createdAt: new Date().toISOString()
            };

            saveLocalTransactions([
                transaction,
                ...currentTransactions
            ]);
        }

        const latestTransactions = readLocalTransactions();

        if (!latestTransactions.some(item => item.id === transaction.id)) {
            saveLocalTransactions([
                transaction,
                ...latestTransactions
            ]);
        }

        await loadTransactions();

        showMessage(
            "Demo payment recorded. No money was transferred.",
            "success"
        );

        paymentForm.reset();
    } catch (error) {
        showMessage(
            error.message || "Unable to record the demo payment.",
            "error"
        );
    } finally {
        payButton.disabled = false;
    }
});

document.getElementById("refreshButton").addEventListener(
    "click",
    loadTransactions
);

document.getElementById("clearButton").addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Clear all local demo transaction history?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch("/api/transactions", {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error("Backend unavailable");
            }

            localStorage.removeItem(STORAGE_KEY);
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }

        showMessage("Demo history cleared.", "success");

        await loadTransactions();
    }
);

loadTransactions();
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
            .catch(error => {
                console.error(
                    "Offline support registration failed:",
                    error
                );
            });
    });
}