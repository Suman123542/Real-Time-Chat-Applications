import React, { useMemo, useState } from "react";

const palette = [
  ["#0ea5e9", "#2563eb"],
  ["#8b5cf6", "#7c3aed"],
  ["#f97316", "#ea580c"],
  ["#10b981", "#059669"],
  ["#ec4899", "#db2777"],
  ["#f59e0b", "#d97706"],
];

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getPalette = (name = "") => {
  const total = Array.from(String(name)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
};

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

export default UserAvatar;
