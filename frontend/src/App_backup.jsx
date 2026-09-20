import { useEffect, useState } from "react";
import "./App.css";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase";
import Login from "./Login";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import {
  Bar,
  Doughnut,
} from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

function App() {
  // =====================================================
  // AUTHENTICATION
  // =====================================================

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =====================================================
  // DASHBOARD STATE
  // =====================================================

  const [dashboard, setDashboard] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
  });

  const [transactions, setTransactions] = useState([]);

  // =====================================================
  // FORM STATE
  // =====================================================

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "",
    description: "",
    transaction_date: "",
  });

  const [message, setMessage] = useState("");

  // =====================================================
  // AI ADVISOR
  // =====================================================

  const [advice, setAdvice] = useState("");

  // =====================================================
  // VOICE ASSISTANT
  // =====================================================

  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  const loadDashboard = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/dashboard"
      );

      if (!response.ok) {
        throw new Error("Dashboard request failed");
      }

      const data = await response.json();

      if (data.success) {
        setDashboard(
          data.data || {
            totalIncome: 0,
            totalExpenses: 0,
            balance: 0,
          }
        );
      }
    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error
      );
    }
  };

  // =====================================================
  // LOAD TRANSACTIONS
  // =====================================================

  const loadTransactions = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/transactions"
      );

      if (!response.ok) {
        throw new Error(
          "Transactions request failed"
        );
      }

      const result = await response.json();

      if (result.success) {
        setTransactions(result.data || []);
      }
    } catch (error) {
      console.error(
        "Transaction loading error:",
        error
      );
    }
  };

  // =====================================================
  // LOAD DATA AFTER LOGIN
  // =====================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    loadDashboard();
    loadTransactions();
  }, [user]);

  // =====================================================
  // FORM CHANGE
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  // =====================================================
  // ADD TRANSACTION
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");

    if (
      !form.amount ||
      Number(form.amount) <= 0
    ) {
      setMessage(
        "Please enter a valid amount."
      );
      return;
    }

    if (!form.category.trim()) {
      setMessage(
        "Please enter a category."
      );
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/transactions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            user_id: 1,

            type: form.type,

            amount: Number(form.amount),

            category: form.category.trim(),

            description:
              form.description.trim(),

            transaction_date:
              form.transaction_date ||
              new Date()
                .toISOString()
                .split("T")[0],
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage(
          "✓ Transaction added successfully!"
        );

        setForm({
          type: "expense",
          amount: "",
          category: "",
          description: "",
          transaction_date: "",
        });

        await loadTransactions();
        await loadDashboard();

        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      } else {
        setMessage(
          data.message ||
            "Failed to add transaction."
        );
      }
    } catch (error) {
      console.error(
        "Add transaction error:",
        error
      );

      setMessage(
        "Could not connect to backend."
      );
    }
  };

  // =====================================================
  // DELETE TRANSACTION
  // =====================================================

  const handleDelete = async (id) => {
    if (!id) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/transactions/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage(
          "✓ Transaction deleted successfully!"
        );

        await loadTransactions();
        await loadDashboard();
      } else {
        setMessage(
          data.message ||
            "Failed to delete transaction."
        );
      }
    } catch (error) {
      console.error(
        "Delete transaction error:",
        error
      );

      setMessage(
        "Could not connect to backend."
      );
    }
  };

  // =====================================================
  // FINANCIAL ADVICE
  // =====================================================

  const getFinancialAdvice = () => {
    const income = Number(
      dashboard?.totalIncome || 0
    );

    const expenses = Number(
      dashboard?.totalExpenses || 0
    );

    const currentBalance =
      income - expenses;

    if (income === 0) {
      return "Start by adding your income and expense transactions so FinTrack can analyze your financial health.";
    }

    if (expenses > income) {
      return "⚠️ Your expenses are higher than your income. Reduce unnecessary spending, review your largest expense categories, and try to bring monthly expenses below your income.";
    }

    const rate =
      (currentBalance / income) * 100;

    if (rate < 10) {
      return "Your savings rate is currently low. Try reducing non-essential expenses and aim to save at least 10–20% of your income.";
    }

    if (rate < 20) {
      return "Your finances are positive, but your savings rate can improve. Consider setting a monthly savings target and reducing unnecessary spending.";
    }

    if (rate < 30) {
      return "👍 Your financial position looks healthy. You are saving a good portion of your income. Continue tracking expenses and build an emergency fund.";
    }

    return "🌟 Excellent financial performance! Your savings rate is strong. Keep controlling expenses and consider investing a portion of your surplus for long-term goals.";
  };

  const handleGetAdvice = () => {
    const result = getFinancialAdvice();

    setAdvice(result);
  };

  // =====================================================
  // SPEAK RESPONSE
  // =====================================================

  const speakResponse = (text) => {
    setVoiceMessage(text);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(text);

      speech.lang = "en-IN";
      speech.rate = 1;
      speech.pitch = 1;

      window.speechSynthesis.speak(
        speech
      );
    }
  };

  // =====================================================
  // VOICE COMMAND PROCESSOR
  // =====================================================

  const handleVoiceCommand = async (
    text
  ) => {
    const command = text
      .toLowerCase()
      .trim();

    setMessage(
      `Processing: "${text}"`
    );

    // Financial advice
    if (
      command.includes(
        "financial advice"
      ) ||
      command.includes("advice") ||
      command.includes(
        "financial tips"
      ) ||
      command.includes("suggestion") ||
      command.includes("suggest")
    ) {
      const result =
        getFinancialAdvice();

      setAdvice(result);

      speakResponse(result);

      return;
    }

    // Balance
    if (
      command.includes("balance") ||
      command.includes(
        "how much money"
      ) ||
      command.includes(
        "money left"
      ) ||
      command.includes(
        "remaining money"
      )
    ) {
      const currentBalance =
        Number(
          dashboard?.balance || 0
        );

      const response =
        currentBalance >= 0
          ? `Your current balance is ₹${currentBalance.toLocaleString(
              "en-IN"
            )}.`
          : `Your balance is negative by ₹${Math.abs(
              currentBalance
            ).toLocaleString("en-IN")}.`;

      speakResponse(response);

      return;
    }

    // Income
    if (
      command.includes("income") ||
      command.includes("earnings") ||
      command.includes("earned")
    ) {
      const income =
        Number(
          dashboard?.totalIncome || 0
        );

      speakResponse(
        `Your total income is ₹${income.toLocaleString(
          "en-IN"
        )}.`
      );

      return;
    }

    // Expenses
    if (
      command.includes("expenses") ||
      command.includes("expense") ||
      command.includes("spending") ||
      command.includes("spent")
    ) {
      const expenses =
        Number(
          dashboard?.totalExpenses || 0
        );

      speakResponse(
        `Your total expenses are ₹${expenses.toLocaleString(
          "en-IN"
        )}.`
      );

      return;
    }

    // Delete latest
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

      const latestTransaction =
        transactions[0];

      const amount =
        Number(
          latestTransaction.amount || 0
        );

      speakResponse(
        `Deleting your latest transaction of ₹${amount.toLocaleString(
          "en-IN"
        )}.`
      );

      await handleDelete(
        latestTransaction.id
      );

      return;
    }

    // General response
    speakResponse(
      `I heard "${text}". You can say show my balance, show my income, show my expenses, delete latest transaction, or give me financial advice.`
    );
  };

  // =====================================================
  // START VOICE ASSISTANT
  // =====================================================

  const startVoiceAssistant = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice recognition is not supported. Please use Google Chrome."
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

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
          event.results[0][0]
            .transcript;

        setVoiceText(text);

        setIsListening(false);

        await handleVoiceCommand(
          text
        );
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
          "Sorry, I couldn't understand you."
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

  // =====================================================
  // TRANSACTION TYPE HELPER
  // =====================================================

  const getTransactionType = (
    transaction
  ) => {
    return (
      transaction.type ||
      transaction.transaction_type ||
      ""
    ).toLowerCase();
  };

  // =====================================================
  // TOTALS
  // =====================================================

  const incomeAmount =
    transactions
      .filter(
        (transaction) =>
          getTransactionType(
            transaction
          ) === "income"
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.amount || 0
          ),
        0
      );

  const expenseAmount =
    transactions
      .filter(
        (transaction) =>
          getTransactionType(
            transaction
          ) === "expense"
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.amount || 0
          ),
        0
      );

  // =====================================================
  // FINAL TOTALS
  // =====================================================

  const totalIncome = Number(
    dashboard?.totalIncome ??
      incomeAmount ??
      0
  );

  const totalExpenses = Number(
    dashboard?.totalExpenses ??
      expenseAmount ??
      0
  );

  const balance = Number(
    dashboard?.balance ??
      totalIncome - totalExpenses
  );

  const savingsRate =
    totalIncome > 0
      ? (
          ((totalIncome -
            totalExpenses) /
            totalIncome) *
          100
        ).toFixed(1)
      : "0.0";

  // =====================================================
  // EXPENSE CATEGORIES
  // =====================================================

  const categoryTotals = {};

  transactions
    .filter(
      (transaction) =>
        getTransactionType(
          transaction
        ) === "expense"
    )
    .forEach(
      (transaction) => {
        const category =
          transaction.category ||
          "Other";

        categoryTotals[category] =
          (categoryTotals[category] ||
            0) +
          Number(
            transaction.amount || 0
          );
      }
    );

  const categoryLabels =
    Object.keys(categoryTotals);

  const categoryData = {
    labels: categoryLabels,

    datasets: [
      {
        label: "Expenses (₹)",

        data: categoryLabels.map(
          (category) =>
            categoryTotals[
              category
            ]
        ),

        backgroundColor: [
          "#2563EB",
          "#10B981",
          "#F59E0B",
          "#EF4444",
          "#8B5CF6",
          "#06B6D4",
          "#F97316",
          "#EC4899",
          "#14B8A6",
          "#6366F1",
        ],

        borderWidth: 3,

        borderColor: "#ffffff",

        hoverOffset: 12,
      },
    ],
  };

  // =====================================================
  // MONTHLY DATA
  // =====================================================

  const monthlyData = {};

  transactions.forEach(
    (transaction) => {
      const rawDate =
        transaction.transaction_date;

      if (!rawDate) {
        return;
      }

      const date =
        new Date(rawDate);

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

      if (!monthlyData[month]) {
        monthlyData[month] = {
          income: 0,
          expense: 0,
        };
      }

      const amount =
        Number(
          transaction.amount || 0
        );

      const type =
        getTransactionType(
          transaction
        );

      if (type === "income") {
        monthlyData[
          month
        ].income += amount;
      }

      if (type === "expense") {
        monthlyData[
          month
        ].expense += amount;
      }
    }
  );

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
    Object.keys(
      monthlyData
    ).sort(
      (a, b) =>
        monthOrder.indexOf(a) -
        monthOrder.indexOf(b)
    );

  const monthlyChartData = {
    labels: sortedMonths,

    datasets: [
      {
        label: "Income",

        data: sortedMonths.map(
          (month) =>
            monthlyData[month]
              ?.income || 0
        ),

        backgroundColor:
          "#10B981",

        borderRadius: 8,

        borderSkipped: false,

        maxBarThickness: 45,
      },

      {
        label: "Expenses",

        data: sortedMonths.map(
          (month) =>
            monthlyData[month]
              ?.expense || 0
        ),

        backgroundColor:
          "#EF4444",

        borderRadius: 8,

        borderSkipped: false,

        maxBarThickness: 45,
      },
    ],
  };

  // =====================================================
  // FINANCIAL HEALTH
  // =====================================================

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

  // =====================================================
  // DATE FORMAT
  // =====================================================

  const formatDate = (dateValue) => {
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
      return String(dateValue);
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

  // =====================================================
  // AUTH LOADING
  // =====================================================

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

  // =====================================================
  // LOGIN
  // =====================================================

  if (!user) {
    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(
            loggedInUser
          );
        }}
      />
    );
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="app">

      {/* =================================================
          USER PROFILE BAR
      ================================================= */}

      <div className="user-bar">

        <div className="user-info">

          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="user-avatar"
            />
          ) : (
            <div className="user-avatar-placeholder">
              {user.email
                ?.charAt(0)
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
          onClick={() =>
            signOut(auth)
          }
        >
          🚪 Logout
        </button>

      </div>

      {/* =================================================
          BRAND
      ================================================= */}

      <header className="brand-section">

        <div className="brand-icon">
          ₹
        </div>

        <h1>
          FinTrack
        </h1>

        <p className="subtitle">
          Personal Finance Advisor
        </p>

      </header>

      {/* =================================================
          VOICE ASSISTANT
      ================================================= */}

      <section className="advisor-card">

        <div className="advisor-icon">
          🎙️
        </div>

        <h2>
          Voice Financial Assistant
        </h2>

        <p>
          Ask about your balance,
          income, expenses or
          financial advice.
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
            {voiceMessage}
          </div>
        )}

      </section>

      {/* =================================================
          KPI CARDS
      ================================================= */}

      <section className="dashboard">

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
            Balance
          </h3>

          <h2>
            ₹
            {balance.toLocaleString(
              "en-IN"
            )}
          </h2>

          <span className="card-label">
            Available balance
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
            Income saved
          </span>

        </div>

      </section>

      {/* =================================================
          INCOME VS EXPENSES
      ================================================= */}

      <section className="chart-card large-chart">

        <div className="chart-header">

          <div>
            <h3>
              Income vs Expenses
            </h3>

            <p>
              Track your monthly
              cash flow
            </p>
          </div>

          <select
            className="chart-filter"
            defaultValue="Last 6 Months"
          >
            <option>
              Last 6 Months
            </option>

            <option>
              This Year
            </option>
          </select>

        </div>

        <div className="chart-wrapper">

          {sortedMonths.length >
          0 ? (
            <Bar
              data={
                monthlyChartData
              }
              options={{
                responsive: true,

                maintainAspectRatio:
                  false,

                interaction: {
                  mode: "index",
                  intersect: false,
                },

                scales: {
                  y: {
                    beginAtZero: true,

                    ticks: {
                      callback:
                        (value) =>
                          `₹${Number(
                            value
                          ).toLocaleString(
                            "en-IN"
                          )}`,
                    },
                  },
                },

                plugins: {
                  legend: {
                    position: "top",

                    labels: {
                      usePointStyle:
                        true,

                      padding: 20,

                      font: {
                        size: 13,

                        weight:
                          "600",
                      },
                    },
                  },

                  tooltip: {
                    callbacks: {
                      label:
                        function (
                          context
                        ) {
                          return `${context.dataset.label}: ₹${Number(
                            context.parsed.y ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}`;
                        },
                    },
                  },
                },
              }}
            />
          ) : (
            <p className="no-data">
              No transactions yet
            </p>
          )}

        </div>

      </section>

      {/* =================================================
          TWO COLUMN ANALYTICS
      ================================================= */}

      <section className="analytics-grid">

        {/* CATEGORY CHART */}

        <div className="chart-card category-section">

          <div className="chart-header">

            <div>
              <h3>
                Expenses by Category
              </h3>

              <p>
                Where your money is going
              </p>
            </div>

          </div>

          <div className="chart-wrapper">

            {categoryLabels.length >
            0 ? (
              <Doughnut
                data={
                  categoryData
                }
                options={{
                  responsive: true,

                  maintainAspectRatio:
                    false,

                  cutout: "68%",

                  plugins: {
                    legend: {
                      position:
                        "bottom",

                      labels: {
                        usePointStyle:
                          true,

                        pointStyle:
                          "circle",

                        padding: 18,

                        font: {
                          size: 12,

                          weight:
                            "500",
                        },
                      },
                    },

                    tooltip: {
                      callbacks: {
                        label:
                          function (
                            context
                          ) {
                            const value =
                              context.raw ||
                              0;

                            return ` ₹${Number(
                              value
                            ).toLocaleString(
                              "en-IN"
                            )}`;
                          },
                      },
                    },
                  },

                  animation: {
                    animateRotate:
                      true,

                    animateScale:
                      true,

                    duration: 900,
                  },
                }}
              />
            ) : (
              <p className="no-data">
                Add expense transactions
                to see categories.
              </p>
            )}

          </div>

        </div>

        {/* FINANCIAL HEALTH */}

        <div className="health-card">

          <div className="health-header">

            <div>
              <h3>
                Financial Health
              </h3>

              <p>
                Your overall financial
                condition
              </p>
            </div>

            <span className="health-badge">
              {healthTitle}
            </span>

          </div>

          <div className="health-score">

            <div
              className="health-circle"
              style={{
                "--health-progress": `${healthScore * 3.6}deg`,
              }}
            >
              <div className="health-circle-inner">
                <strong>
                  {healthScore}
                </strong>

                <span>
                  / 100
                </span>
              </div>
            </div>

          </div>

          <div className="health-items">

            <div>
              <span>
                Income
              </span>

              <strong>
                ₹
                {totalIncome.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div>
              <span>
                Expenses
              </span>

              <strong>
                ₹
                {totalExpenses.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div>
              <span>
                Savings
              </span>

              <strong>
                {savingsRate}%
              </strong>
            </div>

          </div>

        </div>

      </section>

      {/* =================================================
          AI FINANCIAL ADVISOR
      ================================================= */}

      <section className="ai-advisor">

        <div className="ai-icon">
          🤖
        </div>

        <h2>
          AI Financial Advisor
        </h2>

        <p>
          Get personalized suggestions
          based on your income, expenses
          and spending habits.
        </p>

        <button
          type="button"
          onClick={
            handleGetAdvice
          }
        >
          ✨ Get Financial Advice
        </button>

        {advice && (
          <div className="advice-result">

            <div className="advice-result-title">
              💡 FinTrack Recommendation
            </div>

            <p>
              {advice}
            </p>

          </div>
        )}

      </section>

      {/* =================================================
          ADD TRANSACTION
      ================================================= */}

      <section className="add-transaction">

        <div className="section-heading">

          <div>
            <h2>
              Add Transaction
            </h2>

            <p>
              Record your income or
              expenses
            </p>
          </div>

          <div className="transaction-icon">
            +
          </div>

        </div>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <div className="form-grid">

            <div className="form-group">

              <label>
                Type
              </label>

              <select
                name="type"
                value={
                  form.type
                }
                onChange={
                  handleChange
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
                name="amount"
                value={
                  form.amount
                }
                onChange={
                  handleChange
                }
                placeholder="₹ Enter amount"
                min="0"
                step="0.01"
              />

            </div>

            <div className="form-group">

              <label>
                Category
              </label>

              <input
                type="text"
                name="category"
                value={
                  form.category
                }
                onChange={
                  handleChange
                }
                placeholder="Food, Rent, Salary..."
              />

            </div>

            <div className="form-group">

              <label>
                Date
              </label>

              <input
                type="date"
                name="transaction_date"
                value={
                  form.transaction_date
                }
                onChange={
                  handleChange
                }
              />

            </div>

          </div>

          <div className="form-group">

            <label>
              Description
            </label>

            <textarea
              name="description"
              value={
                form.description
              }
              onChange={
                handleChange
              }
              placeholder="Enter a short description..."
              rows="3"
            />

          </div>

          <button
            type="submit"
            className="save-transaction-button"
          >
            💾 Save Transaction
          </button>

        </form>

        {message && (
          <div className="message">
            {message}
          </div>
        )}

      </section>

      {/* =================================================
          TRANSACTIONS
      ================================================= */}

      <section className="transactions transaction-section">

        <div className="section-heading">

          <div>
            <h2>
              Transactions
            </h2>

            <p>
              Complete history of your
              financial activity
            </p>
          </div>

          <div className="transaction-count">
            {transactions.length}
            <span>
              Transactions
            </span>
          </div>

        </div>

        {transactions.length >
        0 ? (
          <div className="table-container">

            <table>

              <thead>
                <tr>

                  <th>
                    Date
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Action
                  </th>

                </tr>
              </thead>

              <tbody>

                {transactions.map(
                  (transaction) => {
                    const type =
                      getTransactionType(
                        transaction
                      );

                    return (
                      <tr
                        key={
                          transaction.id
                        }
                      >

                        <td>
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </td>

                        <td>

                          <span
                            className={
                              type ===
                              "income"
                                ? "type-badge income-badge"
                                : "type-badge expense-badge"
                            }
                          >
                            {type ===
                            "income"
                              ? "↑ Income"
                              : "↓ Expense"}
                          </span>

                        </td>

                        <td>
                          <span className="category-badge">
                            {transaction.category ||
                              "Other"}
                          </span>
                        </td>

                        <td>
                          {transaction.description ||
                            "No description"}
                        </td>

                        <td
                          className={
                            type ===
                            "income"
                              ? "amount-income"
                              : "amount-expense"
                          }
                        >
                          {type ===
                          "income"
                            ? "+"
                            : "-"}
                          ₹
                          {Number(
                            transaction.amount ||
                              0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td>

                          <button
                            type="button"
                            className="delete-button"
                            onClick={() =>
                              handleDelete(
                                transaction.id
                              )
                            }
                          >
                            🗑 Delete
                          </button>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        ) : (
          <div className="empty-transactions">

            <div>
              💳
            </div>

            <h3>
              No transactions yet
            </h3>

            <p>
              Add your first transaction
              using the form above.
            </p>

          </div>
        )}

      </section>

      {/* =================================================
          QUICK SUMMARY
      ================================================= */}

      <section className="summary-grid">

        <div className="summary-card">

          <span>
            Total Transactions
          </span>

          <strong>
            {transactions.length}
          </strong>

        </div>

        <div className="summary-card">

          <span>
            Average Expense
          </span>

          <strong>
            ₹
            {transactions.length > 0
              ? Math.round(
                  totalExpenses /
                    Math.max(
                      1,
                      transactions.filter(
                        (t) =>
                          getTransactionType(
                            t
                          ) ===
                          "expense"
                      ).length
                    )
                ).toLocaleString(
                  "en-IN"
                )
              : "0"}
          </strong>

        </div>

        <div className="summary-card">

          <span>
            Current Savings
          </span>

          <strong>
            ₹
            {Math.max(
              0,
              balance
            ).toLocaleString(
              "en-IN"
            )}
          </strong>

        </div>

        <div className="summary-card">

          <span>
            Savings Rate
          </span>

          <strong>
            {savingsRate}%
          </strong>

        </div>

      </section>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer className="footer">

        <div className="footer-logo">
          <span>
            ₹
          </span>

          <strong>
            FinTrack
          </strong>
        </div>

        <p>
          Smart personal finance tracking
          and financial guidance.
        </p>

        <span className="footer-copy">
          © {new Date().getFullYear()} FinTrack
        </span>

      </footer>

    </div>
  );
}

export default App;