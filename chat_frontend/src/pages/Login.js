import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import loginArtwork from "../image/images (2).jpeg";
import chattrixLogo from "../image/chattrix-logo.svg";

function Login() {
  const showDevOtps = process.env.NODE_ENV !== "production";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devEmailOtp, setDevEmailOtp] = useState("");
  const [devMobileOtp, setDevMobileOtp] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setDevEmailOtp("");
    setDevMobileOtp("");

    try {
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      if (err.requiresVerification) {
        navigate("/signup", {
          state: {
            startVerification: true,
            email: err.email || email,
            mobile: err.mobile || "",
            emailVerified: Boolean(err.emailVerified),
            mobileVerified: Boolean(err.mobileVerified),
            info: err.message,
            devEmailOtp: err.devEmailOtp || "",
            devMobileOtp: err.devMobileOtp || "",
          },
        });
        return;
      }

      setError(err.message || "Invalid email or password");
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
            <h2 className="login-brand-title">Chattrix</h2>
            <p className="login-brand-copy">Connect with friends and chat instantly.</p>
          </div>
        </section>

        <section className="login-panel">
          <h3 className="login-panel-title">Login</h3>

          {error && (
            <div className="alert alert-danger text-center login-error">
              {error}
            </div>
          )}

          {info && (
            <div className="alert alert-info text-center login-error">
              {info}
            </div>
          )}

          {showDevOtps && devEmailOtp && (
            <div className="alert alert-warning text-center login-error">
              Development Email OTP: <strong>{devEmailOtp}</strong>
            </div>
          )}

          {showDevOtps && devMobileOtp && (
            <div className="alert alert-warning text-center login-error">
              Development Phone OTP: <strong>{devMobileOtp}</strong>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="email"
              className="login-input"
              placeholder="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              className="login-input"
              placeholder="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="login-helper-row">
              <Link to="/forgot-password" className="login-forgot-link">
                Forgot Password?
              </Link>
            </div>

            <button className="login-submit" type="submit">
              Login
            </button>
          </form>

          <p className="login-footer">
            Don't have an account?{" "}
            <Link to="/signup" className="login-link">
              Sign Up
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Login;
