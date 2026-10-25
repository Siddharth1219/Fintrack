const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const authenticateUser = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token =
      authHeader.split("Bearer ")[1];

    const decodedToken =
      await getAuth().verifyIdToken(token);

    req.user = decodedToken;

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};
// ==========================================
// FINTRACK - BACKEND SERVER
// ==========================================

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

if (getApps().length === 0) {
    const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        initializeApp({
            credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
    } else if (fs.existsSync(serviceAccountPath)) {
        initializeApp({
            credential: cert(require(serviceAccountPath))
        });
    } else {
        console.error("Firebase service account is not configured.");
    }
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use("/api", authenticateUser, resolveAccount);

// ==========================================
// MYSQL DATABASE CONNECTION
// ==========================================

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "fintrack",
    port: process.env.DB_PORT || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function resolveAccount(req, res, next) {
    try {
        const firebaseUid = req.user.uid;
        const email = req.user.email || `${firebaseUid}@firebase.local`;
        const name = req.user.name || email.split("@")[0] || "FinTrack user";

        const [existing] = await db.query(
            "SELECT id FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1",
            [firebaseUid, email]
        );

        if (existing.length > 0) {
            req.accountId = existing[0].id;
            await db.query(
                "UPDATE users SET firebase_uid = ?, email = ? WHERE id = ?",
                [firebaseUid, email, req.accountId]
            );
        } else {
            const [created] = await db.query(
                `INSERT INTO users (name, email, password, firebase_uid)
                 VALUES (?, ?, ?, ?)`,
                [name, email, "firebase-authenticated", firebaseUid]
            );
            req.accountId = created.insertId;
        }

        next();
    } catch (error) {
        console.error("Account resolution error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not resolve your FinTrack account."
        });
    }
}

// ==========================================
// TEST DATABASE CONNECTION
// ==========================================

async function testDatabase() {
    try {
        const [photoColumn] = await db.query(
            `SELECT 1
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'photo_url'`
        );
        if (photoColumn.length === 0) {
            try {
                await db.query("ALTER TABLE users ADD COLUMN photo_url VARCHAR(2048) NULL");
            } catch (error) {
                if (error.code !== "ER_DUP_FIELDNAME") {
                    throw error;
                }
            }
        }
        const connection = await db.getConnection();

        console.log("✅ MySQL connected successfully");

        connection.release();
    } catch (error) {
        console.error("❌ MySQL connection failed:");
        console.error(error.message);
    }
}

testDatabase();

app.get("/api/profile", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, email, photo_url, firebase_uid FROM users WHERE id = ?",
            [req.accountId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Profile load error:", error.message);
        res.status(500).json({ success: false, message: "Could not load profile" });
    }
});

app.put("/api/profile", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const photoUrl = String(req.body.photoUrl || "").trim();
        if (!name || name.length > 100) {
            return res.status(400).json({ success: false, message: "Profile name must be between 1 and 100 characters." });
        }
        if (photoUrl.length > 2048) {
            return res.status(400).json({ success: false, message: "Profile photo URL is too long." });
        }
        await db.query(
            "UPDATE users SET name = ?, photo_url = ? WHERE id = ?",
            [name, photoUrl || null, req.accountId]
        );
        res.json({ success: true, message: "Profile saved successfully", data: { name, photoUrl } });
    } catch (error) {
        console.error("Profile save error:", error.message);
        res.status(500).json({ success: false, message: "Could not save profile" });
    }
});

// ==========================================
// BASIC TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "FinTrack backend is running"
    });
});

// ==========================================
// DATABASE TEST ROUTE
// ==========================================

app.get("/api/db-test", async (req, res) => {
    try {
        const [result] = await db.query("SELECT 1 AS test");

        res.json({
            success: true,
            message: "MySQL connection is working",
            result
        });

    } catch (error) {
        console.error("Database test error:", error);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed",
            error: error.message
        });
    }
});

// ==========================================
// GET ALL TRANSACTIONS
// ==========================================

app.get("/api/transactions", async (req, res) => {
    try {

        const [transactions] = await db.query(`
            SELECT
                id,
                user_id,
                type,
                amount,
                category,
                description,
                transaction_date,
                created_at
            FROM transactions
            WHERE user_id = ?
            ORDER BY transaction_date DESC, id DESC
        `, [req.accountId]);

        res.json({
            success: true,
            data: transactions
        });

    } catch (error) {

        console.error("Error loading transactions:", error);

        res.status(500).json({
            success: false,
            message: "Could not load transactions",
            error: error.message
        });
    }
});

// ==========================================
// ADD TRANSACTION
// ==========================================

