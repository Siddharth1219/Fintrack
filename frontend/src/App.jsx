import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { onAuthStateChanged, signOut, updatePassword } from "firebase/auth";
import Login from "./Login";
import { auth, storage } from "./firebase";
import { apiRequest as authenticatedRequest } from "./api";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import "./App.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
);

const API_BASE_URL = "http://localhost:5000/api";
const categories = ["Housing", "Food", "Transport", "Shopping", "Health", "Entertainment", "Salary", "Freelance", "Other"];

const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

const compactMoney = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);

const dateLabel = (value) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

async function _legacyApiRequest(endpoint, options = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Authentication required.");
  const token = await currentUser.getIdToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
}

function Icon({ name }) {
  const icons = {
    grid: "▦", activity: "⌁", card: "▣", chart: "◒", spark: "✦", report: "▤", settings: "⚙", logout: "↪",
    plus: "+", search: "⌕", arrow: "↗", mic: "♩", download: "↓", more: "•••", trend: "↗", check: "✓",
  };
  return <span className={`icon icon-${name}`} aria-hidden="true">{icons[name] || "•"}</span>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("This month");
  const [toast, setToast] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [form, setForm] = useState({ type: "expense", amount: "", category: "Food", description: "", transaction_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setAuthLoading(false);
    if (currentUser) {
      authenticatedRequest("/profile")
        .then((result) => {
          if (result.data) {
            setUser((previous) => previous ? {
              ...previous,
              displayName: result.data.name || previous.displayName,
              photoURL: result.data.photo_url || previous.photoURL || "",
            } : previous);
          }
        })
        .catch(() => {});
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    authenticatedRequest("/transactions")
      .then((result) => {
        if (active) { setTransactions(Array.isArray(result.data) ? result.data : []); setUsingDemo(false); }
      })
      .catch((error) => {
        if (active) { setTransactions([]); setUsingDemo(false); setToast(error.message || "Could not load your account transactions."); }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const totals = useMemo(() => transactions.reduce((result, transaction) => {
    const amount = Number(transaction.amount) || 0;
    result[transaction.type === "income" ? "income" : "expense"] += amount;
    return result;
  }, { income: 0, expense: 0 }), [transactions]);
  const balance = totals.income - totals.expense;
  const savingsRate = totals.income ? Math.max(0, Math.round((balance / totals.income) * 100)) : 0;

  const categoryData = useMemo(() => {
    const values = {};
    transactions.filter((item) => item.type === "expense").forEach((item) => { values[item.category || "Other"] = (values[item.category || "Other"] || 0) + Number(item.amount || 0); });
    return Object.entries(values).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const filteredTransactions = useMemo(() => transactions.filter((item) =>
    `${item.description} ${item.category} ${item.type}`.toLowerCase().includes(query.toLowerCase())
  ), [transactions, query]);

  const chartData = useMemo(() => {
    const labels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const income = labels.map((_, index) => Math.round(totals.income * (0.58 + index * 0.07) / 1.8));
    const expense = labels.map((_, index) => Math.round(totals.expense * (0.72 + (index % 3) * 0.08) / 1.5));
    return { labels, datasets: [{ label: "Income", data: income, borderColor: "#16b364", backgroundColor: "rgba(22,179,100,.08)", fill: true, tension: .4, pointRadius: 3 }, { label: "Expenses", data: expense, borderColor: "#ef6b6b", backgroundColor: "rgba(239,107,107,.04)", fill: true, tension: .4, pointRadius: 3 }] };
  }, [totals]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ type: "expense", amount: "", category: "Food", description: "", transaction_date: new Date().toISOString().slice(0, 10) });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ type: item.type, amount: item.amount, category: item.category, description: item.description, transaction_date: String(item.transaction_date).slice(0, 10) });
    setShowModal(true);
  };

  const saveTransaction = async (event) => {
    event.preventDefault();
    if (savingTransaction) return;
    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      setToast("Add a valid amount and description to continue.");
      return;
    }
    const localItem = { ...form, id: editingId || `local-${Date.now()}`, amount: Number(form.amount) };
    setSavingTransaction(true);
    try {
      const result = editingId
        ? await authenticatedRequest(`/transactions/${editingId}`, { method: "PUT", body: JSON.stringify(form) })
        : await authenticatedRequest("/transactions", { method: "POST", body: JSON.stringify(form) });
      if (editingId) setTransactions((items) => items.map((item) => item.id === editingId ? { ...item, ...form } : item));
      else setTransactions((items) => [{ ...(result.data || localItem), id: result.id || localItem.id }, ...items]);
      setShowModal(false);
      setToast(editingId ? "Transaction updated." : "Transaction added.");
      authenticatedRequest("/transactions")
        .then((saved) => setTransactions(Array.isArray(saved.data) ? saved.data : []))
        .catch(() => setToast("Saved successfully. The list will refresh when the connection returns."));
    } catch (error) {
      setToast(error.message || "Could not save this transaction to your account.");
    } finally {
      setSavingTransaction(false);
    }
  };

  const deleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await authenticatedRequest(`/transactions/${id}`, { method: "DELETE" });
    } catch (error) {
      setToast(error.message || "Could not delete this transaction from your account.");
      return;
    }
    setTransactions((items) => items.filter((item) => item.id !== id));
    setToast("Transaction deleted.");
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "transactions", label: "Transactions", icon: "card" },
    { id: "analytics", label: "Analytics", icon: "chart" },
    { id: "advisor", label: "AI Advisor", icon: "spark" },
    { id: "reports", label: "Reports", icon: "report" },
  ];

  if (authLoading) return <div className="loading-screen"><div className="brand-mark">F</div><span>Preparing your workspace...</span></div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><div><strong>fintrack</strong><small>PERSONAL FINANCE</small></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}><Icon name={item.icon} />{item.label}{item.id === "advisor" && <span className="new-pill">NEW</span>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowSettings(true)}><Icon name="settings" />Settings</button><button className="nav-item" onClick={() => signOut(auth)}><Icon name="logout" />Log out</button><div className="sidebar-tip"><span>✦</span><strong>Small steps,<br />big progress.</strong><p>Save 20% of your income this month.</p><div className="progress"><i style={{ width: `${Math.min(savingsRate, 100)}%` }} /></div><small>{savingsRate}% of goal</small></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="mobile-brand"><div className="brand-mark">F</div><strong>fintrack</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications">♢<i /></button><button className="profile profile-button" onClick={() => setShowSettings(true)}><Avatar user={user} /><div><strong>{user.displayName || "Set your name"}</strong><small>{user.email || "Personal account"}</small></div><span>⌄</span></button></div></header>
        <div className="page-wrap">
          {usingDemo && <div className="demo-banner">Preview mode is active because the API is offline. Your changes are kept in this session. <button onClick={() => setUsingDemo(false)}>Dismiss</button></div>}
          <div className="page-heading"><div><p className="eyebrow">SUNDAY, OCTOBER 25, 2026</p><h1>{view === "overview" ? <>Good morning, <em>{(user.displayName || "Alex").split(" ")[0]}.</em></> : navItems.find((item) => item.id === view)?.label}</h1><p className="subheading">{view === "overview" ? "Here’s your financial snapshot for this month." : "Understand your money and make confident decisions."}</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setView("reports")}><Icon name="download" /> Export</button><button className="primary-button" onClick={openAdd}><Icon name="plus" /> Add transaction</button></div></div>

          {view === "overview" && <Overview totals={totals} balance={balance} savingsRate={savingsRate} categoryData={categoryData} chartData={chartData} transactions={transactions} loading={loading} onAdd={openAdd} onViewAll={() => setView("transactions")} />}
          {view === "transactions" && <Transactions items={filteredTransactions} query={query} setQuery={setQuery} onAdd={openAdd} onEdit={openEdit} onDelete={deleteTransaction} />}
          {view === "analytics" && <Analytics totals={totals} categoryData={categoryData} chartData={chartData} savingsRate={savingsRate} period={period} setPeriod={setPeriod} />}
          {view === "advisor" && <Advisor totals={totals} savingsRate={savingsRate} categoryData={categoryData} transactions={transactions} />}
          {view === "reports" && <Reports transactions={transactions} totals={totals} />}
        </div>
      </main>
      {toast && <div className="toast"><Icon name="check" />{toast}</div>}
      {showSettings && <Settings user={user} onClose={() => setShowSettings(false)} onSaved={setUser} />}
      {showModal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !savingTransaction && setShowModal(false)}><form className="transaction-modal" onSubmit={saveTransaction}><div className="modal-header"><div><p className="eyebrow">MONEY MOVEMENT</p><h2>{editingId ? "Edit transaction" : "Add transaction"}</h2></div><button type="button" className="close-button" disabled={savingTransaction} onClick={() => setShowModal(false)}>×</button></div><div className="type-toggle"><button type="button" className={form.type === "expense" ? "selected expense" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Expense</button><button type="button" className={form.type === "income" ? "selected income" : ""} onClick={() => setForm({ ...form, type: "income" })}>Income</button></div><label>Amount<input autoFocus type="number" min="0.01" step="0.01" placeholder="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><div className="form-grid"><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Date<input type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></label></div><label>Description<input placeholder="What was this for?" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><button className="primary-button full-button" type="submit" disabled={savingTransaction}>{savingTransaction ? "Saving transaction..." : editingId ? "Save changes" : "Add transaction"}</button></form></div>}
    </div>
  );
}

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#142b25", padding: 12, cornerRadius: 10 } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: "#91a29d", font: { size: 11 } } }, y: { grid: { color: "#edf1ef" }, border: { display: false }, ticks: { color: "#91a29d", font: { size: 11 }, callback: (value) => `₹${Number(value) / 1000}k` } } } };

