import React, { useContext, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import chattrixLogo from "../image/chattrix-logo.svg";
import loginArtwork from "../image/images (2).jpeg";

function ResetPasswordLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPasswordWithToken } = useContext(AuthContext);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);

    try {
      if (!token) {
        throw new Error("Reset link is missing or invalid");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const result = await resetPasswordWithToken(token, password);
      setInfo(result.message || "Password reset successful.");
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(err.message || "Unable to reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-bg login-page d-flex justify-content-center align-items-center">
      <div className="login-shell animate__animated animate__fadeInDown">
        <section className="login-showcase">
          <div className="brand-logo-wrap">
            <img src={chattrixLogo} alt="Chattrix logo" className="brand-logo" />
          </div>
          <div className="login-showcase-art">
            <img src={loginArtwork} alt="Chat illustration" className="login-showcase-image" />
          </div>
          <div className="login-branding">
            <h2 className="login-brand-title">Reset Password</h2>
            <p className="login-brand-copy">Set a new password for your account.</p>
          </div>
        </section>

        <section className="login-panel">
          <h3 className="login-panel-title">Create New Password</h3>

          {error && <div className="alert alert-danger text-center login-error">{error}</div>}
          {info && <div className="alert alert-info text-center login-error">{info}</div>}

          <form onSubmit={handleReset} className="login-form">
            <input
              type="password"
              className="login-input"
              placeholder="New Password"
              value={password}
              minLength={6}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              className="login-input"
              placeholder="Confirm New Password"
              value={confirmPassword}
              minLength={6}
              required
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save New Password"}
            </button>
          </form>

          <p className="login-footer">
            Back to{" "}
            <Link to="/" className="login-link">
              Login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default ResetPasswordLink;
