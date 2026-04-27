# Figure 5.3 - Main Chat Dashboard UI (your existing code)

This document is generated from your current project files. All code blocks below are copied from your repository (no new UI code added).

## Source files used

- `chat_frontend/src/pages/Chat.js` (main dashboard layout + interactions)
- `chat_frontend/src/components/UserAvatar.js` (avatar rendering used across the UI)
- `chat_frontend/src/index.css` (styling for chat background, header, notifications, profile overlay, etc.)

---

## 1) Top Navbar (App title + status dots + notifications + Menu dropdown)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
  return (
    <div className="chat-bg" data-bs-theme={darkMode ? "dark" : "light"}>
      <nav className="navbar navbar-dark bg-primary px-3 position-relative">
        <h5 className="text-white m-0">Chattrix</h5>

        <div className="d-flex align-items-center ms-3">
          <span
            title={apiConnected ? "API connected" : "API offline"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: apiConnected ? "#22c55e" : "#ef4444",
              marginRight: 4,
            }}
          />
          <span
            title={socketConnected ? "Socket connected" : "Socket offline"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: socketConnected ? "#22c55e" : "#ef4444",
            }}
          />
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="position-relative" ref={notificationMenuRef}>
            <button
              type="button"
              className="nav-notification-btn"
              onClick={() => {
                refreshUsers?.();
                setShowNotifications((prev) => !prev);
              }}
              aria-label="Notifications"
              title={totalUnreadCount > 0 ? `${totalUnreadCount} unread messages` : "No unread messages"}
            >
              <BellIcon />
              {totalUnreadCount > 0 && (
                <span className="nav-notification-badge">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="nav-notification-panel card shadow">
                <div className="nav-notification-panel-head">
                  <span>Notifications</span>
                  <span>{totalUnreadCount} unread</span>
                </div>

                {notificationItems.length === 0 ? (
                  <div className="nav-notification-empty">No new messages</div>
                ) : (
                  <div className="nav-notification-list">
                    {notificationItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="nav-notification-item"
                        onClick={() => handleNotificationClick(item)}
                      >
                        <div className="nav-notification-avatar">
                          {renderAvatar(item.profilePic, item.username, 38)}
                        </div>
                        <div className="nav-notification-copy">
                          <div className="nav-notification-name">{item.username}</div>
                          <div className="nav-notification-meta">
                            {item.unreadCount} new message{item.unreadCount > 1 ? "s" : ""}
                          </div>
                        </div>
                        <span className="nav-notification-pill">{item.unreadCount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="position-relative" ref={navMenuRef}>
            <button className="btn btn-light" onClick={() => setShowMenu(!showMenu)}>
              Menu
            </button>

            {showMenu && (
              <div
                className="card shadow"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "45px",
                  width: "220px",
                  zIndex: 2000,
                }}
              >
                <div className="card-body p-2">
                  <button
                    className="btn btn-sm btn-outline-primary w-100 mb-2"
                    onClick={() => {
                      setShowProfile(true);
                      setShowMenu(false);
                    }}
                  >
                    Profile
                  </button>

                  <button
                    className="btn btn-sm btn-outline-dark w-100 mb-2"
                    onClick={() => setDarkMode(!darkMode)}
                  >
                    {darkMode ? "Light Mode" : "Dark Mode"}
                  </button>

                  <button
                    className="btn btn-sm btn-outline-success w-100 mb-2"
                    onClick={() => navigate("/signup")}
                  >
                    Add Account
                  </button>

                  <button className="btn btn-sm btn-danger w-100" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
```

---

## 2) Profile Overlay (opened from Menu → Profile)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
      {showProfile && (
        <div className="profile-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-card animate__animated animate__zoomIn" onClick={(e) => e.stopPropagation()}>
            <div className="profile-card-header">
              <div>
                <p className="profile-eyebrow">Your Profile</p>
                <h3 className="profile-title">Edit your details</h3>
                <p className="profile-subtitle">Keep your name, photo, and bio up to date.</p>
              </div>
              <button
                type="button"
                className="profile-close-btn"
                onClick={() => setShowProfile(false)}
                aria-label="Close profile card"
              >
                Ã—
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="profile-form-shell">
              <div className="profile-avatar-block">
                <div className="profile-avatar-stage">
                  {renderAvatar(profileImage || user?.profilePic, profileName || user?.name, 96)}
                  <input
                    type="file"
                    accept="image/*"
                    ref={profileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileChangeProfile}
                  />
                  <button
                    type="button"
                    className="profile-photo-btn"
                    onClick={() => profileInputRef.current?.click()}
                  >
                    Change photo
                  </button>
                </div>
              </div>

              <div className="profile-field-group">
                <label className="profile-label">Display Name</label>
                <input
                  className="form-control profile-input"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <div className="profile-field-group">
                <label className="profile-label">About You</label>
                <textarea
                  className="form-control profile-input profile-textarea"
                  rows="4"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Write a short bio"
                />
              </div>
```

---

## 3) Left Panel (Users list + Refresh + Search)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
          <div className="col-12 col-md-3">
            <div className="card p-3 shadow">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="m-0">Users</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => refreshUsers?.()}
                >
                  Refresh
                </button>
              </div>

              <div className="mb-2 mt-2">
                <input
                  type="text"
                  className="form-control rounded-pill"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <ul className="list-group">
                {filteredUsers.length === 0 ? (
                  <li className="list-group-item text-muted">No registered users found.</li>
                ) : (
                  filteredUsers.map((u) => (
                    <li
                      key={u.id}
                      className={`list-group-item d-flex align-items-center justify-content-between ${
                        selectedUser?.id === u.id ? "active" : ""
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          navigate(`/chat/${u.id}`, { state: { selectedUser: u } });
                        } else {
                          setSelectedUser(u);
                        }
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <div className="position-relative me-2" style={{ width: 40, height: 40 }}>
                          {renderAvatar(u.profilePic, u.username, 40)}
                          <span
                            title={u.online ? "Online" : "Offline"}
                            style={{
                              position: "absolute",
                              right: 0,
                              bottom: 0,
                              background: u.online ? "#22c55e" : "#9ca3af",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              border: "2px solid white",
                            }}
                          />
                        </div>
                        <div>
                          {u.username}
                          {u.isBlocked && (
                            <div style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>Blocked</div>
                          )}
                          {!u.isBlocked && u.hasBlockedMe && (
                            <div style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 600 }}>Blocked you</div>
                          )}
                          {u.online && (
                            <div style={{ fontSize: "0.75rem", color: "#22c55e" }}>online</div>
                          )}
                        </div>
                      </div>
```

---

## 4) Right Panel (Chat header + empty state “No messages yet. Say hi!”)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
            ) : (
              <div className="card shadow animate__animated animate__fadeIn chat-main-card">
                <div className="card-header text-white d-flex align-items-center justify-content-between chat-header-bar">
                  <button
                    type="button"
                    className="chat-user-trigger d-flex flex-column text-start"
                    onClick={() => setShowContactPanel(true)}
                  >
                    <div className="d-flex align-items-center">
                      {renderAvatar(selectedUser.profilePic, selectedUser.username, 40)}
                      <span className="ms-2">Chat with {selectedUser.username}</span>
                    </div>
                    {selectedUser.bio && <div className="ms-5 mt-1 text-white small">{selectedUser.bio}</div>}
                    <div className="ms-5 mt-1 text-white small opacity-75">Tap name to view contact details</div>
                    {typingUser && !conversationBlocked && (
                      <div className="ms-5 mt-1 typing-indicator">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span className="ms-2">typing...</span>
                      </div>
                    )}
                  </button>

                  <div className="d-flex align-items-center gap-2">
                    <div style={{ fontSize: "0.85rem", color: selectedUser.online ? "#7cf7b5" : "#d1d5db" }}>
                      {selectedUser.online ? "Online" : "Offline"}
                    </div>
                    <button
                      className="call-action-btn"
                      type="button"
                      onClick={() => startCall("audio")}
                      aria-label="Start audio call"
                      title="Audio call"
                      disabled={conversationBlocked}
                    >
                      <PhoneIcon />
                    </button>
                    <button
                      className="call-action-btn"
                      type="button"
                      onClick={() => startCall("video")}
                      aria-label="Start video call"
                      title="Video call"
                      disabled={conversationBlocked}
                    >
                      <VideoIcon />
                    </button>
                  </div>
                </div>

                <div className="chat-scroll p-3" ref={chatScrollRef}>
                  {initialFetchRef.current && loadingMessages ? (
                    <div className="text-center text-muted">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted">No messages yet. Say hi!</div>
                  ) : (
                    messages.map((msg, idx) => {
```

---

## 5) Message Input (Type message… + Attach + Send)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
                  <div className="input-group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      disabled={conversationBlocked}
                    >
                      Emoji
                    </button>

                    <input
                      type="text"
                      className="form-control"
                      placeholder="Type message..."
                      value={message}
                      onChange={(e) => handleMessageChange(e.target.value)}
                      disabled={conversationBlocked}
                    />

                    <div className="position-relative" ref={attachMenuRef}>
                      <button
                        type="button"
                        className="btn btn-secondary mb-0"
                        onClick={() => setShowAttachOptions((prev) => !prev)}
                        disabled={conversationBlocked}
                      >
                        Attach
                      </button>
                      {showAttachOptions && (
                        <div
                          className="card p-2"
                          style={{
                            position: "absolute",
                            bottom: "40px",
                            left: 0,
                            zIndex: 1000,
                            minWidth: 130,
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={conversationBlocked}
                          >
                            Photo
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={conversationBlocked}
                          >
                            File
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => videoInputRef.current?.click()}
                            disabled={conversationBlocked}
                          >
                            Video
                          </button>
                          <button type="button" className="btn btn-sm btn-light w-100" onClick={() => audioInputRef.current?.click()} disabled={conversationBlocked}>
                            Audio
                          </button>
                        </div>
                      )}
                    </div>

                    <button className="btn btn-primary" onClick={() => handleSend()} disabled={sending || conversationBlocked}>
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
```

---

## 6) Avatar component used throughout the UI

**File:** `chat_frontend/src/components/UserAvatar.js`

```jsx
function UserAvatar({ profilePic, name, size = 40 }) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const [startColor, endColor] = useMemo(() => getPalette(name), [name]);

  if (profilePic && !imageError) {
    return (
      <img
        src={profilePic}
        alt={name || "profile"}
        className="rounded-circle"
        width={size}
        height={size}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="user-avatar-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${startColor}, ${endColor})`,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.max(14, Math.floor(size * 0.38)),
        textTransform: "uppercase",
        boxShadow: "0 10px 20px rgba(15, 23, 42, 0.18)",
        flexShrink: 0,
      }}
      aria-label={name || "profile"}
      title={name || "profile"}
    >
      {initials}
    </div>
  );
}
```

---

## 7) Styles that match the UI (background, cards, notifications, profile overlay, chat header)

**File:** `chat_frontend/src/index.css`

```css
.chat-bg {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(115, 146, 255, 0.28), transparent 28%),
    radial-gradient(circle at bottom right, rgba(100, 255, 218, 0.12), transparent 22%),
    linear-gradient(135deg, #0f172a 0%, #172554 42%, #1e3a8a 100%);
}

.chat-main-card {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.82) !important;
}

.chat-header-bar {
  background: linear-gradient(135deg, #0f766e 0%, #2563eb 100%) !important;
  border-bottom: 0;
}

.nav-notification-btn {
  position: relative;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.profile-overlay {
  position: fixed;
  inset: 0;
  padding: 24px;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.profile-card {
  position: relative;
  width: min(420px, 100%);
  max-height: min(84vh, 680px);
  overflow: auto;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, #fbfdff 0%, #eef4ff 58%, #e8f0ff 100%);
  box-shadow: 0 22px 44px rgba(15, 23, 42, 0.24);
  text-align: left;
}
```
