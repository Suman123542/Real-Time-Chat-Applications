import React, { useState, useContext } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import signupArtwork from "../image/images (2).jpeg";
import chattrixLogo from "../image/chattrix-logo.svg";

function Signup() {
  const location = useLocation();
  const verificationState = location.state || {};
  const showDevOtps = process.env.NODE_ENV !== "production";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [profileFileName, setProfileFileName] = useState("");
  const [otp, setOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(verificationState.email || "");
  const [pendingMobile, setPendingMobile] = useState(verificationState.mobile || "");
  const [devOtp, setDevOtp] = useState(verificationState.devEmailOtp || verificationState.devOtp || "");
  const [devMobileOtp, setDevMobileOtp] = useState(verificationState.devMobileOtp || "");
  const [verificationStep, setVerificationStep] = useState(Boolean(verificationState.startVerification));
  const [emailVerified, setEmailVerified] = useState(Boolean(verificationState.emailVerified));
  const [mobileVerified, setMobileVerified] = useState(Boolean(verificationState.mobileVerified));
  const [info, setInfo] = useState(verificationState.info || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signup, verifyEmailOtp, verifyMobileOtp, resendVerificationOtp, resendMobileVerificationOtp } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleImage = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      setProfilePic(reader.result);
    };

    if (file) {
      setProfileFileName(file.name);
      reader.readAsDataURL(file);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    setDevOtp("");
    setDevMobileOtp("");
    setEmailVerified(false);
    setMobileVerified(false);
    setBusy(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mobile.length !== 10) {
        throw new Error("Mobile number must be exactly 10 digits");
      }

      const result = await signup(username.trim(), normalizedEmail, password, mobile, profilePic);
      setPendingEmail(result.email || normalizedEmail);
      setPendingMobile(result.mobile || mobile);
      setVerificationStep(true);
      setInfo(result.message || "A verification code has been sent to your email.");
      setDevOtp(result.devEmailOtp || result.devOtp || "");
      setDevMobileOtp(result.devMobileOtp || "");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);

    try {
      const result = await verifyEmailOtp(pendingEmail, otp);
      setEmailVerified(true);
      setOtp("");

      if (result?.token) {
        navigate("/chat");
        return;
      }

      setInfo(result?.message || "Email verified. Please verify your phone.");
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMobile = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);

    try {
      const result = await verifyMobileOtp(pendingMobile, mobileOtp);
      setMobileVerified(true);
      setMobileOtp("");

      if (result?.token) {
        navigate("/chat");
        return;
      }

      setInfo(result?.message || "Phone verified. Please verify your email.");
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);

    try {
      const result = await resendVerificationOtp(pendingEmail);
      setInfo(result.message || "A new verification code has been sent to your email.");
      setDevOtp(result.devEmailOtp || result.devOtp || "");
    } catch (err) {
      setError(err.message || "Unable to resend code");
    } finally {
      setBusy(false);
    }
  };

  const handleResendMobile = async () => {
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);

    try {
      const result = await resendMobileVerificationOtp(pendingMobile);
      setInfo(result.message || "A new verification code has been sent to your phone.");
      setDevMobileOtp(result.devMobileOtp || "");
    } catch (err) {
      setError(err.message || "Unable to resend code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-bg signup-page d-flex justify-content-center align-items-center">
      <div className="signup-shell animate__animated animate__fadeInDown">
        <section className="signup-showcase">
          <div className="brand-logo-wrap">
            <img src={chattrixLogo} alt="Chattrix logo" className="brand-logo" />
          </div>
          <div className="signup-showcase-art">
            <img src={signupArtwork} alt="Chat illustration" className="signup-showcase-image" />
          </div>
          <div className="signup-branding">
            <h2 className="signup-brand-title">Chattrix</h2>
            <p className="signup-brand-copy">Create your account and start chatting instantly.</p>
          </div>
        </section>

        <section className="signup-panel">
          <h3 className="signup-panel-title">{verificationStep ? "Verify Your Account" : "Signup"}</h3>

          {error && (
            <div className="alert alert-danger text-center signup-error">
              {error}
            </div>
          )}

          {info && (
            <div className="alert alert-info text-center signup-error">
              {info}
            </div>
          )}

          {showDevOtps && devOtp && (
            <div className="alert alert-warning text-center signup-error">
              Development Email OTP: <strong>{devOtp}</strong>
            </div>
          )}
          {showDevOtps && devMobileOtp && (
            <div className="alert alert-warning text-center signup-error">
              Development Phone OTP: <strong>{devMobileOtp}</strong>
            </div>
          )}

          {!verificationStep ? (
            <form onSubmit={handleSignup} className="signup-form">
              <input
                type="text"
                className="signup-input"
                placeholder="Username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <input
                type="email"
                className="signup-input"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="tel"
                className="signup-input"
                placeholder="Mobile Number"
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />

              <input
                type="password"
                className="signup-input"
                placeholder="Password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <label className="signup-file-field">
                <div className="signup-file-preview" aria-hidden="true">
                  {profilePic ? (
                    <img src={profilePic} alt="Selected profile" className="signup-file-preview-image" />
                  ) : (
                    <span className="signup-file-preview-placeholder">+</span>
                  )}
                </div>
                <div className="signup-file-copy">
                  <span className="signup-file-title">Profile picture</span>
                  <span className="signup-file-name">
                    {profileFileName || "Upload a clear photo for your account"}
                  </span>
                </div>
                <span className="signup-file-button">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                />
              </label>

              <button className="signup-submit" type="submit">
                {busy ? "Please wait..." : "Create Account"}
              </button>
            </form>
          ) : (
            <>
              {emailVerified ? (
                <div className="alert alert-success text-center signup-error">Email verified.</div>
              ) : (
                <form onSubmit={handleVerify} className="signup-form">
                  <div className="signup-helper-text">
                    Enter the 6-digit code sent to <strong>{pendingEmail}</strong>
                  </div>

                  <input
                    type="text"
                    className="signup-input"
                    placeholder="Email OTP"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />

                  <button className="signup-submit" type="submit">
                    {busy ? "Verifying..." : "Verify Email"}
                  </button>

                  <button className="signup-secondary-btn" type="button" onClick={handleResend} disabled={busy}>
                    {busy ? "Please wait..." : "Resend Email Code"}
                  </button>
                </form>
              )}

              {mobileVerified ? (
                <div className="alert alert-success text-center signup-error">Phone verified.</div>
              ) : (
                <form onSubmit={handleVerifyMobile} className="signup-form">
                  <div className="signup-helper-text">
                    Enter the 6-digit code sent to <strong>{pendingMobile}</strong>
                  </div>

                  <input
                    type="text"
                    className="signup-input"
                    placeholder="Phone OTP"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />

                  <button className="signup-submit" type="submit">
                    {busy ? "Verifying..." : "Verify Phone"}
                  </button>

                  <button className="signup-secondary-btn" type="button" onClick={handleResendMobile} disabled={busy}>
                    {busy ? "Please wait..." : "Resend Phone Code"}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="signup-footer">
            Already have an account?{" "}
            <Link to="/" className="signup-link">
              Login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Signup;
