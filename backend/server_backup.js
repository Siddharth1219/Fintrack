const admin = require("firebase-admin");
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
      await admin
        .auth()
        .verifyIdToken(token);

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
require("dotenv").config();

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

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

// ==========================================
// TEST DATABASE CONNECTION
// ==========================================

async function testDatabase() {
    try {
        const connection = await db.getConnection();

        console.log("✅ MySQL connected successfully");

        connection.release();
    } catch (error) {
        console.error("❌ MySQL connection failed:");
        console.error(error.message);
    }
}

testDatabase();

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
            ORDER BY transaction_date DESC, id DESC
        `);

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

        if (!type || !amount || !category || !description || !transaction_date) {

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
                user_id || 1,
                type,
                Number(amount),
                category,
                description,
                transaction_date
            ]
        );

        res.status(201).json({
            success: true,
            message: "Transaction added successfully",
            id: result.insertId
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
            "DELETE FROM transactions WHERE id = ?",
            [id]
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
            WHERE type = 'income'
        `);

        // ------------------------------
        // TOTAL EXPENSE
        // ------------------------------

        const [expenseResult] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS totalExpenses
            FROM transactions
            WHERE type = 'expense'
        `);

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

        await db.query("DELETE FROM transactions");

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