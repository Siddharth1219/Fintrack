import { useState } from "react";
import "./Login.css";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";

import { auth } from "./firebase";

function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleEmailAuth = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      let userCredential;

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      if (onLogin) {
        onLogin(userCredential.user);
      }
    } catch (error) {
      console.error(error);

      switch (error.code) {
        case "auth/email-already-in-use":
          setError("This email is already registered. Please sign in.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/weak-password":
          setError("Password must contain at least 6 characters.");
          break;

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Incorrect email or password.");
          break;

        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;

        default:
          setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");

    try {
      setGoogleLoading(true);

      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      if (onLogin) {
        onLogin(result.user);
      }
    } catch (error) {
      console.error(error);

      if (error.code === "auth/popup-closed-by-user") {
        setError("Google sign-in was cancelled.");
      } else if (error.code === "auth/popup-blocked") {
        setError("Please allow pop-ups in your browser.");
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);

      setSuccess(
        "Password reset email sent. Check your inbox."
      );
    } catch (error) {
      console.error(error);

      if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
    }
  };

  return (
    <div className="login-page">

      {/* LEFT SIDE */}
      <div className="login-brand">

        <div className="brand-content">

          <div className="brand-logo">
            ₹
          </div>

          <h1>FinTrack</h1>

          <p className="brand-tagline">
            Your Personal Financial Advisor
          </p>

          <div className="brand-features">

            <div className="brand-feature">
              <span>📊</span>
              <div>
                <strong>Track Your Money</strong>
                <p>Monitor income and expenses effortlessly.</p>
              </div>
            </div>

            <div className="brand-feature">
              <span>🤖</span>
              <div>
                <strong>AI Financial Advisor</strong>
                <p>Get intelligent insights about your finances.</p>
              </div>
            </div>

            <div className="brand-feature">
              <span>🎯</span>
              <div>
                <strong>Reach Your Goals</strong>
                <p>Build better financial habits and save smarter.</p>
              </div>
            </div>

          </div>

        </div>

        <div className="brand-footer">
          Secure • Smart • Simple
        </div>

      </div>


      {/* RIGHT SIDE */}
      <div className="login-container">

        <div className="login-card">

          <div className="mobile-logo">
            ₹
          </div>

          <h2>
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>

          <p className="login-subtitle">
            {isSignUp
              ? "Start your journey to smarter finances."
              : "Sign in to continue to your FinTrack dashboard."}
          </p>


          {/* GOOGLE BUTTON */}
          <button
            type="button"
            className="google-button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            <span className="google-icon">G</span>

            {googleLoading
              ? "Connecting..."
              : "Continue with Google"}
          </button>


          <div className="divider">
            <span>or continue with email</span>
          </div>


          {/* ERROR */}
          {error && (
            <div className="auth-message auth-error">
              ⚠️ {error}
            </div>
          )}


          {/* SUCCESS */}
          {success && (
            <div className="auth-message auth-success">
              ✓ {success}
            </div>
          )}


          {/* EMAIL FORM */}
          <form onSubmit={handleEmailAuth}>

            <label>Email Address</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />


            <div className="password-label-row">
              <label>Password</label>

              {!isSignUp && (
                <button
                  type="button"
                  className="forgot-button"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                isSignUp ? "new-password" : "current-password"
              }
            />


            <button
              type="submit"
              className="login-button"
              disabled={loading || googleLoading}
            >
              {loading
                ? "Please wait..."
                : isSignUp
                ? "Create Account"
                : "Sign In"}
            </button>

          </form>


          {/* SWITCH LOGIN / SIGNUP */}
          <div className="auth-switch">

            {isSignUp
              ? "Already have an account?"
              : "Don't have an account?"}

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setSuccess("");
              }}
            >
              {isSignUp ? "Sign In" : "Create Account"}
            </button>

          </div>


          <p className="security-note">
            🔒 Your financial data is protected with secure
            authentication.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;