import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import UserAvatar from "../components/UserAvatar";

const PhoneIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.32.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.19 2.45.56 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2Z" fill="currentColor" />
  </svg>
);

const VideoIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8Zm6.5 1.5-3.5 2.8v-.6a2 2 0 0 0-2-2v4.6a2 2 0 0 0 2-2v-.6l3.5 2.8a.9.9 0 0 0 1.5-.7v-3.9a.9.9 0 0 0-1.5-.7Z" fill="currentColor" />
  </svg>
);

const BellIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3a4 4 0 0 0-4 4v1.1c0 .7-.2 1.38-.58 1.96L6.2 11.9A3 3 0 0 0 8.7 16.5h6.6a3 3 0 0 0 2.5-4.6l-1.22-1.84A3.5 3.5 0 0 1 16 8.1V7a4 4 0 0 0-4-4Z" fill="currentColor"/>
    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
function Chat() {
  const API = "http://localhost:5000/api";
  const SOCKET_URL = "http://localhost:5000";

  const {
    user,
    users,
    unseenMessages,
    token,
    logout,
    refreshUsers,
    blockUser,
    unblockUser,
    updateProfile,
  } = useContext(AuthContext);

  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [file, setFile] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [activeMessageActionsId, setActiveMessageActionsId] = useState(null);

  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const [expandedSharedSections, setExpandedSharedSections] = useState({
    media: false,
    audio: false,
    documents: false,
  });

  const [callState, setCallState] = useState({
    active: false,
    type: null,
    muted: false,
    videoEnabled: true,
    startedAt: null,
  });
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callError, setCallError] = useState("");

  const chatScrollRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const allUsersRef = useRef([]);
  const callStateRef = useRef(callState);
  const disconnectTimerRef = useRef(null);
  const selectedUserRef = useRef(null);
  const messagesRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const messageActionLongPressRef = useRef(null);
  const profileInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const initialFetchRef = useRef(true);
  const lastLoadedRef = useRef(null);
  const refreshUsersTimerRef = useRef(null);
  const profilePreviewUrlRef = useRef(null);
  const navMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const attachMenuRef = useRef(null);
  const notificationAudioRef = useRef(null);

  const scheduleUsersRefresh = useCallback((delay = 250) => {
    if (!refreshUsers) return;
    if (refreshUsersTimerRef.current) {
      clearTimeout(refreshUsersTimerRef.current);
    }
    refreshUsersTimerRef.current = setTimeout(() => {
      refreshUsers?.();
      refreshUsersTimerRef.current = null;
    }, delay);
  }, [refreshUsers]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new AudioContextClass();
      }

      const context = notificationAudioRef.current;
      const startTone = (frequency, startAt, duration, volume) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
      };

      const playBeep = () => {
        const baseTime = context.currentTime + 0.01;
        startTone(880, baseTime, 0.18, 0.24);
        startTone(660, baseTime + 0.2, 0.22, 0.22);
      };

      if (context.state === "suspended") {
        context.resume().then(playBeep).catch(() => {});
        return;
      }

      playBeep();
    } catch (err) {
      console.warn("Notification sound failed:", err);
    }
  }, []);

  const markOpenChatMessageSeen = useCallback(async (messageId) => {
    if (!token || !messageId) return;
    try {
      await fetch(`${API}/messages/mark/${messageId}`, {
        headers: { Authorization: token },
      });
      scheduleUsersRefresh(0);
    } catch (err) {
      console.warn("Unable to mark message as seen:", err);
    }
  }, [API, token, scheduleUsersRefresh]);

  const formatTime = (time) => {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (time) => {
    if (!time) return "";
    const messageDate = new Date(time);
    const now = new Date();
    const startOfMessageDay = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate()
    );
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.floor(
      (startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff < 7) {
      return messageDate.toLocaleDateString([], { weekday: "long" });
    }
    return messageDate.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderAvatar = (profilePic, name, size = 40) => (
    <UserAvatar profilePic={profilePic} name={name} size={size} />
  );

  const showMessageActions = (id) => {
    setActiveMessageActionsId(id);
  };

  const clearMessageActionPress = () => {
    if (messageActionLongPressRef.current) {
      clearTimeout(messageActionLongPressRef.current);
      messageActionLongPressRef.current = null;
    }
  };

  const startMessageActionPress = (id) => {
    clearMessageActionPress();
    messageActionLongPressRef.current = setTimeout(() => {
      setActiveMessageActionsId(id);
      messageActionLongPressRef.current = null;
    }, 450);
  };

  const hideMessageActions = (id) => {
    setActiveMessageActionsId((prev) => (prev === id ? null : prev));
  };

  const getMessageStatus = (msg) => {
    const isMine = String(msg.senderId) === String(user?._id);
    if (!isMine) return "";
    if (msg.seen) return "seen";
    if (selectedUser?.online) return "delivered";
    return "sent";
  };

  const emojiList = [
    "\u{1F600}",
    "\u{1F602}",
    "\u{1F60D}",
    "\u{1F60E}",
    "\u{1F44D}",
    "\u{1F64F}",
    "\u{1F525}",
    "\u{1F389}",
    "\u2764\uFE0F",
    "\u{1F91D}",
    "\u{1F622}",
    "\u{1F621}",
    "\u{1F634}",
    "\u{1F914}",
    "\u{1F44F}",
  ];

  const allUsers = useMemo(
    () =>
      (users || [])
        .filter((u) => String(u._id) !== String(user?._id))
        .map((u) => ({
          id: u._id,
          username: u.name,
          profilePic: u.profilePic,
          online: onlineUserIds.includes(String(u._id)),
          bio: u.bio || "",
          mobile: u.mobile || "",
          lastMessageAt: u.lastMessageAt || null,
        }))
        .sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          }
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          return a.username.localeCompare(b.username);
        }),
    [users, user?._id, onlineUserIds]
  );

  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnreadCount = useMemo(
    () => Object.values(unseenMessages || {}).reduce((sum, count) => sum + Number(count || 0), 0),
    [unseenMessages]
  );
  const notificationItems = useMemo(
    () =>
      allUsers
        .filter((u) => Number(unseenMessages?.[u.id] || 0) > 0)
        .map((u) => ({
          ...u,
          unreadCount: Number(unseenMessages?.[u.id] || 0),
        })),
    [allUsers, unseenMessages]
  );

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const cleanupCall = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState({
      active: false,
      type: null,
      muted: false,
      videoEnabled: true,
      startedAt: null,
    });
  }, []);

  const ensurePeer = useCallback((targetUserId, callType) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-ice", {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") {
        cleanupCall();
        return;
      }
      if (state === "disconnected") {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(() => {
          if (peerRef.current?.connectionState === "disconnected") {
            cleanupCall();
          }
        }, 5000);
        return;
      }
      if (state === "connected" && disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    };
    peerRef.current = pc;
    return pc;
  }, [cleanupCall]);

  const startLocalMedia = useCallback(async (callType) => {
    const constraints = {
      audio: true,
      video: callType === "video",
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!selectedUser?.id) return;
    const latest = allUsers.find((u) => String(u.id) === String(selectedUser.id));
    if (!latest) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      if (
        prev.username === latest.username &&
        prev.profilePic === latest.profilePic &&
        prev.online === latest.online &&
        prev.bio === latest.bio &&
        prev.mobile === latest.mobile
      ) {
        return prev;
      }
      return latest;
    });
  }, [allUsers, selectedUser?.id]);

  useEffect(() => {
    if (!token) return;
    scheduleUsersRefresh(0);
  }, [token, scheduleUsersRefresh]);

  useEffect(() => {
    return () => {
      if (refreshUsersTimerRef.current) {
        clearTimeout(refreshUsersTimerRef.current);
      }
      if (profilePreviewUrlRef.current) {
        URL.revokeObjectURL(profilePreviewUrlRef.current);
        profilePreviewUrlRef.current = null;
      }
      if (messageActionLongPressRef.current) {
        clearTimeout(messageActionLongPressRef.current);
        messageActionLongPressRef.current = null;
      }
      if (notificationAudioRef.current?.close) {
        notificationAudioRef.current.close().catch(() => {});
        notificationAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileBio(user.bio || "");
      setProfileImage(user.profilePic || null);
      setProfileImageFile(null);
    }

    const checkApi = async () => {
      try {
        const res = await fetch(`${API}/auth/check`, {
          headers: { Authorization: token },
        });
        setApiConnected(res.ok);
      } catch (e) {
        setApiConnected(false);
      }
    };

    if (token) checkApi();
  }, [user, token]);

  useEffect(() => {
    setMessage("");
    setAttachment(null);
    setFile(null);
    setUploadProgress(0);
    setSending(false);
    setReplyTo(null);
    setEditingMessageId(null);
    setEditText("");
    setActiveMessageActionsId(null);
    setTypingUser(null);
    initialFetchRef.current = true;
    lastLoadedRef.current = null;
  }, [selectedUser?.id]);

  useEffect(() => {
    if (!showAttachOptions) return;

    const handlePointerDown = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachOptions(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showAttachOptions]);
  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showMenu]);
  useEffect(() => {
    if (!showNotifications) return;

    const handlePointerDown = (event) => {
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showNotifications]);
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, attachment, typingUser]);

  useEffect(() => {
    if (!user?._id) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      auth: { userId: user._id },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("onlineUsers", (ids) => {
      const list = Array.isArray(ids) ? ids : [];
      setOnlineUserIds(list);
    });

    socket.on("newMessage", (newMessage) => {
      const currentSelected = selectedUserRef.current;
      if (
        currentSelected?.id &&
        String(newMessage.senderId) === String(currentSelected.id)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(newMessage._id));
          return exists ? prev : [...prev, newMessage];
        });
        markOpenChatMessageSeen(newMessage._id);
      } else {
        playNotificationSound();
        scheduleUsersRefresh(200);
      }
    });

    socket.on("messageUpdated", (updated) => {
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? updated : m))
      );
    });

    socket.on("messageDeleted", ({ id }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? {
                ...m,
                text: "This message was deleted",
                deleted: true,
                fileUrl: null,
                fileName: null,
                fileType: null,
                image: null,
              }
            : m
        )
      );
    });

    socket.on("userProfileUpdated", (updatedUser) => {
      if (!updatedUser?._id) return;
      scheduleUsersRefresh(0);

      if (String(selectedUserRef.current?.id) === String(updatedUser._id)) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                username: updatedUser.name ?? prev.username,
                profilePic: updatedUser.profilePic ?? prev.profilePic,
                bio: updatedUser.bio ?? prev.bio,
              }
            : prev
        );
      }
    });

    socket.on("blockStatusChanged", ({ userId, blocked, blockedByOther }) => {
      if (String(userId) === String(selectedUserRef.current?.id)) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                isBlocked: typeof blocked === "boolean" ? blocked : prev.isBlocked,
                hasBlockedMe: typeof blockedByOther === "boolean" ? blockedByOther : prev.hasBlockedMe,
              }
            : prev
        );
      }
      scheduleUsersRefresh(0);
    });

    socket.on("typing", ({ from }) => {
      if (String(from) === String(selectedUserRef.current?.id)) {
        setTypingUser(from);
      }
    });

    socket.on("stopTyping", ({ from }) => {
      if (String(from) === String(selectedUserRef.current?.id)) {
        setTypingUser(null);
      }
    });

    socket.on("messagesSeen", ({ by }) => {
      if (String(by) !== String(selectedUserRef.current?.id)) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.senderId) === String(user?._id) ? { ...m, seen: true } : m
        )
      );
    });

    socket.on("webrtc-offer", async ({ from, offer, callType }) => {
      if (!from || !offer) return;
      if (callStateRef.current.active) {
        socket.emit("webrtc-busy", { to: from });
        return;
      }
      const sender = allUsersRef.current.find((u) => String(u.id) === String(from));
      if (sender) {
        setSelectedUser(sender);
      }
      const accept = window.confirm(`Incoming ${callType} call. Accept?`);
      if (!accept) {
        socket.emit("webrtc-end", { to: from });
        return;
      }
      try {
        setCallError("");
        const pc = ensurePeer(from, callType);
        const stream = await startLocalMedia(callType);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { to: from, answer });
        setCallState({
          active: true,
          type: callType,
          muted: false,
          videoEnabled: callType === "video",
          startedAt: Date.now(),
        });
      } catch (err) {
        console.warn("Failed to accept call:", err);
        setCallError("Unable to start call. Please check camera/mic permissions.");
        cleanupCall();
      }
    });

    socket.on("webrtc-answer", async ({ answer }) => {
      try {
        if (peerRef.current && answer) {
          await peerRef.current.setRemoteDescription(answer);
        }
      } catch (err) {
        console.warn("Failed to apply answer:", err);
      }
    });

    socket.on("webrtc-ice", async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(candidate);
        }
      } catch (err) {
        console.warn("Failed to add ICE candidate:", err);
      }
    });

    socket.on("webrtc-end", () => {
      cleanupCall();
    });

    socket.on("webrtc-busy", () => {
      setCallError("User is busy on another call.");
      cleanupCall();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id, scheduleUsersRefresh, markOpenChatMessageSeen, playNotificationSound, cleanupCall, ensurePeer, startLocalMedia]);

  useEffect(() => {
    if (!selectedUser || !token) return;

    if (lastLoadedRef.current === selectedUser.id && messagesRef.current.length > 0) {
      return;
    }

    const fetchMessages = async () => {
      if (initialFetchRef.current) setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/messages/${selectedUser.id}`, {
          headers: { Authorization: token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load messages");

        setMessages(data.messages || []);
        lastLoadedRef.current = selectedUser.id;
        scheduleUsersRefresh(250);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingMessages(false);
        initialFetchRef.current = false;
      }
    };

    fetchMessages();
  }, [selectedUser, token, scheduleUsersRefresh]);

  const stopTypingSignal = () => {
    if (socketRef.current && selectedUser) {
      socketRef.current.emit("stopTyping", { to: selectedUser.id });
    }
  };

  const handleMessageChange = (value) => {
    setMessage(value);

    if (!selectedUser || !socketRef.current) return;

    socketRef.current.emit("typing", { to: selectedUser.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 1000);
  };

  const handleFileChangeProfile = (e) => {
    setProfileError("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!(selectedFile instanceof Blob)) {
      setProfileError("Invalid image file selected");
      return;
    }
    if (profilePreviewUrlRef.current) {
      URL.revokeObjectURL(profilePreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(selectedFile);
    profilePreviewUrlRef.current = previewUrl;
    setProfileImageFile(selectedFile);
    setProfileImage(previewUrl);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setUpdatingProfile(true);

    try {
      await updateProfile({
        name: profileName,
        bio: profileBio,
        profilePic: undefined,
        profilePicFile: profileImageFile || undefined,
      });
      if (profilePreviewUrlRef.current) {
        URL.revokeObjectURL(profilePreviewUrlRef.current);
        profilePreviewUrlRef.current = null;
      }
      setProfileImageFile(null);
      scheduleUsersRefresh(0);
      setProfileSuccess("Profile updated successfully");
      setTimeout(() => setShowProfile(false), 250);
    } catch (err) {
      console.warn(err);
      setProfileError(err.message || "Update failed");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleFileChange = (e, kind = "file") => {
    setSendError("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!(selectedFile instanceof Blob)) {
      setSendError("Selected attachment is invalid. Please choose the file again.");
      return;
    }

    setFile(selectedFile);
    let previewUrl = "";
    if (kind === "photo" || kind === "video" || kind === "audio") {
      previewUrl = URL.createObjectURL(selectedFile);
    }

    setAttachment({
      name: selectedFile.name,
      type: selectedFile.type,
      kind,
      url: previewUrl,
    });

    setShowAttachOptions(false);
  };

  const handleSend = async (overrideFile) => {
    setSendError("");

    const isBlobLike = (value) =>
      typeof Blob !== "undefined" && value instanceof Blob;
    const fileToSend = isBlobLike(overrideFile) ? overrideFile : file;
    const replyId = replyTo?._id || replyTo?.id;
    if ((!message && !fileToSend) || !selectedUser || !token) return;
    if (fileToSend && !isBlobLike(fileToSend)) {
      setSendError("Attachment is not a valid file. Please re-attach and try again.");
      return;
    }

    setSending(true);
    setUploadProgress(0);

    if (fileToSend) {
      const form = new FormData();
      form.append("text", message || "");
      form.append("file", fileToSend, fileToSend.name || "attachment");
      if (replyId) form.append("replyTo", replyId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/messages/send/${selectedUser.id}`);
      xhr.setRequestHeader("Authorization", token);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(event.loaded / event.total);
        }
      };

      xhr.onload = () => {
        try {
          const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          if (xhr.status >= 400) {
            throw new Error(data.message || "Failed to send message");
          }

          const newMsg = data.newMessage;
          if (!newMsg) {
            throw new Error("Upload finished, but server did not return the new message.");
          }
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          setAttachment(null);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (photoInputRef.current) photoInputRef.current.value = "";
          if (videoInputRef.current) videoInputRef.current.value = "";
          if (audioInputRef.current) audioInputRef.current.value = "";
          setReplyTo(null);
          scheduleUsersRefresh(100);

          stopTypingSignal();
        } catch (err) {
          console.warn(err);
          setSendError(
            err.message ||
              `Unable to send file (status ${xhr.status || "unknown"})`
          );
        } finally {
          setSending(false);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        setSendError("Network error uploading file");
        setSending(false);
        setUploadProgress(0);
      };

      xhr.send(form);
      return;
    }

    try {
      const res = await fetch(`${API}/messages/send/${selectedUser.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ text: message || "", replyTo: replyId || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send message");

      const newMsg = data.newMessage;
      setMessages((prev) => [...prev, newMsg]);
      setMessage("");
      setReplyTo(null);
      scheduleUsersRefresh(100);
      stopTypingSignal();
    } catch (err) {
      console.warn(err);
      setSendError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg._id);
    setEditText(msg.text || "");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !token) return;
    const targetId = editingMessageId;
    const optimisticText = editText;
    const previousMessages = messages;

    try {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(targetId)
            ? { ...m, text: optimisticText, edited: true }
            : m
        )
      );
      setEditingMessageId(null);
      setEditText("");

      const res = await fetch(`${API}/messages/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ text: optimisticText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Edit failed");

      const updated = data.updatedMessage;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? updated : m))
      );
    } catch (err) {
      setMessages(previousMessages);
      setEditingMessageId(targetId);
      setEditText(optimisticText);
      setSendError(err.message || "Unable to edit message");
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!token) return;
    const ok = window.confirm("Delete this message?");
    if (!ok) return;
    const previousMessages = messages;

    try {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? {
                ...m,
                text: "This message was deleted",
                deleted: true,
                fileUrl: null,
                fileName: null,
                fileType: null,
                image: null,
              }
            : m
        )
      );
      const res = await fetch(`${API}/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
    } catch (err) {
      setMessages(previousMessages);
      setSendError(err.message || "Unable to delete message");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };


  const startCall = (type) => {
    if (!selectedUser) return;
    if (callState.active) return;
    const targetId = selectedUser.id;
    const callType = type === "video" ? "video" : "audio";
    setCallError("");
    (async () => {
      try {
        const pc = ensurePeer(targetId, callType);
        const stream = await startLocalMedia(callType);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("webrtc-offer", {
          to: targetId,
          offer,
          callType,
        });
        setCallState({
          active: true,
          type: callType,
          muted: false,
          videoEnabled: callType === "video",
          startedAt: Date.now(),
          meetingUrl: null,
        });
      } catch (err) {
        console.warn("Failed to start call:", err);
        setCallError("Unable to start call. Please check camera/mic permissions.");
        cleanupCall();
      }
    })();
  };

  const endCall = () => {
    const targetId = selectedUserRef.current?.id;
    if (targetId) {
      socketRef.current?.emit("webrtc-end", { to: targetId });
    }
    cleanupCall();
  };

  const getReplyMessage = (msg) => {
    if (!msg?.replyTo) return null;
    if (typeof msg.replyTo === "object") return msg.replyTo;
    return messages.find((m) => String(m._id) === String(msg.replyTo)) || null;
  };

  const handleNotificationClick = (chatUser) => {
    if (!chatUser) return;
    setSelectedUser(chatUser);
    setShowNotifications(false);
    setShowMenu(false);
    navigate(`/chat/${chatUser.id}`, { state: { selectedUser: chatUser } });
  };

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
                ×
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

              {profileError && (
                <div className="alert alert-danger profile-alert" role="alert">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="alert alert-success profile-alert" role="alert">
                  {profileSuccess}
                </div>
              )}

              <div className="profile-actions-row">
                <button type="button" className="profile-secondary-btn" onClick={() => setShowProfile(false)}>
                  Cancel
                </button>
                <button type="submit" className="profile-primary-btn" disabled={updatingProfile}>
                  {updatingProfile ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="container-fluid mt-3">
        <div className="row">
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

                      {unseenMessages?.[u.id] && (
                        <span
                          title={`${unseenMessages[u.id]} unread`}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#22c55e",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            marginLeft: 8,
                          }}
                        >
                          {unseenMessages[u.id]}
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="col-md-9">
            {!selectedUser ? (
              <div className="card p-5 text-center shadow">
                <h4>Select a user to start chatting</h4>
              </div>
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
                      const currentDateLabel = formatDateSeparator(msg.createdAt);
                      const prevDateLabel =
                        idx > 0 ? formatDateSeparator(messages[idx - 1]?.createdAt) : "";
                      const shouldShowDateDivider = currentDateLabel && currentDateLabel !== prevDateLabel;
                      const isMine = String(msg.senderId) === String(user?._id);
                      const avatarSrc = isMine ? user?.profilePic : selectedUser?.profilePic;
                      const status = getMessageStatus(msg);
                      const replied = getReplyMessage(msg);

                      return (
                        <React.Fragment key={msg._id || `${msg.senderId}-${msg.createdAt}`}>
                          {shouldShowDateDivider && (
                            <div className="chat-date-separator">{currentDateLabel}</div>
                          )}
                          <div
                            className={`d-flex ${isMine ? "justify-content-end" : "justify-content-start"} mb-2`}
                          >
                            {!isMine && (
                              <div className="me-2" style={{ alignSelf: "flex-end" }}>
                                {renderAvatar(avatarSrc, selectedUser?.username, 32)}
                              </div>
                            )}

                          <div
                            className={`message-bubble-wrap ${activeMessageActionsId === msg._id ? "is-active" : ""}`}
                            onMouseEnter={() => showMessageActions(msg._id)}
                            onMouseLeave={() => hideMessageActions(msg._id)}
                            onTouchStart={() => startMessageActionPress(msg._id)}
                            onTouchEnd={clearMessageActionPress}
                            onTouchCancel={clearMessageActionPress}
                          >
                            <div className={isMine ? "chat-bubble sent" : "chat-bubble received"}>
                              {replied && (
                                <div className="reply-preview-box">
                                  <div className="reply-label">Reply</div>
                                  <div className="reply-text">{replied.text || "Attachment"}</div>
                                </div>
                              )}

                              {editingMessageId === msg._id ? (
                                <div className="d-flex gap-2 align-items-center">
                                  <input
                                    className="form-control form-control-sm"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                  />
                                  <button className="btn btn-sm btn-success" onClick={handleSaveEdit}>
                                    Save
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditText("");
                                      setActiveMessageActionsId(null);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {msg.text && <div>{msg.text}</div>}

                                  {msg.fileUrl && (
                                    <div className="mt-2">
                                      {msg.fileType?.startsWith("image") ? (
                                        <img
                                          src={msg.fileUrl}
                                          alt={msg.fileName || "shared"}
                                          style={{ maxWidth: "220px", borderRadius: "10px" }}
                                        />
                                      ) : (
                                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                          {msg.fileName || "Download file"}
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {msg.image && (
                                    <div className="mt-2">
                                      <img
                                        src={msg.image}
                                        alt="shared"
                                        style={{ maxWidth: "220px", borderRadius: "10px" }}
                                      />
                                    </div>
                                  )}

                                  <div className="message-meta-row">
                                    <span>{msg.createdAt ? formatTime(msg.createdAt) : ""}</span>
                                    {msg.edited && <span className="ms-1">edited</span>}
                                    {isMine && (
                                      <span className={`ms-2 status-tick ${status}`}>
                                        {status === "seen" ? "\u2713\u2713" : status === "delivered" ? "\u2713\u2713" : "\u2713"}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {!msg.deleted && editingMessageId !== msg._id && (
                              <div className={`d-flex gap-2 mt-1 small message-actions ${isMine ? "mine" : "other"}`}>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn"
                                  onClick={() => {
                                    setReplyTo(msg);
                                    setActiveMessageActionsId(null);
                                  }}
                                >
                                  Reply
                                </button>
                                {isMine && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn"
                                      onClick={() => handleStartEdit(msg)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn delete"
                                      onClick={() => handleDeleteMessage(msg._id)}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                            {isMine && (
                              <div className="ms-2" style={{ alignSelf: "flex-end" }}>
                                {renderAvatar(avatarSrc, user?.name, 32)}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-top bg-light-subtle">
                  {conversationBlocked && (
                    <div className="alert alert-warning py-2 px-3 mb-2 small">{blockNotice}</div>
                  )}
                  {replyTo && (
                    <div className="reply-composer d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <div className="small fw-bold">
                          Replying to{" "}
                          {String(replyTo.senderId) === String(user?._id) ? "yourself" : selectedUser.username}
                        </div>
                        <div className="small text-muted text-truncate" style={{ maxWidth: "500px" }}>
                          {replyTo.text || "Attachment"}
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  )}

                  {attachment && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {attachment.kind === "photo" && attachment.url && (
                        <img src={attachment.url} alt="preview" className="attachment-preview-thumb" />
                      )}
                      <span className="small">{attachment.name}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          setAttachment(null);
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                          if (photoInputRef.current) photoInputRef.current.value = "";
                          if (videoInputRef.current) videoInputRef.current.value = "";
                          if (audioInputRef.current) audioInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}

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

                  {showEmojiPicker && (
                    <div className="emoji-picker-panel mt-2">
                      {emojiList.map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          className="emoji-btn"
                          onClick={() => {
                            handleMessageChange(message + emoji);
                            setShowEmojiPicker(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {sendError && <div className="text-danger small mt-1">{sendError}</div>}
                  {uploadProgress > 0 && uploadProgress < 1 && (
                    <div className="progress w-50 mt-2" style={{ height: "0.6rem" }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                        aria-valuenow={Math.round(uploadProgress * 100)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "file")}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    ref={photoInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "photo")}
                  />
                  <input
                    type="file"
                    accept="video/*"
                    ref={videoInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "video")}
                  />
                  <input
                    type="file"
                    accept="audio/*"
                    ref={audioInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "audio")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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

      {callState.active && (
        <div className="call-overlay">
          <div className="call-card">
            <h5 className="mb-1 text-capitalize">{callState.type} call</h5>
            <p className="mb-2">With {selectedUser?.username}</p>
            {selectedUser?.mobile && <div className="small text-muted mb-2">Mobile: {selectedUser.mobile}</div>}
            <div className="call-screen mb-3">
              {callError && (
                <div className="text-danger mb-2">{callError}</div>
              )}
              {callState.type === "video" ? (
                <div style={{ display: "grid", gap: "12px", height: "100%" }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "100%", borderRadius: "12px", background: "#0f172a" }}
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: "140px", borderRadius: "12px", background: "#0f172a" }}
                  />
                </div>
              ) : (
                <div>
                  <div className="mb-2">Audio call in progress</div>
                  <audio ref={remoteAudioRef} autoPlay />
                </div>
              )}
            </div>
            <div className="d-flex justify-content-center gap-2">
              <button
                className="btn btn-warning btn-sm"
                onClick={() => setCallState((prev) => ({ ...prev, muted: !prev.muted }))}
              >
                {callState.muted ? "Unmute" : "Mute"}
              </button>
              {callState.type === "video" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setCallState((prev) => ({ ...prev, videoEnabled: !prev.videoEnabled }))
                  }
                >
                  {callState.videoEnabled ? "Camera Off" : "Camera On"}
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={endCall}>
                End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;


































