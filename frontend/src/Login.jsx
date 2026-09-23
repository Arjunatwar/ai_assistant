import React, { useEffect, useRef, useState } from "react";
import "./Login.css";

const API = "http://localhost:5000";

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resetStep, setResetStep] = useState(1);

  const googleButtonRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Invalid username or password."
        );
      }

      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // REGISTER
  // --------------------------------------------------

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create account."
        );
      }

      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // FORGOT PASSWORD - SEND OTP
  // --------------------------------------------------

  const handleSendOTP = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to send OTP."
        );
      }

      setSuccess(
        "If an account exists with this email, an OTP has been sent."
      );

      setResetStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (otp.length !== 6) {
        throw new Error("Please enter the 6-digit OTP.");
      }

      const response = await fetch(
        `${API}/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Invalid OTP."
        );
      }

      setSuccess("OTP verified successfully.");

      setResetStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // RESET PASSWORD
  // --------------------------------------------------

  const handleResetPassword = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to reset password."
        );
      }

      setSuccess(
        "Password reset successfully. You can now login."
      );

      setTimeout(() => {
        setMode("login");
        setResetStep(1);

        setEmail("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");

        setSuccess("");
        setError("");
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // GOOGLE LOGIN
  // --------------------------------------------------

  useEffect(() => {
    if (
      mode !== "login" &&
      mode !== "register"
    ) {
      return;
    }

    if (
      !window.google ||
      !googleButtonRef.current
    ) {
      return;
    }

    const clientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.warn(
        "VITE_GOOGLE_CLIENT_ID is missing."
      );
      return;
    }

    googleButtonRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: clientId,

      callback: async (response) => {
        try {
          setLoading(true);
          setError("");

          const result = await fetch(
            `${API}/api/auth/google`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                credential: response.credential,
              }),
            }
          );

          const data = await result.json();

          if (!result.ok) {
            throw new Error(
              data.error || "Google login failed."
            );
          }

          onLogin(data.user);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      {
        theme: "filled_black",
        size: "large",
        width: 360,
        text: "continue_with",
      }
    );
  }, [mode, onLogin]);

  // --------------------------------------------------
  // SWITCH MODES
  // --------------------------------------------------

  const showLogin = () => {
    setMode("login");
    setResetStep(1);

    setError("");
    setSuccess("");

    setEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const showRegister = () => {
    setMode("register");

    setError("");
    setSuccess("");
  };

  const showForgotPassword = () => {
    setMode("forgot");

    setResetStep(1);

    setError("");
    setSuccess("");

    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // --------------------------------------------------
  // FORGOT PASSWORD UI
  // --------------------------------------------------

  if (mode === "forgot") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1>
              {resetStep === 1 &&
                "Forgot Password?"}

              {resetStep === 2 &&
                "Verify OTP"}

              {resetStep === 3 &&
                "Create New Password"}
            </h1>

            <p>
              {resetStep === 1 &&
                "Enter your email and we'll send you a verification code."}

              {resetStep === 2 &&
                `Enter the 6-digit code sent to ${email}.`}

              {resetStep === 3 &&
                "Choose a new password for your account."}
            </p>
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {success && (
            <div className="auth-success">
              {success}
            </div>
          )}

          {/* STEP 1 */}
          {resetStep === 1 && (
            <form
              onSubmit={handleSendOTP}
              className="auth-form"
            >
              <div className="input-group">
                <label>Email</label>

                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading
                  ? "Sending OTP..."
                  : "Send OTP"}
              </button>
            </form>
          )}

          {/* STEP 2 */}
          {resetStep === 2 && (
            <form
              onSubmit={handleVerifyOTP}
              className="auth-form"
            >
              <div className="input-group">
                <label>Verification Code</label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading
                  ? "Verifying..."
                  : "Verify OTP"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setResetStep(1);
                  setOtp("");
                  setError("");
                  setSuccess("");
                }}
              >
                Change Email
              </button>
            </form>
          )}

          {/* STEP 3 */}
          {resetStep === 3 && (
            <form
              onSubmit={handleResetPassword}
              className="auth-form"
            >
              <div className="input-group">
  <label>New Password</label>

  <div className="password-input-wrapper">
    <input
      type={showNewPassword ? "text" : "password"}
      placeholder="Enter new password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      required
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() =>
        setShowNewPassword(!showNewPassword)
      }
      aria-label={
        showNewPassword
          ? "Hide password"
          : "Show password"
      }
    >
      {showNewPassword ? "🙈" : "👁"}
    </button>
  </div>
</div>

              <div className="input-group">
  <label>Confirm Password</label>

  <div className="password-input-wrapper">
    <input
      type={
        showConfirmPassword
          ? "text"
          : "password"
      }
      placeholder="Confirm new password"
      value={confirmPassword}
      onChange={(e) =>
        setConfirmPassword(e.target.value)
      }
      required
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() =>
        setShowConfirmPassword(
          !showConfirmPassword
        )
      }
      aria-label={
        showConfirmPassword
          ? "Hide password"
          : "Show password"
      }
    >
      {showConfirmPassword ? "🙈" : "👁"}
    </button>
  </div>
</div>

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading
                  ? "Resetting..."
                  : "Reset Password"}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <button
              type="button"
              className="link-button"
              onClick={showLogin}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // LOGIN / REGISTER UI
  // --------------------------------------------------

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>
            {mode === "login"
              ? "Welcome Back"
              : "Create Account"}
          </h1>

          <p>
            {mode === "login"
              ? "Login to continue to AI Chat"
              : "Create your AI Chat account"}
          </p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {success && (
          <div className="auth-success">
            {success}
          </div>
        )}

        <form
          onSubmit={
            mode === "login"
              ? handleLogin
              : handleRegister
          }
          className="auth-form"
        >
          {mode === "register" && (
            <div className="input-group">
              <label>Name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Username</label>

            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              required
            />
          </div>

          {mode === "register" && (
            <div className="input-group">
              <label>Email</label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Password</label>

            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {mode === "login" && (
            <div className="forgot-wrapper">
              <button
                type="button"
                className="forgot-button"
                onClick={showForgotPassword}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div
          ref={googleButtonRef}
          className="google-button-container"
        />

        <div className="auth-footer">
          {mode === "login" ? (
            <>
              <span>
                Don't have an account?
              </span>

              <button
                type="button"
                className="link-button"
                onClick={showRegister}
              >
                Create account
              </button>
            </>
          ) : (
            <>
              <span>
                Already have an account?
              </span>

              <button
                type="button"
                className="link-button"
                onClick={showLogin}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;