function Avatar({ user, large = false }) {
  return user.photoURL
    ? <img className={large ? "avatar avatar-large" : "avatar"} src={user.photoURL} alt={user.displayName || "Profile"} />
    : <div className={large ? "avatar avatar-large" : "avatar"}>{(user.displayName || user.email || "A").charAt(0).toUpperCase()}</div>;
}

function Settings({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.displayName || "");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const profileName = name.trim();
      if (!profileName) throw new Error("Profile name is required.");
      let photoURL = user.photoURL || "";
      await authenticatedRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({ name: profileName, photoUrl: photoURL }),
      });
      let photoError = "";
      if (photo) {
        try {
          const photoRef = ref(storage, `profile-photos/${user.uid}`);
          const upload = uploadBytes(photoRef, photo);
          await Promise.race([
            upload,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Photo upload timed out.")), 10000)),
          ]);
          photoURL = await getDownloadURL(photoRef);
          await authenticatedRequest("/profile", {
            method: "PUT",
            body: JSON.stringify({ name: profileName, photoUrl: photoURL }),
          });
        } catch (photoSaveError) {
          photoError = photoSaveError.code === "storage/unauthorized"
            ? " Photo was not uploaded because Firebase Storage permissions rejected it."
            : ` Photo upload failed: ${photoSaveError.message}`;
        }
      }
      if (password) {
        if (password.length < 6) throw new Error("New password must contain at least 6 characters.");
        await updatePassword(user, password);
      }
      onSaved({ ...user, displayName: profileName, photoURL });
      setPassword("");
      setPhoto(null);
      setMessage(`Your profile and security settings were saved.${photoError}`);
    } catch (saveError) {
      setError(saveError.code === "auth/requires-recent-login"
        ? "For security, sign out and sign in again before changing your password."
        : saveError.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="settings-modal" onSubmit={saveProfile}><div className="modal-header"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h2>Your profile</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></div><div className="profile-preview"><Avatar user={{ ...user, photoURL: photo ? URL.createObjectURL(photo) : user.photoURL, displayName: name }} large /><div><strong>{name || "Your name"}</strong><small>{user.email}</small></div></div><label>Profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label><label>Profile name<input value={name} maxLength="80" onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></label><div className="settings-divider"><span>Security</span></div><label>New password <small>(leave blank to keep current)</small><input type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>{error && <div className="auth-message auth-error">{error}</div>}{message && <div className="auth-message auth-success">{message}</div>}<button className="primary-button full-button" disabled={saving}>{saving ? "Saving securely..." : "Save profile changes"}</button></form></div>;
}

function StatCard({ label, value, note, tone, icon }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-meta"><span>{label}</span><strong>{value}</strong><small className={tone === "red" ? "negative" : "positive"}>{tone === "red" ? "↓" : "↑"} {note}</small></div><button className="card-menu">•••</button></div>;
}

function Overview({ totals, balance, savingsRate, categoryData, chartData, transactions, loading, onAdd, onViewAll }) {
  const recent = transactions.slice(0, 5);
  const doughnut = { labels: categoryData.map(([name]) => name), datasets: [{ data: categoryData.map(([, value]) => value), backgroundColor: ["#1e8471", "#f7b955", "#ef6b6b", "#7396c8", "#9c7ac5", "#a5b7b2"], borderWidth: 0 }] };
  return <div className="view-stack"><div className="stat-grid"><StatCard label="Total balance" value={money(balance)} note="12.8% vs last month" tone="green" icon="₹" /><StatCard label="Income" value={money(totals.income)} note="8.4% vs last month" tone="blue" icon="↗" /><StatCard label="Expenses" value={money(totals.expense)} note="3.2% vs last month" tone="red" icon="↘" /><StatCard label="Savings rate" value={`${savingsRate}%`} note="On track this month" tone="yellow" icon="◌" /></div><div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Cash flow</h2><p>Income vs expenses</p></div><select><option>This year</option><option>This month</option></select></div><div className="chart-wrap line-chart"><Line data={chartData} options={chartOptions} /></div><div className="legend-row"><span><i className="dot green-dot" />Income</span><span><i className="dot red-dot" />Expenses</span><strong>Net cash flow <em>{compactMoney(balance)}</em></strong></div></section><section className="panel spending-panel"><div className="panel-heading"><div><h2>Spending breakdown</h2><p>Where your money goes</p></div><button className="text-button">Details ↗</button></div>{categoryData.length ? <div className="donut-area"><div className="donut-chart"><Doughnut data={doughnut} options={{ cutout: "72%", plugins: { legend: { display: false } } }} /><div><strong>{compactMoney(totals.expense)}</strong><small>total spent</small></div></div><div className="category-list">{categoryData.slice(0, 4).map(([name, value], index) => <div className="category-row" key={name}><span><i className={`dot category-${index}`} />{name}</span><strong>{money(value)}</strong></div>)}</div></div> : <EmptyState text="Add expenses to see your breakdown." />}</section></div><div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest money movements</p></div><button className="text-button" onClick={onViewAll}>View all ↗</button></div>{loading ? <div className="skeleton-list">{[1, 2, 3].map((item) => <div key={item} className="skeleton" />)}</div> : recent.length ? <TransactionList items={recent} /> : <EmptyState text="No transactions yet." action={onAdd} />}</section><section className="panel goal-panel"><div className="panel-heading"><div><h2>Monthly goal</h2><p>Build your emergency fund</p></div><span className="goal-emoji">♧</span></div><div className="goal-amount"><strong>{money(Math.max(balance, 0))}</strong><span>of ₹5,00,000</span></div><div className="goal-progress"><i style={{ width: `${Math.min((Math.max(balance, 0) / 500000) * 100, 100)}%` }} /></div><div className="goal-footer"><span>{Math.min(Math.round((Math.max(balance, 0) / 500000) * 100), 100)}% complete</span><button onClick={onAdd}>+ Add savings</button></div><div className="goal-quote">“Financial freedom is built one good decision at a time.”</div></section></div></div>;
}

function TransactionList({ items, onEdit, onDelete }) {
  return <div className="transaction-list">{items.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-symbol ${item.type}`}>{item.type === "income" ? "↗" : item.category?.charAt(0) || "•"}</div><div className="transaction-info"><strong>{item.description}</strong><span>{item.category} · {dateLabel(item.transaction_date)}</span></div><strong className={`transaction-amount ${item.type}`}>{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong>{onEdit && <div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button onClick={() => onDelete(item.id)}>Delete</button></div>}</div>)}</div>;
}

function Transactions({ items, query, setQuery, onAdd, onEdit, onDelete }) {
  return <div className="panel transactions-panel"><div className="toolbar"><div className="search-box"><Icon name="search" /><input placeholder="Search transactions..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><select><option>All types</option><option>Income</option><option>Expense</option></select><select><option>All time</option><option>This month</option></select></div><div className="table-header"><span>TRANSACTION</span><span>DATE</span><span>TYPE</span><span>AMOUNT</span><span /></div><div className="full-transaction-list">{items.length ? items.map((item) => <div className="table-row" key={item.id}><div className="transaction-info"><div className={`transaction-symbol ${item.type}`}>{item.type === "income" ? "↗" : item.category?.charAt(0) || "•"}</div><span><strong>{item.description}</strong><small>{item.category}</small></span></div><span>{dateLabel(item.transaction_date)}</span><span className={`type-label ${item.type}`}>{item.type}</span><strong className={`transaction-amount ${item.type}`}>{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong><div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button onClick={() => onDelete(item.id)}>Delete</button></div></div>) : <EmptyState text="No matching transactions." action={onAdd} />}</div><button className="primary-button floating-add" onClick={onAdd}><Icon name="plus" /> Add transaction</button></div>;
}

function Analytics({ totals, categoryData, chartData, savingsRate, period, setPeriod }) {
  const barData = { labels: categoryData.slice(0, 6).map(([name]) => name), datasets: [{ label: "Spend", data: categoryData.slice(0, 6).map(([, value]) => value), backgroundColor: "#1e8471", borderRadius: 6, barThickness: 25 }] };
  return <div className="view-stack"><div className="analytics-controls"><div><h2>Financial health score <span className="score">82 / 100</span></h2><p>You’re building strong, consistent habits.</p></div><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>This month</option><option>Last 3 months</option><option>This year</option></select></div><div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Income & spending trend</h2><p>Track momentum over time</p></div></div><div className="chart-wrap large-chart"><Line data={chartData} options={chartOptions} /></div></section><section className="panel"><div className="panel-heading"><div><h2>Top categories</h2><p>Your biggest spending areas</p></div></div><div className="chart-wrap bar-chart"><Bar data={barData} options={{ ...chartOptions, indexAxis: "y", scales: { x: { grid: { color: "#edf1ef" }, border: { display: false }, ticks: { callback: (value) => `₹${Number(value) / 1000}k` } }, y: { grid: { display: false }, border: { display: false } } } }} /></div></section></div><div className="insight-grid"><div className="insight-card green"><span>✦</span><div><strong>Savings momentum</strong><p>Your {savingsRate}% savings rate is {savingsRate >= 20 ? "above" : "close to"} the recommended 20% target.</p></div></div><div className="insight-card amber"><span>!</span><div><strong>Watch your spend</strong><p>{categoryData[0]?.[0] || "Your top category"} is your largest category at {money(categoryData[0]?.[1] || 0)}.</p></div></div><div className="insight-card blue"><span>↗</span><div><strong>Net worth trend</strong><p>Your available balance is {money(totals.income - totals.expense)} this period.</p></div></div></div></div>;
}

function Advisor({ totals, savingsRate, categoryData, transactions }) {
  const topCategory = categoryData[0]?.[0] || "daily spending";
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const askAdvisor = (event) => {
    event.preventDefault();
    const lower = question.toLowerCase();
    const foodTotal = transactions.filter((item) => item.type === "expense" && item.category?.toLowerCase().includes("food")).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (lower.includes("food")) setAnswer(`You spent ${money(foodTotal)} on food across ${transactions.filter((item) => item.category?.toLowerCase().includes("food")).length} transaction(s).`);
    else if (lower.includes("afford") || lower.includes("balance")) setAnswer(`Your current account balance is ${money(totals.income - totals.expense)}. Keep at least 20% of income untouched before planning a new purchase.`);
    else if (lower.includes("save")) setAnswer(`Your savings rate is ${savingsRate}%. A practical next step is to automate ${money(Math.max(0, totals.income * 0.2))} after every payday.`);
    else setAnswer(`Based on your data, ${topCategory} is your largest spending category. Ask about food, balance, or saving for a more specific answer.`);
  };
  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setHeard("Voice input is not supported in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setHeard("I couldn't hear that. Please try again."); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setHeard(`I heard: “${transcript}”`);
      setQuestion(transcript);
      setAnswer("");
    };
    recognition.start();
  };
  return <div className="advisor-layout"><section className="advisor-hero"><div className="advisor-orb">✦</div><div><p className="eyebrow">FINTRACK INTELLIGENCE</p><h2>Your money, made clearer.</h2><p>I’ve reviewed your saved transactions and prepared practical next steps for you.</p></div></section><form className="advisor-question" onSubmit={askAdvisor}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask: How much did I spend on food?" /><button className="primary-button">Ask advisor</button>{answer && <p className="advisor-answer">{answer}</p>}</form><div className="advice-grid"><div className="advice-card featured"><div className="advice-label"><span>✦</span> TODAY’S INSIGHT</div><h3>Protect your progress</h3><p>Your savings rate is <strong>{savingsRate}%</strong>. Try moving {money(Math.max(0, totals.income * 0.2))} to savings on payday so your progress becomes automatic.</p><button type="button" className="primary-button" onClick={() => setQuestion("How can I save more?")}>Make a plan ↗</button></div><div className="advice-card"><div className="advice-icon">◌</div><h3>Reduce your biggest leak</h3><p>{topCategory} is currently your largest expense category. Setting a weekly limit could save you {money(Math.round((categoryData[0]?.[1] || 0) * .12))} next month.</p><button type="button" className="link-button" onClick={() => setQuestion(`How can I reduce ${topCategory}?`)}>View category →</button></div><div className="advice-card"><div className="advice-icon">♧</div><h3>Build your safety net</h3><p>With {money(totals.income)} in income, aim for an emergency fund of three months of essentials.</p><button type="button" className="link-button" onClick={() => setQuestion("How much should I save?")}>Set a goal →</button></div></div><section className="voice-card"><div className="voice-icon"><Icon name="mic" /></div><div><h3>Ask Fintrack anything</h3><p>{heard || "Try “How much did I spend on food this month?” or “Can I afford a weekend trip?”"}</p></div><button type="button" className="secondary-button" onClick={startListening}><Icon name="mic" /> {listening ? "Listening..." : "Start talking"}</button></section></div>;
}

function Reports({ transactions, totals }) {
  const downloadReport = () => {
    const rows = [["Description", "Type", "Category", "Amount", "Date"], ...transactions.map((item) => [item.description, item.type, item.category, item.amount, item.transaction_date])];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fintrack-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="reports-layout"><section className="report-hero"><div><p className="eyebrow">MONTHLY REPORT · OCTOBER 2026</p><h2>Your financial story, at a glance.</h2><p>Review, learn, and use your momentum to make next month even better.</p></div><button className="primary-button" onClick={downloadReport}><Icon name="download" /> Download CSV</button></section><div className="report-stats"><div><span>Income</span><strong>{money(totals.income)}</strong><small className="positive">↑ 8.4%</small></div><div><span>Spent</span><strong>{money(totals.expense)}</strong><small className="negative">↓ 3.2%</small></div><div><span>Net savings</span><strong>{money(totals.income - totals.expense)}</strong><small className="positive">↑ Healthy</small></div><div><span>Transactions</span><strong>{transactions.length}</strong><small>this month</small></div></div><section className="panel report-table"><div className="panel-heading"><div><h2>Report history</h2><p>Your downloadable monthly summaries</p></div></div>{["October 2026", "September 2026", "August 2026"].map((month) => <div className="report-row" key={month}><span className="file-icon">▤</span><div><strong>{month} financial report</strong><small>Income, expenses, and category breakdown</small></div><span className="report-status">Ready</span><button className="icon-button" onClick={downloadReport}><Icon name="download" /></button></div>)}</section></div>;
}

function EmptyState({ text, action }) {
  return <div className="empty-state"><span>◌</span><p>{text}</p>{action && <button className="text-button" onClick={action}>Add your first transaction →</button>}</div>;
}

export default App;
