import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import chattrixLogo from "../image/chattrix-logo.svg";
import loginArtwork from "../image/images (2).jpeg";

function ForgotPassword() {
  const {
    requestPasswordResetLink,
  } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleSendLink = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const result = await requestPasswordResetLink(normalizedEmail);
      setInfo(result.message || "A password reset link has been sent to your email.");
    } catch (err) {
      setError(err.message || "Unable to send reset link");
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
            <h2 className="login-brand-title">Recover Access</h2>
            <p className="login-brand-copy">Verify your OTP and set a new password securely.</p>
          </div>
        </section>

        <section className="login-panel">
          <h3 className="login-panel-title">Forgot Password</h3>

          {error && <div className="alert alert-danger text-center login-error">{error}</div>}
          {info && <div className="alert alert-info text-center login-error">{info}</div>}
          <form onSubmit={handleSendLink} className="login-form">
            <input
              type="email"
              className="login-input"
              placeholder="Registered Email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <p className="login-footer">
            Remembered your password?{" "}
            <Link to="/" className="login-link">
              Back to Login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default ForgotPassword;
