import React, { useCallback, useContext, useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { io } from "socket.io-client";
import UserAvatar from "../components/UserAvatar";
import { API_BASE, SOCKET_URL, WEBRTC_ICE_SERVERS, resolveBackendUrl } from "../config";

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

function MobileChat() {
  const { chatUserId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, users, token, refreshUsers } = useContext(AuthContext);

  const routeSelectedUser = location.state?.selectedUser || null;
  const normalizeSelectedUser = useCallback((source) => {
    if (!source) return null;
    return {
      id: source.id || source._id,
      username: source.username || source.name || "",
      profilePic: source.profilePic || "",
      mobile: source.mobile || "",
      bio: source.bio || "",
      lastSeen: source.lastSeen || null,
    };
  }, []);
  const [selectedUser, setSelectedUser] = useState(() => normalizeSelectedUser(routeSelectedUser));
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendError, setSendError] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editText, setEditText] = useState("");
  const [activeMessageActionsId, setActiveMessageActionsId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [callState, setCallState] = useState({ active: false, type: null });
  const [callConnection, setCallConnection] = useState({
    connectionState: "new",
    iceConnectionState: "new",
  });
  const [webrtcHasTurn, setWebrtcHasTurn] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { from, offer, callType }
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callError, setCallError] = useState("");
  const [remotePlaybackBlocked, setRemotePlaybackBlocked] = useState(false);
  const iceServersRef = useRef(WEBRTC_ICE_SERVERS);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [expandedSharedSections, setExpandedSharedSections] = useState({
    media: false,
    audio: false,
    documents: false,
  });

  const formatLastSeen = useCallback((dateValue) => {
    if (!dateValue) return "";
    const then = new Date(dateValue).getTime();
    if (!Number.isFinite(then)) return "";
    const diffMs = Date.now() - then;
    if (diffMs < 0) return "just now";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(then).toLocaleString();
  }, []);

  const downloadFile = useCallback(async (url, filename) => {
    const fileUrl = resolveBackendUrl(url);
    if (!fileUrl) return;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  const renderAvatar = (profilePic, name, size = 40) => (
    <UserAvatar profilePic={profilePic} name={name} size={size} />
  );

  const attachMediaStream = useCallback((element, stream) => {
    if (!element || !stream) return;
    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }
    const playPromise = element.play?.();
    if (playPromise?.catch) {
      playPromise.catch(() => setRemotePlaybackBlocked(true));
    }
  }, []);

  const resumeRemotePlayback = useCallback(() => {
    setRemotePlaybackBlocked(false);
    remoteVideoRef.current?.play?.().catch?.(() => setRemotePlaybackBlocked(true));
    remoteAudioRef.current?.play?.().catch?.(() => setRemotePlaybackBlocked(true));
  }, []);

  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const allUsersRef = useRef([]);
  const callStateRef = useRef(callState);
  const disconnectTimerRef = useRef(null);
  const refreshUsersTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageActionLongPressRef = useRef(null);

  const scheduleUsersRefresh = useCallback((delay = 250) => {
    if (!refreshUsers) return;
    if (refreshUsersTimerRef.current) clearTimeout(refreshUsersTimerRef.current);
    refreshUsersTimerRef.current = setTimeout(() => {
      refreshUsers?.();
      refreshUsersTimerRef.current = null;
    }, delay);
  }, [refreshUsers]);

  useEffect(() => {
    allUsersRef.current = (users || []).map((u) => ({
      id: u._id,
      username: u.name,
      profilePic: u.profilePic,
      mobile: u.mobile,
      bio: u.bio || "",
    }));
  }, [users]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    attachMediaStream(localVideoRef.current, localStream);
  }, [attachMediaStream, callState.active, callState.type, localStream]);

  useEffect(() => {
    attachMediaStream(remoteVideoRef.current, remoteStream);
    attachMediaStream(remoteAudioRef.current, remoteStream);
  }, [attachMediaStream, callState.active, callState.type, remoteStream]);

  const cleanupCall = useCallback(() => {
    setIncomingCall(null);
    setCallConnection({ connectionState: "new", iceConnectionState: "new" });
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
    setRemotePlaybackBlocked(false);
    setCallState({ active: false, type: null });
  }, []);

  const ensurePeer = useCallback((targetUserId, callType) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    setCallConnection({ connectionState: pc.connectionState, iceConnectionState: pc.iceConnectionState });
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-ice", {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };
    pc.oniceconnectionstatechange = () => {
      setCallConnection((prev) => ({ ...prev, iceConnectionState: pc.iceConnectionState }));
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
        return;
      }
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(event.track);
      setRemoteStream(remoteStreamRef.current);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setCallConnection((prev) => ({ ...prev, connectionState: state }));
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/webrtc/ice`);
        const data = await res.json().catch(() => ({}));
        const iceServers = Array.isArray(data?.iceServers) ? data.iceServers : null;
        if (!cancelled && res.ok && iceServers && iceServers.length) {
          iceServersRef.current = iceServers;
          const hasTurn = iceServers.some((server) => {
            const urls = server?.urls;
            const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
            return list.some((u) => {
              const raw = String(u || "").toLowerCase();
              return raw.startsWith("turn:") || raw.startsWith("turns:");
            });
          });
          setWebrtcHasTurn(hasTurn);
        }
      } catch {
        // fallback to env-configured ICE servers
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startLocalMedia = useCallback(async (callType) => {
    const hostname = window?.location?.hostname || "";
    const isLocalhost =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

    if (!window.isSecureContext && !isLocalhost) {
      throw new Error(
        "Camera/microphone access requires HTTPS. Open the app over https:// (or localhost) to use audio/video calling."
      );
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera/microphone not available in this browser/environment.");
    }

    const constraints = {
      audio: true,
      video: callType === "video",
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const declineIncomingCall = useCallback(() => {
    const payload = incomingCall;
    setIncomingCall(null);
    if (payload?.from && socketRef.current) {
      socketRef.current.emit("webrtc-end", { to: payload.from });
    }
  }, [incomingCall]);

  const acceptIncomingCall = useCallback(async () => {
    const payload = incomingCall;
    if (!payload?.from || !payload?.offer) return;
    setIncomingCall(null);
    try {
      setCallError("");
      const pc = ensurePeer(payload.from, payload.callType);
      const stream = await startLocalMedia(payload.callType);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(payload.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit("webrtc-answer", { to: payload.from, answer });
      setCallState({ active: true, type: payload.callType });
    } catch (err) {
      console.warn("Failed to accept call:", err);
      setCallError("Unable to start call. Please check camera/mic permissions.");
      cleanupCall();
    }
  }, [cleanupCall, ensurePeer, incomingCall, startLocalMedia]);

  useEffect(() => {
    if (!routeSelectedUser) return;
    const normalizedRouteUser = normalizeSelectedUser(routeSelectedUser);
    if (chatUserId && String(normalizedRouteUser?.id) !== String(chatUserId)) return;

    setSelectedUser((prev) => {
      if (!prev) return normalizedRouteUser;
      if (
        String(prev.id) === String(normalizedRouteUser?.id) &&
        prev.username === normalizedRouteUser?.username &&
        prev.profilePic === normalizedRouteUser?.profilePic &&
        prev.mobile === normalizedRouteUser?.mobile &&
        prev.bio === normalizedRouteUser?.bio
      ) {
        return prev;
      }
      return normalizedRouteUser;
    });
  }, [routeSelectedUser, chatUserId, normalizeSelectedUser]);


  useEffect(() => {
    if (!token) return;
    scheduleUsersRefresh(0);
  }, [token, scheduleUsersRefresh]);

  useEffect(() => {
    if (users && chatUserId) {
      const found = users.find(
        (u) => String(u._id) === String(chatUserId) || String(u.name) === String(chatUserId)
      );
      if (found) {
        const normalizedUser = normalizeSelectedUser(found);
        setSelectedUser((prev) => {
          if (!prev) return normalizedUser;
          if (
            String(prev.id) === String(normalizedUser?.id) &&
            prev.username === normalizedUser?.username &&
            prev.profilePic === normalizedUser?.profilePic &&
            prev.mobile === normalizedUser?.mobile &&
            prev.bio === normalizedUser?.bio
          ) {
            return prev;
          }
          return normalizedUser;
        });
      } else {
        setSelectedUser((prev) => (prev ? null : prev));
      }
    }
  }, [users, chatUserId, normalizeSelectedUser]);

  useEffect(() => {
    if (!user?._id) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      auth: { userId: user._id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("onlineUsers", (ids) => {
      setOnlineUserIds(Array.isArray(ids) ? ids : []);
    });

    socket.on("newMessage", (newMessage) => {
      const currentSelected = selectedUserRef.current;
      if (
        currentSelected &&
        String(newMessage.senderId) === String(currentSelected.id)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(newMessage._id));
          return exists ? prev : [...prev, newMessage];
        });
      } else {
        scheduleUsersRefresh(200);
      }
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
                mobile: updatedUser.mobile ?? prev.mobile,
              }
            : prev
        );
      }
    });

    socket.on("userLastSeen", ({ userId, lastSeen }) => {
      if (String(userId) === String(selectedUserRef.current?.id)) {
        setSelectedUser((prev) => (prev ? { ...prev, lastSeen } : prev));
      }
      scheduleUsersRefresh(0);
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
      setIncomingCall({ from, offer, callType });
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

    socket.on("webrtc-offline", () => {
      setCallError("User is offline. Missed call notification will be sent.");
      cleanupCall();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (refreshUsersTimerRef.current) clearTimeout(refreshUsersTimerRef.current);
      if (messageActionLongPressRef.current) clearTimeout(messageActionLongPressRef.current);
    };
  }, [user?._id, scheduleUsersRefresh, cleanupCall, ensurePeer, startLocalMedia]);

  useEffect(() => {
    if (!selectedUser?.id || !token) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`${API_BASE}/messages/${selectedUser.id}`, {
          headers: { Authorization: token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load messages");
        setMessages(data.messages || []);
        scheduleUsersRefresh(250);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
    setMessage("");
    setFile(null);
    setUploadProgress(0);
    setSending(false);
    setEditingMessageId("");
    setEditText("");
    setActiveMessageActionsId(null);
  }, [selectedUser?.id, token, scheduleUsersRefresh]);

  const handleFileChange = (e) => {
    setSendError("");
    const selected = e.target.files[0];
    if (!selected) return;
    if (!(selected instanceof Blob)) {
      setSendError("Selected attachment is invalid. Please choose again.");
      return;
    }
    setFile(selected);
  };

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

  const sharedItems = useMemo(
    () =>
      messages
        .filter((msg) => msg.fileUrl || msg.image)
        .map((msg) => {
          const type = msg.fileType || (msg.image ? "image/*" : "");
          const normalizedType = String(type || "").toLowerCase();
          return {
            id: msg._id,
            url: resolveBackendUrl(msg.fileUrl || msg.image),
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


  const handleStartEdit = (msg) => {
    setActiveMessageActionsId(null);
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

      const res = await fetch(`${API_BASE}/messages/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ text: optimisticText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to edit message");
      if (data.updatedMessage) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(targetId) ? data.updatedMessage : m
          )
        );
      }
    } catch (err) {
      console.warn(err);
      setMessages(previousMessages);
      setEditingMessageId(targetId);
      setEditText(optimisticText);
      setSendError(err.message || "Unable to edit message");
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!token) return;
    setActiveMessageActionsId(null);
    const ok = window.confirm("Delete this message?");
    if (!ok) return;
    const previousMessages = messages;

    try {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? { ...m, text: "This message was deleted", deleted: true, fileUrl: null, fileName: null, fileType: null, image: null }
            : m
        )
      );

      const res = await fetch(`${API_BASE}/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to delete message");
    } catch (err) {
      console.warn(err);
      setMessages(previousMessages);
      setSendError(err.message || "Unable to delete message");
    }
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
        setCallState({ active: true, type: callType });
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

  const handleSend = () => {
    setSendError("");
    if ((!message && !file) || !selectedUser || !token) return;

    setSending(true);
    setUploadProgress(0);

    if (file) {
      const form = new FormData();
      form.append("text", message || "");
      form.append("file", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/messages/send/${selectedUser.id}`);
      xhr.setRequestHeader("Authorization", token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        try {
          const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          if (xhr.status >= 400) throw new Error(data.message || "Failed to send message");
          const newMsg = data.newMessage;
          if (!newMsg) throw new Error("Upload finished, but no message was returned.");
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          scheduleUsersRefresh(120);
        } catch (err) {
          console.warn(err);
          setSendError(err.message || "Unable to send file");
        } finally {
          setSending(false);
          setUploadProgress(0);
        }
      };
      xhr.onerror = () => {
        console.warn("Upload error");
        setSendError("Network error uploading file");
        setSending(false);
        setUploadProgress(0);
      };
      xhr.send(form);
    } else {
      const send = async () => {
        setSending(true);
        try {
          const body = { text: message || "" };
          const res = await fetch(`${API_BASE}/messages/send/${selectedUser.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to send message");
          const newMsg = data.newMessage;
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          scheduleUsersRefresh(120);
        } catch (err) {
          console.warn(err);
          setSendError(err.message || "Unable to send message");
        } finally {
          setSending(false);
        }
      };
      send();
    }
  };

  return (
    <div className="chat-bg mobile-chat-page d-flex flex-column">
      <div className="mobile-chat-header text-white p-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center flex-grow-1 min-w-0 me-2 overflow-hidden">
          <button
            className="mobile-back-btn me-3"
            onClick={() => navigate("/chat")}
            aria-label="Back to chat list"
            type="button"
          >
            <span aria-hidden="true">&#8592;</span>
          </button>
          <button
            type="button"
            className="chat-user-trigger d-flex align-items-center flex-grow-1 min-w-0 text-start"
            onClick={() => setShowContactPanel(true)}
          >
            {renderAvatar(selectedUser?.profilePic, selectedUser?.username, 42)}
            <div className="ms-2 text-truncate">
              <h6 className="m-0 text-truncate">{selectedUser?.username || "Chat"}</h6>
              <small className="d-block text-light">
                {onlineUserIds.includes(selectedUser?.id)
                  ? "Online"
                  : selectedUser?.lastSeen
                    ? `Last seen ${formatLastSeen(selectedUser.lastSeen)}`
                    : "Offline"}{" "}
                ·{" "}
                {socketConnected ? "Live" : "Reconnecting..."}
              </small>
              <small className="d-block text-light opacity-75">Tap name to view contact details</small>
            </div>
          </button>
        </div>

        <div className="d-flex align-items-center gap-2 ms-2 flex-shrink-0">
          <button
            className="call-action-btn mobile-call-btn"
            type="button"
            onClick={() => startCall("audio")}
            aria-label="Start audio call"
            title={selectedUser?.mobile ? `Call ${selectedUser.mobile}` : "Audio call"}
          >
            <PhoneIcon />
          </button>
          <button
            className="call-action-btn mobile-call-btn"
            type="button"
            onClick={() => startCall("video")}
            aria-label="Start video call"
            title="Video call"
          >
            <VideoIcon />
          </button>
        </div>
      </div>

      <div className="flex-grow-1 p-3 chat-scroll">
        {loadingMessages ? (
          <div className="text-center text-muted">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted">No messages yet.</div>
        ) : (
          messages.map((msg, i) => {
            const currentDateLabel = formatDateSeparator(msg.createdAt);
            const prevDateLabel =
              i > 0 ? formatDateSeparator(messages[i - 1]?.createdAt) : "";
            const shouldShowDateDivider = currentDateLabel && currentDateLabel !== prevDateLabel;
            const isMine = String(msg.senderId) === String(user?._id);
            const missedCallMatch =
              typeof msg.text === "string"
                ? msg.text.trim().match(/^Missed\s+(audio|video)\s+call$/i)
                : null;
            return (
              <React.Fragment key={msg._id || `${msg.senderId}-${msg.createdAt || i}`}>
                {shouldShowDateDivider && (
                  <div className="chat-date-separator">{currentDateLabel}</div>
                )}
                <div className={`d-flex ${isMine ? "justify-content-end" : "justify-content-start"} mb-2`}>
                  <div
                    className={`message-bubble-wrap ${isMine ? "mine" : "other"} ${activeMessageActionsId === msg._id ? "is-active" : ""}`}
                    onMouseEnter={() => isMine && showMessageActions(msg._id)}
                    onMouseLeave={() => isMine && hideMessageActions(msg._id)}
                    onTouchStart={() => isMine && startMessageActionPress(msg._id)}
                    onTouchEnd={clearMessageActionPress}
                    onTouchCancel={clearMessageActionPress}
                  >
                    <div className={isMine ? "chat-bubble sent" : "chat-bubble received"}>
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
                          {missedCallMatch ? (
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-danger">Missed call</span>
                              <span className="text-capitalize">{missedCallMatch[1]} call</span>
                            </div>
                          ) : (
                            msg.text
                          )}
                          {msg.fileUrl && (
                            <div className="mt-2">
                              {msg.fileType && msg.fileType.startsWith("image") ? (
                                <div>
                                  <img
                                    src={resolveBackendUrl(msg.fileUrl)}
                                    alt={msg.fileName}
                                    style={{ maxWidth: "200px", borderRadius: "10px" }}
                                  />
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      className="btn btn-link p-0"
                                      onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ) : msg.fileType && msg.fileType.startsWith("video") ? (
                                <div>
                                  <video
                                    src={resolveBackendUrl(msg.fileUrl)}
                                    controls
                                    playsInline
                                    style={{ maxWidth: "320px", width: "100%", borderRadius: "10px" }}
                                  />
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      className="btn btn-link p-0"
                                      onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ) : msg.fileType && msg.fileType.startsWith("audio") ? (
                                <div>
                                  <audio src={resolveBackendUrl(msg.fileUrl)} controls style={{ width: "100%" }} />
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      className="btn btn-link p-0"
                                      onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-link p-0"
                                  onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                >
                                  {msg.fileName || "Download file"}
                                </button>
                              )}
                            </div>
                          )}

                          {msg.image && (
                            <div className="mt-2">
                              <div>
                                <img
                                  src={resolveBackendUrl(msg.image)}
                                  alt="shared"
                                  style={{ maxWidth: "200px", borderRadius: "10px" }}
                                />
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    className="btn btn-link p-0"
                                    onClick={() => downloadFile(msg.image, msg.fileName || "photo")}
                                  >
                                    Download
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {isMine && !msg.deleted && editingMessageId !== msg._id && (
                      <div className="d-flex gap-2 mt-1 small message-actions mine">
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
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="input-group p-2 mobile-message-bar">
        <input
          type="text"
          className="form-control"
          placeholder="Type message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <label className="btn btn-secondary mb-0">
          Attach
          <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
        </label>
        {file && (
          <span className="ms-2 text-white" style={{ fontSize: "0.9rem" }}>{file.name}</span>
        )}
        {uploadProgress > 0 && uploadProgress < 1 && (
          <div className="progress w-50 ms-2" style={{ height: "0.6rem" }}>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${Math.round(uploadProgress * 100)}%` }}
              aria-valuenow={Math.round(uploadProgress * 100)}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        )}
        <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {sendError && <div className="text-danger small px-2 pb-2">{sendError}</div>}

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

            <div className="contact-info-section">
              <div className="contact-info-label">Photos and Videos</div>
              {sharedMedia.length === 0 ? (
                <div className="text-muted small">No shared photos or videos yet.</div>
              ) : (
                <>
                  <div className="shared-item-grid">
                    {mediaPreviewItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="shared-item-card btn btn-link p-0 text-start"
                        onClick={() => downloadFile(item.url, item.name)}
                        title={`Download ${item.name}`}
                      >
                        {item.type.startsWith("video") ? (
                          <video src={item.url} className="shared-item-thumb" muted playsInline />
                        ) : (
                          <img src={item.url} alt={item.name} className="shared-item-thumb" />
                        )}
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </button>
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
                      <button
                        key={item.id}
                        type="button"
                        className="shared-document-item btn btn-link text-start"
                        onClick={() => downloadFile(item.url, item.name)}
                      >
                        <span>{item.name}</span>
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </button>
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
                      <button
                        key={item.id}
                        type="button"
                        className="shared-document-item btn btn-link text-start"
                        onClick={() => downloadFile(item.url, item.name)}
                      >
                        <span>{item.name}</span>
                        <span className="shared-item-meta">{item.senderLabel}</span>
                      </button>
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
            <div className="small text-muted mb-2">
              Status: {callConnection.connectionState} / ICE: {callConnection.iceConnectionState}
            </div>
            <div className="small text-muted mb-2">
              Relay:{" "}
              {webrtcHasTurn
                ? "TURN enabled"
                : "STUN only (best on same Wi‑Fi/LAN; cross‑network may fail)"}
            </div>
            {selectedUser?.mobile && (
              <div className="small text-muted mb-2">Mobile: {selectedUser.mobile}</div>
            )}
            <div className="call-screen mb-3">
              {callError && (
                <div className="text-danger mb-2">{callError}</div>
              )}
              {callState.type === "video" ? (
                <div style={{ display: "grid", gap: "12px", height: "100%" }}>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: "min(48vh, 320px)", borderRadius: "12px", background: "#0f172a", objectFit: "cover" }}
                  />
                  <audio ref={remoteAudioRef} autoPlay playsInline />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: "140px", borderRadius: "12px", background: "#0f172a", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <div>
                  <div className="mb-2">Audio call in progress</div>
                  <audio ref={remoteAudioRef} autoPlay playsInline />
                </div>
              )}
              {remotePlaybackBlocked && (
                <button className="btn btn-light btn-sm mt-2" type="button" onClick={resumeRemotePlayback}>
                  Enable sound
                </button>
              )}
            </div>
            <button className="btn btn-danger btn-sm" onClick={endCall}>
              End
            </button>
          </div>
        </div>
      )}

      {!callState.active && incomingCall && (
        <div className="call-overlay">
          <div className="call-card">
            <h5 className="mb-1 text-capitalize">Incoming {incomingCall.callType} call</h5>
            <p className="mb-3">From {selectedUser?.username || "User"}</p>
            {callError && <div className="text-danger mb-2">{callError}</div>}
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-success btn-sm" onClick={acceptIncomingCall}>
                Accept
              </button>
              <button className="btn btn-danger btn-sm" onClick={declineIncomingCall}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileChat;



