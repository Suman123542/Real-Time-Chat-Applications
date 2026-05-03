import mongoose from "mongoose";

const sanitizeMongoUriForLogs = (value = "") => {
  const raw = String(value);
  // Replace username:password@ with username:***@ (best-effort)
  return raw.replace(/\/\/([^:/?#]+):([^@]+)@/g, "//$1:***@");
};

export const connectDB = async () => {
  const rawUri =
    process.env.MONGODB_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL_LOCAL ||
    "";

  const trimmed = String(rawUri).trim();
  if (!trimmed) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URL (or MONGODB_URI / MONGO_URI) in chat_backend/.env.");
  }

  const defaultDbName = process.env.MONGODB_DB || "Chat-Application";
  const hasDbName = /\/[^/?]+(?:\?|$)/.test(trimmed);
  const uri = hasDbName ? trimmed : `${trimmed.replace(/\/+$/, "")}/${defaultDbName}`;
  const hardTimeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 6000);

  try {
    await Promise.race([
      mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000,
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`MongoDB connection timed out after ${hardTimeoutMs}ms`));
        }, hardTimeoutMs);
      }),
    ]);
    const conn = mongoose.connection;
    console.log(
      "MongoDB connected successfully",
      `db=${conn.name}`,
      `host=${conn.host}`,
      `uri=${sanitizeMongoUriForLogs(uri)}`
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error?.message || error);
    throw error;
  }
};
