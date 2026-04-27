# Figure 5.4 - Chat Details Window UI (your existing code)

This document is generated from your current project files. All code blocks below are copied from your repository (no new UI code added).

## Source files used

- `chat_frontend/src/pages/Chat.js` (opens + renders the Chat Details window)
- `chat_frontend/src/index.css` (styles for the Chat Details window and shared items)

---

## 1) Trigger (open Chat Details by tapping the chat header)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
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
```

---

## 2) Chat Details window (overlay + header + sender/receiver info + block/unblock + shared sections)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
      {showContactPanel && selectedUser && (
        <div className="profile-overlay" onClick={() => setShowContactPanel(false)}>
          <div className="profile-card animate__animated animate__zoomIn contact-info-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-card-header">
              <div>
                <p className="profile-eyebrow">Chat Details</p>
                <h3 className="profile-title mb-1">{selectedUser.username}</h3>
                <p className="profile-subtitle mb-0">See phone numbers, shared media, and documents from both sender and receiver.</p>
              </div>
              <button
                type="button"
                className="profile-close-btn"
                onClick={() => setShowContactPanel(false)}
                aria-label="Close contact info"
              >
                x
              </button>
            </div>

            <div className="contact-info-grid">
              <div className="contact-photo-panel">
                {renderAvatar(selectedUser.profilePic, selectedUser.username, 88)}
                <div className="contact-photo-copy">
                  <div className="contact-info-name">{selectedUser.username}</div>
                  <div className="contact-info-value">{selectedUser.bio || "No bio added yet."}</div>
                </div>
              </div>
              <div className="contact-info-section">
                <div className="contact-info-label">Sender</div>
                <div className="contact-info-name">{user?.name || "You"}</div>
                <div className="contact-info-value">{user?.mobile || "No phone number added"}</div>
              </div>
              <div className="contact-info-section">
                <div className="contact-info-label">Receiver</div>
                <div className="contact-info-name">{selectedUser.username}</div>
                <div className="contact-info-value">{selectedUser.mobile || "No phone number added"}</div>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className={blockedByMe ? "btn btn-outline-success" : "btn btn-outline-danger"}
                onClick={handleToggleBlock}
                disabled={blockActionLoading}
              >
                {blockActionLoading ? "Updating..." : blockedByMe ? "Unblock User" : "Block User"}
              </button>
              {conversationBlocked && <span className="badge text-bg-warning align-self-center">{blockNotice}</span>}
            </div>

            <div className="contact-info-section">
              <div className="contact-info-label">Photos and Videos</div>
              {sharedMedia.length === 0 ? (
                <div className="text-muted small">No shared photos or videos yet.</div>
              ) : (
                <>
                  <div className="shared-item-grid">
                    {mediaPreviewItems.map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="shared-item-card">
                        {item.type.startsWith("video") ? (
                          <video src={item.url} className="shared-item-thumb" muted playsInline />
                        ) : (
                          <img src={item.url} alt={item.name} className="shared-item-thumb" />
                        )}
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </a>
                    ))}
                  </div>
                  {sharedMedia.length > 4 && (
                    <button
                      type="button"
                      className="shared-toggle-btn"
                      onClick={() => toggleSharedSection("media")}
                    >
                      {expandedSharedSections.media ? "Show less" : "See more"}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="contact-info-section mt-3">
              <div className="contact-info-label">Audio</div>
              {sharedAudio.length === 0 ? (
                <div className="text-muted small">No shared audio yet.</div>
              ) : (
                <>
                  <div className="shared-document-list">
                    {audioPreviewItems.map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="shared-document-item">
                        <span>{item.name}</span>
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </a>
                    ))}
                  </div>
                  {sharedAudio.length > 4 && (
                    <button
                      type="button"
                      className="shared-toggle-btn"
                      onClick={() => toggleSharedSection("audio")}
                    >
                      {expandedSharedSections.audio ? "Show less" : "See more"}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="contact-info-section mt-3">
              <div className="contact-info-label">Documents and Files</div>
              {sharedDocuments.length === 0 ? (
                <div className="text-muted small">No shared documents yet.</div>
              ) : (
                <>
                  <div className="shared-document-list">
                    {documentPreviewItems.map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="shared-document-item">
                        <span>{item.name}</span>
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </a>
                    ))}
                  </div>
                  {sharedDocuments.length > 4 && (
                    <button
                      type="button"
                      className="shared-toggle-btn"
                      onClick={() => toggleSharedSection("documents")}
                    >
                      {expandedSharedSections.documents ? "Show less" : "See more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
```

