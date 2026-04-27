import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import loginArtwork from "../image/images (2).jpeg";
import chattrixLogo from "../image/chattrix-logo.svg";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setDevOtp("");

    try {
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      if (err.requiresVerification) {
        navigate("/signup", {
          state: {
            startVerification: true,
            email: err.email || email,
            info: err.message,
            devOtp: err.devOtp || "",
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

          {devOtp && (
            <div className="alert alert-warning text-center login-error">
              Development OTP: <strong>{devOtp}</strong>
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