app.post("/api/transactions", async (req, res) => {

    try {

        const {
            user_id,
            type,
            amount,
            category,
            description,
            transaction_date
        } = req.body;

        // ------------------------------
        // VALIDATION
        // ------------------------------

        if (!type || !Number.isFinite(Number(amount)) || Number(amount) <= 0 ||
            !category?.trim() || !description?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)) {

            return res.status(400).json({
                success: false,
                message: "All transaction fields are required"
            });
        }

        // ------------------------------
        // CHECK TRANSACTION TYPE
        // ------------------------------

        if (type !== "income" && type !== "expense") {

            return res.status(400).json({
                success: false,
                message: "Type must be income or expense"
            });
        }

        // ------------------------------
        // INSERT INTO DATABASE
        // ------------------------------

        const [result] = await db.query(
            `
            INSERT INTO transactions
            (
                user_id,
                type,
                amount,
                category,
                description,
                transaction_date
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                req.accountId,
                type,
                Number(amount),
                category.trim(),
                description.trim(),
                transaction_date
            ]
        );

        res.status(201).json({
            success: true,
            message: "Transaction added successfully",
            id: result.insertId,
            data: {
                id: result.insertId,
                user_id: req.accountId,
                type,
                amount: Number(amount),
                category: category.trim(),
                description: description.trim(),
                transaction_date
            }
        });

    } catch (error) {

        console.error("Error adding transaction:", error);

        res.status(500).json({
            success: false,
            message: "Could not add transaction",
            error: error.message
        });
    }
});

// ==========================================
// DELETE TRANSACTION
// ==========================================

app.delete("/api/transactions/:id", async (req, res) => {

    try {

        const { id } = req.params;

        // ------------------------------
        // CHECK ID
        // ------------------------------

        if (!id || isNaN(id)) {

            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID"
            });
        }

        // ------------------------------
        // DELETE FROM DATABASE
        // ------------------------------

        const [result] = await db.query(
            "DELETE FROM transactions WHERE id = ? AND user_id = ?",
            [id, req.accountId]
        );

        // ------------------------------
        // TRANSACTION NOT FOUND
        // ------------------------------

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        // ------------------------------
        // SUCCESS
        // ------------------------------

        res.json({
            success: true,
            message: "Transaction deleted successfully",
            deletedId: Number(id)
        });

    } catch (error) {

        console.error("Error deleting transaction:", error);

        res.status(500).json({
            success: false,
            message: "Could not delete transaction",
            error: error.message
        });
    }
});

// ==========================================
// UPDATE TRANSACTION
// ==========================================

app.put("/api/transactions/:id", async (req, res) => {
    try {
        const { type, amount, category, description, transaction_date } = req.body;
        const { id } = req.params;

        if (!id || !Number.isInteger(Number(id)) || !type || !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 || !category?.trim() || !description?.trim() || !transaction_date) {
            return res.status(400).json({ success: false, message: "Valid transaction fields are required" });
        }

        if (type !== "income" && type !== "expense") {
            return res.status(400).json({ success: false, message: "Type must be income or expense" });
        }

        const [result] = await db.query(
            `UPDATE transactions
             SET type = ?, amount = ?, category = ?, description = ?, transaction_date = ?
             WHERE id = ? AND user_id = ?`,
            [type, Number(amount), category.trim(), description.trim(), transaction_date, id, req.accountId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        res.json({ success: true, message: "Transaction updated successfully" });
    } catch (error) {
        console.error("Error updating transaction:", error);
        res.status(500).json({ success: false, message: "Could not update transaction" });
    }
});

// ==========================================
// GET DASHBOARD DATA
// ==========================================

app.get("/api/dashboard", async (req, res) => {

    try {

        // ------------------------------
        // TOTAL INCOME
        // ------------------------------

        const [incomeResult] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS totalIncome
            FROM transactions
            WHERE type = 'income' AND user_id = ?
        `, [req.accountId]);

        // ------------------------------
        // TOTAL EXPENSE
        // ------------------------------

        const [expenseResult] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS totalExpenses
            FROM transactions
            WHERE type = 'expense' AND user_id = ?
        `, [req.accountId]);

        // ------------------------------
        // CALCULATE BALANCE
        // ------------------------------

        const totalIncome = Number(incomeResult[0].totalIncome);
        const totalExpenses = Number(expenseResult[0].totalExpenses);

        const balance = totalIncome - totalExpenses;

        // ------------------------------
        // SEND RESPONSE
        // ------------------------------

        res.json({
            success: true,
            data: {
                totalIncome,
                totalExpenses,
                balance
            }
        });

    } catch (error) {

        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Could not load dashboard",
            error: error.message
        });
    }
});

// ==========================================
// DELETE ALL TRANSACTIONS - OPTIONAL
// ==========================================

app.delete("/api/transactions", async (req, res) => {

    try {

        await db.query("DELETE FROM transactions WHERE user_id = ?", [req.accountId]);

        res.json({
            success: true,
            message: "All transactions deleted successfully"
        });

    } catch (error) {

        console.error("Error deleting transactions:", error);

        res.status(500).json({
            success: false,
            message: "Could not delete transactions",
            error: error.message
        });
    }
});

// ==========================================
// HANDLE UNKNOWN API ROUTES
// ==========================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "API route not found"
    });

});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

    console.error("Server error:", error);

    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
    });

});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`🚀 FinTrack server running on http://localhost:${PORT}`);

});