---

## 3) Data + handlers used by the Chat Details window (shared items + show more/less + block/unblock)

**File:** `chat_frontend/src/pages/Chat.js`

```jsx
  const blockedByMe = Boolean(selectedUser?.isBlocked);
  const blockedByThem = Boolean(selectedUser?.hasBlockedMe);
  const conversationBlocked = blockedByMe || blockedByThem;
  const blockNotice = blockedByMe
    ? "You blocked this user. Unblock them to send new messages."
    : blockedByThem
      ? "This user blocked you. You can still view old messages, but you cannot send new ones."
      : "";

  const sharedItems = useMemo(
    () =>
      messages
        .filter((msg) => msg.fileUrl || msg.image)
        .map((msg) => {
          const type = msg.fileType || (msg.image ? "image/*" : "");
          const normalizedType = String(type || "").toLowerCase();
          return {
            id: msg._id,
            url: msg.fileUrl || msg.image,
            name: msg.fileName || msg.text || "Shared file",
            type: normalizedType,
            createdAt: msg.createdAt,
            senderLabel: String(msg.senderId) === String(user?._id)
              ? "Sent by you"
              : "Received from " + (selectedUser?.username || "user"),
            category: normalizedType.startsWith("image")
              ? "media"
              : normalizedType.startsWith("video")
                ? "media"
                : normalizedType.startsWith("audio")
                  ? "audio"
                  : "document",
          };
        }),
    [messages, selectedUser?.username, user?._id]
  );

  const sharedMedia = sharedItems.filter((item) => item.category === "media");
  const sharedAudio = sharedItems.filter((item) => item.category === "audio");
  const sharedDocuments = sharedItems.filter((item) => item.category === "document");
  const mediaPreviewItems = expandedSharedSections.media ? sharedMedia : sharedMedia.slice(0, 4);
  const audioPreviewItems = expandedSharedSections.audio ? sharedAudio : sharedAudio.slice(0, 4);
  const documentPreviewItems = expandedSharedSections.documents ? sharedDocuments : sharedDocuments.slice(0, 4);

  useEffect(() => {
    setExpandedSharedSections({
      media: false,
      audio: false,
      documents: false,
    });
  }, [selectedUser?.id, showContactPanel]);

  const toggleSharedSection = useCallback((section) => {
    setExpandedSharedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleToggleBlock = async () => {
    if (!selectedUser?.id || blockActionLoading) return;

    try {
      setBlockActionLoading(true);
      const response = blockedByMe
        ? await unblockUser(selectedUser.id)
        : await blockUser(selectedUser.id);

      setSelectedUser((prev) =>
        prev
          ? {
              ...prev,
              isBlocked: !blockedByMe,
              hasBlockedMe: prev.hasBlockedMe,
            }
          : prev
      );
      setSendError("");
      scheduleUsersRefresh(0);
      if (response?.message) {
        window.alert(response.message);
      }
    } catch (err) {
      setSendError(err.message || "Unable to update block status");
    } finally {
      setBlockActionLoading(false);
    }
  };
```

---

## 4) Styles for the Chat Details window and shared items

**File:** `chat_frontend/src/index.css`

```css
.contact-info-card {
  width: min(760px, calc(100vw - 2rem));
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
}

.contact-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 1rem;
}

.contact-photo-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 16px;
  padding: 14px;
}

.contact-info-section {
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 14px;
}

.shared-item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.shared-item-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #eff6ff;
  border-radius: 14px;
  padding: 10px;
  color: #0f172a;
}

.shared-document-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 12px 14px;
  color: #0f172a;
}

.shared-toggle-btn {
  margin-top: 12px;
  border: 0;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 0.9rem;
  font-weight: 700;
}
```

