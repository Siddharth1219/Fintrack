import { useEffect, useMemo, useState } from "react";
import "./App.css";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";

// =====================================================
// BACKEND URL
// =====================================================

const API_BASE_URL = "http://localhost:5000/api";

// =====================================================
// API REQUEST HELPER
// =====================================================
// Automatically sends Firebase ID token to Express backend.
// =====================================================

async function apiRequest(endpoint, options = {}) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Authentication required.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

// =====================================================
// LOGIN COMPONENT
// =====================================================

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);

      let userCredential;

      if (mode === "login") {
        userCredential =
          await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password
          );
      } else {
        userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password
          );
      }

      onLogin(userCredential.user);

    } catch (err) {
      console.error("Authentication error:", err);

      let message =
        "Authentication failed. Please try again.";

      if (err.code === "auth/invalid-credential") {
        message =
          "Invalid email or password.";
      }

      if (err.code === "auth/email-already-in-use") {
        message =
          "This email is already registered.";
      }

      if (err.code === "auth/invalid-email") {
        message =
          "Please enter a valid email address.";
      }

      if (err.code === "auth/weak-password") {
        message =
          "Password should be at least 6 characters.";
      }

      setError(message);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-logo">
          ₹
        </div>

        <h1>
          FinTrack
        </h1>

        <p>
          Personal Finance Management
        </p>

        <h2>
          {mode === "login"
            ? "Welcome Back"
            : "Create Account"}
        </h2>

        <form onSubmit={handleSubmit}>

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create Account"}
          </button>

        </form>

        <div className="login-switch">

          {mode === "login" ? (
            <>
              Don't have an account?

              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              Already have an account?

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Login
              </button>
            </>
          )}

        </div>

      </div>

    </div>
  );
}

// =====================================================
// APP
// =====================================================

