import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import MobileChat from "./pages/MobileChat";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordLink from "./pages/ResetPasswordLink";
import { AuthProvider, AuthContext } from "./context/AuthContext";

function PrivateRoute({ children }) {
  return (
    <AuthContext.Consumer>
      {({ user, loading }) =>
        loading ? (
          <div style={{ color: "white", textAlign: "center", marginTop: "2rem" }}>
            Checking session...
          </div>
        ) : user ? (
          children
        ) : (
          <Navigate to="/" />
        )
      }
    </AuthContext.Consumer>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPasswordLink />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route
            path="/chat/:chatUserId"
            element={
              <PrivateRoute>
                <MobileChat />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
