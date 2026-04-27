import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";

export const AuthContext = createContext();

const API = "http://localhost:5000/api";
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});

  const fetchUsers = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API}/messages/users`, {
        headers: {
          Authorization: authToken,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load users");
      }

      const data = await res.json();
      setUsers(data.users || []);
      setUnseenMessages(data.unseenMessages || {});
    } catch (err) {
      console.warn("Error fetching users:", err);
      setUsers([]);
      setUnseenMessages({});
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken || savedToken === "null" || savedToken === "undefined") {
      localStorage.removeItem("token");
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/auth/check`, {
          headers: {
            Authorization: savedToken,
          },
        });

        if (!res.ok) throw new Error("Not authenticated");

        const data = await res.json();
        setUser(data.user);
        setToken(savedToken);
        await fetchUsers(savedToken);
      } catch (err) {
        console.warn(err);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [fetchUsers]);

  useEffect(() => {
    if (!token) return;
    fetchUsers(token);
  }, [token, fetchUsers]);

  const signup = useCallback(async (username, email, password, mobile, profilePic) => {
    const body = {
      name: username,
      email: normalizeEmail(email),
      password,
      mobile,
      profilePic,
    };

    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Signup failed");
    }

    return data;
  }, []);

  const verifyEmailOtp = useCallback(async (email, otp) => {
    const res = await fetch(`${API}/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email), otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Verification failed");
    }

    setUser(data.user);

    if (data.token) {
      setToken(data.token);
      localStorage.setItem("token", data.token);
      await fetchUsers(data.token);
    } else {
      setToken(null);
      localStorage.removeItem("token");
    }

    return data;
  }, [fetchUsers]);

  const verifyMobileOtp = useCallback(async (mobile, otp) => {
    const res = await fetch(`${API}/auth/verify-mobile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobile, otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Verification failed");
    }

    setUser(data.user);

    if (data.token) {
      setToken(data.token);
      localStorage.setItem("token", data.token);
      await fetchUsers(data.token);
    } else {
      setToken(null);
      localStorage.removeItem("token");
    }

    return data;
  }, [fetchUsers]);

  const resendVerificationOtp = useCallback(async (email) => {
    const res = await fetch(`${API}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to resend verification code");
    }

    return data;
  }, []);

  const resendMobileVerificationOtp = useCallback(async (mobile) => {
    const res = await fetch(`${API}/auth/resend-mobile-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobile }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to resend verification code");
    }

    return data;
  }, []);

  const requestPasswordResetOtp = useCallback(async (email) => {
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to send reset code");
    }
    return data;
  }, []);

  const requestPasswordResetLink = useCallback(async (email) => {
    const res = await fetch(`${API}/auth/forgot-password/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to send reset link");
    }
    return data;
  }, []);

  const resendPasswordResetOtp = useCallback(async (email) => {
    const res = await fetch(`${API}/auth/forgot-password/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to resend reset code");
    }
    return data;
  }, []);

  const verifyPasswordResetOtp = useCallback(async (email, otp) => {
    const res = await fetch(`${API}/auth/verify-reset-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email), otp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to verify OTP");
    }
    return data;
  }, []);

  const resetPassword = useCallback(async (email, otp, password) => {
    const res = await fetch(`${API}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizeEmail(email), otp, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to reset password");
    }
    return data;
  }, []);

  const resetPasswordWithToken = useCallback(async (tokenValue, password) => {
    const res = await fetch(`${API}/auth/reset-password-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: tokenValue, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Unable to reset password");
    }
    return data;
  }, []);

  const login = useCallback(async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || "Login failed");
      err.requiresVerification = Boolean(data.requiresVerification);
      err.email = data.email || normalizedEmail;
      err.mobile = data.mobile || "";
      err.emailVerified = Boolean(data.emailVerified);
      err.mobileVerified = Boolean(data.mobileVerified);
      err.devEmailOtp = data.devEmailOtp || data.devOtp || "";
      err.devMobileOtp = data.devMobileOtp || "";
      throw err;
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("token", data.token);
    await fetchUsers(data.token);
    return true;
  }, [fetchUsers]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setUsers([]);
    localStorage.removeItem("token");
  }, []);

  const refreshUsers = useCallback(async () => {
    await fetchUsers(token);
  }, [fetchUsers, token]);

  const blockUser = useCallback(async (targetUserId) => {
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API}/auth/block/${targetUserId}`, {
      method: "POST",
      headers: { Authorization: token },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Failed to block user");
    }

    setUser(data.user);
    await fetchUsers(token);
    return data;
  }, [token, fetchUsers]);

  const unblockUser = useCallback(async (targetUserId) => {
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API}/auth/block/${targetUserId}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Failed to unblock user");
    }

    setUser(data.user);
    await fetchUsers(token);
    return data;
  }, [token, fetchUsers]);

  const updateProfile = useCallback(async ({ name, bio, profilePic, profilePicFile }) => {
    if (!token) throw new Error("Not authenticated");

    let res;
    if (profilePicFile instanceof Blob) {
      const form = new FormData();
      form.append("name", name || "");
      form.append("bio", bio || "");
      form.append("profilePic", profilePicFile, profilePicFile.name || "profile.jpg");

      res = await fetch(`${API}/auth/update-profile`, {
        method: "PUT",
        headers: {
          Authorization: token,
        },
        body: form,
      });
    } else {
      res = await fetch(`${API}/auth/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ name, bio, profilePic }),
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Failed to update profile");
    }

    setUser(data.user);
    setUsers((prev) =>
      (prev || []).map((u) =>
        String(u._id) === String(data.user?._id) ? data.user : u
      )
    );
    return data.user;
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      users,
      unseenMessages,
      token,
      signup,
      verifyEmailOtp,
      verifyMobileOtp,
      resendVerificationOtp,
      resendMobileVerificationOtp,
      requestPasswordResetOtp,
      requestPasswordResetLink,
      resendPasswordResetOtp,
      verifyPasswordResetOtp,
      resetPassword,
      resetPasswordWithToken,
      login,
      logout,
      loading,
      refreshUsers,
      blockUser,
      unblockUser,
      updateProfile,
    }),
    [user, users, unseenMessages, token, signup, verifyEmailOtp, verifyMobileOtp, resendVerificationOtp, resendMobileVerificationOtp, requestPasswordResetOtp, requestPasswordResetLink, resendPasswordResetOtp, verifyPasswordResetOtp, resetPassword, resetPasswordWithToken, login, logout, loading, refreshUsers, blockUser, unblockUser, updateProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