function App() {

  // ===================================================
  // AUTH
  // ===================================================

  const [user, setUser] = useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  // ===================================================
  // TRANSACTIONS
  // ===================================================

  const [transactions, setTransactions] =
    useState([]);

  const [transactionsLoading, setTransactionsLoading] =
    useState(false);

  // ===================================================
  // DASHBOARD
  // ===================================================

  const [dashboard, setDashboard] =
    useState({
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
    });

  const [dashboardLoading, setDashboardLoading] =
    useState(false);

  // ===================================================
  // MESSAGE
  // ===================================================

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  // ===================================================
  // SIDEBAR
  // ===================================================

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  // ===================================================
  // ADVISOR
  // ===================================================

  const [advice, setAdvice] =
    useState("");

  // ===================================================
  // VOICE
  // ===================================================

  const [voiceText, setVoiceText] =
    useState("");

  const [voiceMessage, setVoiceMessage] =
    useState("");

  const [isListening, setIsListening] =
    useState(false);

  // ===================================================
  // TRANSACTION FORM
  // ===================================================

  const [transactionType, setTransactionType] =
    useState("expense");

  const [amount, setAmount] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [transactionDate, setTransactionDate] =
    useState(
      new Date()
        .toISOString()
        .split("T")[0]
    );

  const [savingTransaction, setSavingTransaction] =
    useState(false);

  // ===================================================
  // FIREBASE AUTH LISTENER
  // ===================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          setUser(currentUser);

          setAuthLoading(false);
        }
      );

    return () => unsubscribe();

  }, []);

  // ===================================================
  // LOAD TRANSACTIONS
  // ===================================================

  const loadTransactions = async () => {

    try {

      setTransactionsLoading(true);
      setErrorMessage("");

      const result =
        await apiRequest(
          "/transactions"
        );

      setTransactions(
        Array.isArray(result.data)
          ? result.data
          : []
      );

    } catch (error) {

      console.error(
        "Load transactions error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Could not load transactions."
      );

    } finally {

      setTransactionsLoading(false);

    }
  };

  // ===================================================
  // LOAD DASHBOARD
  // ===================================================

  const loadDashboard = async () => {

    try {

      setDashboardLoading(true);

      const result =
        await apiRequest(
          "/dashboard"
        );

      if (result.data) {
        setDashboard({
          totalIncome:
            Number(
              result.data.totalIncome || 0
            ),

          totalExpenses:
            Number(
              result.data.totalExpenses || 0
            ),

          balance:
            Number(
              result.data.balance || 0
            ),
        });
      }

    } catch (error) {

      console.error(
        "Dashboard error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Could not load dashboard."
      );

    } finally {

      setDashboardLoading(false);

    }
  };

  // ===================================================
  // LOAD USER DATA AFTER LOGIN
  // ===================================================

  useEffect(() => {

    if (!user) {
      setTransactions([]);
      setDashboard({
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
      });

      return;
    }

    loadTransactions();
    loadDashboard();

  }, [user]);

  // ===================================================
  // REFRESH ALL DATA
  // ===================================================

  const refreshData = async () => {

    await Promise.all([
      loadTransactions(),
      loadDashboard(),
    ]);

  };

  // ===================================================
  // ADD TRANSACTION
  // ===================================================

  const handleAddTransaction = async (
    event
  ) => {

    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    const numericAmount =
      Number(amount);

    if (!transactionType) {
      setErrorMessage(
        "Please select transaction type."
      );
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage(
        "Please enter a valid amount greater than zero."
      );
      return;
    }

    if (!category.trim()) {
      setErrorMessage(
        "Please enter a category."
      );
      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Please enter a description."
      );
      return;
    }

    if (!transactionDate) {
      setErrorMessage(
        "Please select a transaction date."
      );
      return;
    }

    try {

      setSavingTransaction(true);

      const result =
        await apiRequest(
          "/transactions",
          {
            method: "POST",

            body: JSON.stringify({
              type: transactionType,

              amount: numericAmount,

              category:
                category.trim(),

              description:
                description.trim(),

              transaction_date:
                transactionDate,
            }),
          }
        );

      setMessage(
        result.message ||
          "Transaction added successfully."
      );

      // Reset form

      setAmount("");
      setCategory("");
      setDescription("");

      setTransactionType("expense");

      setTransactionDate(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      await refreshData();

    } catch (error) {

      console.error(
        "Add transaction error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Could not add transaction."
      );

    } finally {

      setSavingTransaction(false);

    }
  };

  // ===================================================
  // DELETE TRANSACTION
  // ===================================================

  const handleDelete = async (id) => {

    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this transaction?"
      );

    if (!confirmed) {
      return;
    }

    try {

      setMessage("");
      setErrorMessage("");

      await apiRequest(
        `/transactions/${id}`,
        {
          method: "DELETE",
        }
      );

      setMessage(
        "Transaction deleted successfully."
      );

      await refreshData();

    } catch (error) {

      console.error(
        "Delete transaction error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Could not delete transaction."
      );
    }
  };

  // ===================================================
  // DELETE ALL TRANSACTIONS
  // ===================================================

  const handleDeleteAll = async () => {

    if (transactions.length === 0) {
      setMessage(
        "There are no transactions to delete."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "WARNING: This will delete ALL your transactions. Continue?"
      );

    if (!confirmed) {
      return;
    }

    try {

      setMessage("");
      setErrorMessage("");

      await apiRequest(
        "/transactions",
        {
          method: "DELETE",
        }
      );

      setMessage(
        "All transactions deleted successfully."
      );

      await refreshData();

    } catch (error) {

      console.error(
        "Delete all error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Could not delete transactions."
      );
    }
  };

  // ===================================================
  // TRANSACTION TYPE
  // ===================================================

  const getTransactionType = (
    transaction
  ) => {

    return (
      transaction?.type ||
      transaction?.transaction_type ||
      ""
    ).toLowerCase();

  };

  // ===================================================
  // FINANCIAL TOTALS
  // ===================================================

  const totalIncome =
    Number(
      dashboard?.totalIncome || 0
    );

  const totalExpenses =
    Number(
      dashboard?.totalExpenses || 0
    );

  const balance =
    Number(
      dashboard?.balance || 0
    );

  // ===================================================
  // SAVINGS RATE
  // ===================================================

  const savingsRate =
    totalIncome > 0
      ? (
          ((totalIncome -
            totalExpenses) /
            totalIncome) *
          100
        ).toFixed(1)
      : "0.0";

  // ===================================================
  // EXPENSE CATEGORY DATA
  // ===================================================

  const categoryTotals =
    useMemo(() => {

      const totals = {};

      transactions
        .filter(
          (transaction) =>
            getTransactionType(
              transaction
            ) === "expense"
        )
        .forEach(
          (transaction) => {

            const name =
              transaction.category?.trim() ||
              "Other";

            totals[name] =
              (totals[name] || 0) +
              Number(
                transaction.amount || 0
              );
          }
        );

      return totals;

    }, [transactions]);

  const categoryEntries =
    Object.entries(
      categoryTotals
    ).sort(
      (a, b) => b[1] - a[1]
    );

  // ===================================================
  // MONTHLY DATA
  // ===================================================

  const monthlyData =
    useMemo(() => {

      const data = {};

      transactions.forEach(
        (transaction) => {

          if (
            !transaction.transaction_date
          ) {
            return;
          }

          const date =
            new Date(
              transaction.transaction_date
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return;
          }

          const month =
            date.toLocaleString(
              "en-IN",
              {
                month: "short",
              }
            );

          if (!data[month]) {

            data[month] = {
              income: 0,
              expense: 0,
            };

          }

          const value =
            Number(
              transaction.amount || 0
            );

          if (
            getTransactionType(
              transaction
            ) === "income"
          ) {
            data[month].income += value;
          }

          if (
            getTransactionType(
              transaction
            ) === "expense"
          ) {
            data[month].expense += value;
          }

        }
      );

      return data;

    }, [transactions]);

  const monthOrder = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const sortedMonths =
    Object.keys(monthlyData).sort(
      (a, b) =>
        monthOrder.indexOf(a) -
        monthOrder.indexOf(b)
    );

  // ===================================================
  // FINANCIAL HEALTH
  // ===================================================

  let healthScore = 50;

  if (totalIncome > 0) {

    const rate =
      ((totalIncome -
        totalExpenses) /
        totalIncome) *
      100;

    if (rate >= 30) {
      healthScore = 95;
    } else if (rate >= 20) {
      healthScore = 85;
    } else if (rate >= 10) {
      healthScore = 72;
    } else if (rate >= 0) {
      healthScore = 55;
    } else {
      healthScore = 25;
    }
  }

  let healthTitle =
    "Needs Improvement";

  if (healthScore >= 85) {
    healthTitle = "Excellent";
  } else if (healthScore >= 70) {
    healthTitle = "Good";
  } else if (healthScore >= 50) {
    healthTitle = "Fair";
  }

  // ===================================================
  // FINANCIAL ADVICE
  // ===================================================

  const getFinancialAdvice = () => {

    const income =
      totalIncome;

    const expenses =
      totalExpenses;

    const currentBalance =
      balance;

    if (income === 0) {

      return (
        "Start by adding your income and expense transactions so FinTrack can analyze your financial health."
      );

    }

    if (expenses > income) {

      return (
        "⚠️ Your expenses are higher than your income. Review your largest spending categories and reduce unnecessary expenses."
      );

    }

    const rate =
      (currentBalance /
        income) *
      100;

    if (rate < 10) {

      return (
        "Your savings rate is currently low. Try reducing non-essential expenses and aim to save 10–20% of your income."
      );

    }

    if (rate < 20) {

      return (
        "Your finances are positive, but your savings rate can improve. Set a monthly savings target and reduce unnecessary spending."
      );

    }

    if (rate < 30) {

      return (
        "👍 Your financial position looks healthy. Continue tracking expenses and build an emergency fund."
      );

    }

    return (
      "🌟 Excellent financial performance! Your savings rate is strong. Keep controlling expenses and consider investing part of your surplus for long-term goals."
    );
  };

  // ===================================================
  // GET ADVICE
  // ===================================================

  const handleGetAdvice = () => {

    const result =
      getFinancialAdvice();

    setAdvice(result);

  };

  // ===================================================
  // TEXT TO SPEECH
  // ===================================================

  const speakResponse = (text) => {

    setVoiceMessage(text);

    if (
      "speechSynthesis" in window
    ) {

      window.speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(
          text
        );

      speech.lang = "en-IN";

      speech.rate = 1;

      speech.pitch = 1;

      window.speechSynthesis.speak(
        speech
      );
    }
  };

  // ===================================================
  // VOICE COMMAND
  // ===================================================

  const handleVoiceCommand = async (
    text
  ) => {

    const command =
      text
        .toLowerCase()
        .trim();

    setMessage(
      `Processing: "${text}"`
    );

    // -----------------------------
    // ADVICE
    // -----------------------------

    if (
      command.includes(
        "financial advice"
      ) ||
      command.includes("advice") ||
      command.includes(
        "financial tips"
      ) ||
      command.includes(
        "suggestion"
      ) ||
      command.includes(
        "suggest"
      )
    ) {

      const result =
        getFinancialAdvice();

      setAdvice(result);

      speakResponse(result);

      return;
    }

    // -----------------------------
    // BALANCE
    // -----------------------------

    if (
      command.includes("balance") ||
      command.includes(
        "money left"
      ) ||
      command.includes(
        "remaining money"
      ) ||
      command.includes(
        "how much money"
      )
    ) {

      const response =
        balance >= 0
          ? `Your current balance is ₹${balance.toLocaleString(
              "en-IN"
            )}.`
          : `Your balance is negative by ₹${Math.abs(
              balance
            ).toLocaleString(
              "en-IN"
            )}.`;

      speakResponse(response);

      return;
    }

    // -----------------------------
    // INCOME
    // -----------------------------

    if (
      command.includes("income") ||
      command.includes(
        "earnings"
      ) ||
      command.includes("earned")
    ) {

      speakResponse(
        `Your total income is ₹${totalIncome.toLocaleString(
          "en-IN"
        )}.`
      );

      return;
    }

    // -----------------------------
    // EXPENSE
    // -----------------------------

    if (
      command.includes("expenses") ||
      command.includes("expense") ||
      command.includes(
        "spending"
      ) ||
      command.includes("spent")
    ) {

      speakResponse(
        `Your total expenses are ₹${totalExpenses.toLocaleString(
          "en-IN"
        )}.`
      );

      return;
    }

    // -----------------------------
    // SAVINGS
    // -----------------------------

    if (
      command.includes("saving") ||
      command.includes(
        "savings rate"
      )
    ) {

      speakResponse(
        `Your current savings rate is ${savingsRate} percent.`
      );

      return;
    }

    // -----------------------------
    // DELETE LATEST
    // -----------------------------

    if (
      command.includes(
        "delete latest"
      ) ||
      command.includes(
        "delete last"
      ) ||
      command.includes(
        "remove latest"
      ) ||
      command.includes(
        "remove last"
      )
    ) {

      if (
        transactions.length === 0
      ) {

        speakResponse(
          "You don't have any transactions to delete."
        );

        return;
      }

      const latest =
        transactions[0];

      const latestAmount =
        Number(
          latest.amount || 0
        );

      speakResponse(
        `Deleting your latest transaction of ₹${latestAmount.toLocaleString(
          "en-IN"
        )}.`
      );

      await handleDelete(
        latest.id
      );

      return;
    }

    // -----------------------------
    // UNKNOWN
    // -----------------------------

    speakResponse(
      `I heard "${text}". You can ask for your balance, income, expenses, savings rate, financial advice, or say delete latest transaction.`
    );
  };

  // ===================================================
  // START VOICE ASSISTANT
  // ===================================================

  const startVoiceAssistant = () => {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      alert(
        "Voice recognition is not supported in this browser. Please use Google Chrome."
      );

      return;
    }

    if (isListening) {
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      "en-IN";

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.maxAlternatives =
      1;

    recognition.onstart = () => {

      setIsListening(true);

      setVoiceText(
        "Listening..."
      );

      setVoiceMessage("");

    };

    recognition.onresult =
      async (event) => {

        const text =
          event.results?.[0]?.[0]
            ?.transcript || "";

        setVoiceText(text);

        setIsListening(false);

        if (text.trim()) {

          await handleVoiceCommand(
            text
          );

        }

      };

    recognition.onerror =
      (event) => {

        console.error(
          "Voice error:",
          event.error
        );

        setIsListening(false);

        setVoiceText("");

        setVoiceMessage(
          "Sorry, I couldn't understand you. Please try again."
        );

      };

    recognition.onend = () => {

      setIsListening(false);

    };

    try {

      recognition.start();

    } catch (error) {

      console.error(
        "Could not start voice recognition:",
        error
      );

      setIsListening(false);

    }

  };

  // ===================================================
  // DATE FORMAT
  // ===================================================

  const formatDate = (
    dateValue
  ) => {

    if (!dateValue) {
      return "—";
    }

    const date =
      new Date(dateValue);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(
        dateValue
      );
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ===================================================
  // SCROLL TO SECTION
  // ===================================================

  const scrollToSection = (
    id
  ) => {

    const element =
      document.getElementById(id);

    if (element) {

      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

    }

    setSidebarOpen(false);
  };

  // ===================================================
  // LOGOUT
  // ===================================================

  const handleLogout = async () => {

    try {

      await signOut(auth);

      setUser(null);

      setTransactions([]);

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

      setErrorMessage(
        "Could not logout."
      );

    }
  };

  // ===================================================
  // AUTH LOADING SCREEN
  // ===================================================

  if (authLoading) {

    return (
      <div className="auth-loading">

        <div className="loading-spinner"></div>

        <h2>
          Loading FinTrack...
        </h2>

        <p>
          Preparing your financial dashboard
        </p>

      </div>
    );
  }

  // ===================================================
  // LOGIN SCREEN
  // ===================================================

  if (!user) {

    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }

  // ===================================================
  // MAIN APPLICATION
  // ===================================================

  return (
    <div className="app-shell">

      {/* ============================================
          SIDEBAR
      ============================================ */}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            ₹
          </div>

          <div>
            <strong>
              FinTrack
            </strong>

            <span>
              Personal Finance
            </span>
          </div>

        </div>

        <nav className="sidebar-nav">

          <p className="nav-title">
            MAIN MENU
          </p>

          <button
            className="nav-item active"
            onClick={() =>
              scrollToSection(
                "dashboard"
              )
            }
          >
            <span>🏠</span>
            Dashboard
          </button>

          <button
            className="nav-item"
            onClick={() =>
              scrollToSection(
                "transactions"
              )
            }
          >
            <span>💳</span>
            Transactions
          </button>

          <button
            className="nav-item"
            onClick={() =>
              scrollToSection(
                "analytics"
              )
            }
          >
            <span>📊</span>
            Analytics
          </button>

          <p className="nav-title nav-title-space">
            SMART TOOLS
          </p>

          <button
            className="nav-item"
            onClick={() =>
              scrollToSection(
                "advisor"
              )
            }
          >
            <span>🤖</span>
            AI Advisor
          </button>

          <button
            className="nav-item"
            onClick={() =>
              scrollToSection(
                "voice"
              )
            }
          >
            <span>🎤</span>
            Voice Assistant
          </button>

          <button
            className="nav-item"
            onClick={() =>
              scrollToSection(
                "reports"
              )
            }
          >
            <span>📄</span>
            Reports
            <small>
              SOON
            </small>
          </button>

        </nav>

        <div className="sidebar-bottom">

          <button className="nav-item">
            <span>⚙️</span>
            Settings
          </button>

          <button
            className="nav-item logout-nav"
            onClick={
              handleLogout
            }
          >
            <span>🚪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* ============================================
          MOBILE OVERLAY
      ============================================ */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ============================================
          MAIN CONTENT
      ============================================ */}

      <main className="main-content">

        {/* ==========================================
            USER BAR
        ========================================== */}

        <div className="user-bar">

          <button
            className="mobile-menu-button"
            onClick={() =>
              setSidebarOpen(true)
            }
          >
            ☰
          </button>

          <div className="user-info">

            {user.photoURL ? (

              <img
                src={user.photoURL}
                alt="Profile"
                className="user-avatar"
              />

            ) : (

              <div className="user-avatar-placeholder">

                {(
                  user.displayName ||
                  user.email ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase()}

              </div>

            )}

            <div className="user-details">

              <strong>
                {user.displayName ||
                  "FinTrack User"}
              </strong>

              <span>
                {user.email}
              </span>

            </div>

          </div>

          <button
            className="logout-button"
            onClick={
              handleLogout
            }
          >
            🚪 Logout
          </button>

        </div>

        {/* ==========================================
            HEADER
        ========================================== */}

        <header
          className="dashboard-header"
        >

          <div className="welcome-content">

            <div className="welcome-icon">
              ₹
            </div>

            <div>

              <p className="welcome-small">
                PERSONAL FINANCE DASHBOARD
              </p>

              <h1>
                Welcome back,{" "}
                {user.displayName ||
                  "there"} 👋
              </h1>

            </div>

          </div>

        </header>

        {/* ==========================================
            GLOBAL MESSAGES
        ========================================== */}

        {message && (
          <div className="success-message">
            ✅ {message}
          </div>
        )}

        {errorMessage && (
          <div className="error-message">
            ❌ {errorMessage}
          </div>
        )}

        {/* ==========================================
            KPI SECTION
        ========================================== */}

        <section
          className="dashboard"
          id="dashboard"
        >

          <div className="dashboard-header">

            <div>
              <p className="welcome-small">
                OVERVIEW
              </p>

              <h2>
                Financial Overview
              </h2>
            </div>

            <button
              type="button"
              onClick={
                refreshData
              }
            >
              🔄 Refresh
            </button>

          </div>

          <div className="card income-card">

            <div className="card-icon">
              ↗
            </div>

            <h3>
              Total Income
            </h3>

            <h2>
              ₹
              {totalIncome.toLocaleString(
                "en-IN"
              )}
            </h2>

            <span className="card-label">
              Money received
            </span>

          </div>

          <div className="card expense-card">

            <div className="card-icon">
              ↘
            </div>

            <h3>
              Total Expenses
            </h3>

            <h2>
              ₹
              {totalExpenses.toLocaleString(
                "en-IN"
              )}
            </h2>

            <span className="card-label">
              Money spent
            </span>

          </div>

          <div className="card balance-card">

            <div className="card-icon">
              ₹
            </div>

            <h3>
              Current Balance
            </h3>

            <h2>
              ₹
              {balance.toLocaleString(
                "en-IN"
              )}
            </h2>

            <span className="card-label">
              Income − Expenses
            </span>

          </div>

          <div className="card savings-card">

            <div className="card-icon">
              %
            </div>

            <h3>
              Savings Rate
            </h3>

            <h2>
              {savingsRate}%
            </h2>

            <span className="card-label">
              Current savings percentage
            </span>

          </div>

        </section>

        {/* ==========================================
            ADD TRANSACTION
        ========================================== */}

        <section
          className="advisor-card"
          id="transactions"
        >

          <div className="advisor-icon">
            💳
          </div>

          <h2>
            Add Transaction
          </h2>

          <p>
            Record your income and expenses.
          </p>

          <form
            className="transaction-form"
            onSubmit={
              handleAddTransaction
            }
          >

            <div className="form-row">

              <div className="form-group">

                <label>
                  Transaction Type
                </label>

                <select
                  value={
                    transactionType
                  }
                  onChange={(event) =>
                    setTransactionType(
                      event.target.value
                    )
                  }
                >

                  <option value="expense">
                    Expense
                  </option>

                  <option value="income">
                    Income
                  </option>

                </select>

              </div>

              <div className="form-group">

                <label>
                  Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="₹ 0"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>

            <div className="form-row">

              <div className="form-group">

                <label>
                  Category
                </label>

                <input
                  type="text"
                  placeholder="Food, Salary, Rent..."
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                />

              </div>

              <div className="form-group">

                <label>
                  Date
                </label>

                <input
                  type="date"
                  value={
                    transactionDate
                  }
                  onChange={(event) =>
                    setTransactionDate(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>

            <div className="form-group">

              <label>
                Description
              </label>

              <textarea
                placeholder="Describe this transaction..."
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
              />

            </div>

            <button
              type="submit"
              disabled={
                savingTransaction
              }
            >
              {savingTransaction
                ? "Saving..."
                : "💾 Save Transaction"}
            </button>

          </form>

        </section>

        {/* ==========================================
            TRANSACTION HISTORY
        ========================================== */}

        <section
          className="transactions-section"
        >

          <div className="section-heading">

            <div>

              <h2>
                Transactions
              </h2>

              <p>
                Complete history of your financial activity
              </p>

            </div>

            {transactions.length >
              0 && (
              <button
                className="delete-all-button"
                onClick={
                  handleDeleteAll
                }
              >
                🗑️ Delete All
              </button>
            )}

          </div>

          {transactionsLoading ? (

            <div className="empty-state">
              Loading transactions...
            </div>

          ) : transactions.length ===
            0 ? (

            <div className="empty-state">

              <div>
                💳
              </div>

              <h3>
                No transactions yet
              </h3>

              <p>
                Add your first income or expense above.
              </p>

            </div>

          ) : (

            <div className="transaction-list">

              {transactions.map(
                (transaction) => {

                  const type =
                    getTransactionType(
                      transaction
                    );

                  const transactionAmount =
                    Number(
                      transaction.amount ||
                        0
                    );

                  return (

                    <div
                      className="transaction-item"
                      key={
                        transaction.id
                      }
                    >

                      <div className="transaction-icon">

                        {type ===
                        "income"
                          ? "↗"
                          : "↘"}

                      </div>

                      <div className="transaction-info">

                        <strong>
                          {transaction.category ||
                            "Other"}
                        </strong>

                        <span>
                          {
                            transaction.description
                          }
                        </span>

                        <small>
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </small>

                      </div>

                      <div
                        className={`transaction-amount ${
                          type ===
                          "income"
                            ? "income-text"
                            : "expense-text"
                        }`}
                      >

                        {type ===
                        "income"
                          ? "+"
                          : "-"}

                        ₹
                        {transactionAmount.toLocaleString(
                          "en-IN"
                        )}

                      </div>

                      <button
                        className="delete-button"
                        onClick={() =>
                          handleDelete(
                            transaction.id
                          )
                        }
                      >
                        🗑️
                      </button>

                    </div>

                  );
                }
              )}

            </div>

          )}

        </section>

        {/* ==========================================
            ANALYTICS
        ========================================== */}

        <section
          className="analytics-section"
          id="analytics"
        >

          <div className="section-heading">

            <div>

              <h2>
                Analytics
              </h2>

              <p>
                Understand where your money is going.
              </p>

            </div>

          </div>

          <div className="analytics-grid">

            {/* CATEGORY ANALYSIS */}

            <div className="analytics-card">

              <h3>
                Expense Categories
              </h3>

              {categoryEntries.length ===
              0 ? (

                <p>
                  No expense data available yet.
                </p>

              ) : (

                <div className="category-list">

                  {categoryEntries.map(
                    ([name, value]) => {

                      const percentage =
                        totalExpenses >
                        0
                          ? (value /
                              totalExpenses) *
                            100
                          : 0;

                      return (

                        <div
                          className="category-row"
                          key={name}
                        >

                          <div className="category-header">

                            <span>
                              {name}
                            </span>

                            <strong>
                              ₹
                              {value.toLocaleString(
                                "en-IN"
                              )}
                            </strong>

                          </div>

                          <div className="progress-bar">

                            <div
                              className="progress-fill"
                              style={{
                                width: `${Math.min(
                                  percentage,
                                  100
                                )}%`,
                              }}
                            />

                          </div>

                          <small>
                            {percentage.toFixed(
                              1
                            )}
                            %
                          </small>

                        </div>

                      );

                    }
                  )}

                </div>

              )}

            </div>

            {/* MONTHLY ANALYSIS */}

            <div className="analytics-card">

              <h3>
                Monthly Overview
              </h3>

              {sortedMonths.length ===
              0 ? (

                <p>
                  No monthly data available yet.
                </p>

              ) : (

                <div className="monthly-list">

                  {sortedMonths.map(
                    (month) => {

                      const data =
                        monthlyData[
                          month
                        ];

                      return (

                        <div
                          className="monthly-row"
                          key={month}
                        >

                          <strong>
                            {month}
                          </strong>

                          <span className="income-text">
                            +₹
                            {data.income.toLocaleString(
                              "en-IN"
                            )}
                          </span>

                          <span className="expense-text">
                            -₹
                            {data.expense.toLocaleString(
                              "en-IN"
                            )}
                          </span>

                        </div>

                      );

                    }
                  )}

                </div>

              )}

            </div>

          </div>

        </section>

        {/* ==========================================
            FINANCIAL HEALTH
        ========================================== */}

        <section className="health-card">

          <div className="health-icon">
            ❤️
          </div>

          <div className="health-content">

            <p>
              FINANCIAL HEALTH
            </p>

            <h2>
              {healthTitle}
            </h2>

            <div className="health-progress">

              <div
                className="health-progress-fill"
                style={{
                  width: `${healthScore}%`,
                }}
              />

            </div>

            <span>
              Health Score:{" "}
              <strong>
                {healthScore}/100
              </strong>
            </span>

          </div>

        </section>

        {/* ==========================================
            AI ADVISOR
        ========================================== */}

        <section
          className="advisor-card"
          id="advisor"
        >

          <div className="advisor-icon">
            🤖
          </div>

          <h2>
            AI Financial Advisor
          </h2>

          <p>
            Get a simple analysis of your current financial position.
          </p>

          <button
            type="button"
            onClick={
              handleGetAdvice
            }
          >
            🤖 Get Financial Advice
          </button>

          {advice && (

            <div className="advisor-message">

              <strong>
                FinTrack Advisor
              </strong>

              <p>
                {advice}
              </p>

            </div>

          )}

        </section>

        {/* ==========================================
            VOICE ASSISTANT
        ========================================== */}

        <section
          className="advisor-card voice-section"
          id="voice"
        >

          <div className="advisor-icon">
            🎙️
          </div>

          <h2>
            Voice Financial Assistant
          </h2>

          <p>
            Ask about your balance, income, expenses, savings or financial advice.
          </p>

          <button
            type="button"
            onClick={
              startVoiceAssistant
            }
            disabled={
              isListening
            }
          >
            {isListening
              ? "🎙️ Listening..."
              : "🎤 Start Voice Assistant"}
          </button>

          {voiceText && (

            <div className="voice-result">

              <strong>
                You said:
              </strong>

              <span>
                {voiceText}
              </span>

            </div>

          )}

          {voiceMessage && (

            <div className="advisor-message">

              <strong>
                FinTrack:
              </strong>

              <p>
                {voiceMessage}
              </p>

            </div>

          )}

        </section>

        {/* ==========================================
            REPORTS
        ========================================== */}

        <section
          className="advisor-card"
          id="reports"
        >

          <div className="advisor-icon">
            📄
          </div>

          <h2>
            Reports
          </h2>

          <p>
            Detailed financial reports and PDF export will be available here.
          </p>

          <span className="coming-soon">
            COMING SOON
          </span>

        </section>

      </main>

    </div>
  );
}

export default App;