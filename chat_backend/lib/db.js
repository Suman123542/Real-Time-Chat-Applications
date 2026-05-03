import mongoose from "mongoose";

const sanitizeMongoUriForLogs = (value = "") => {
  const raw = String(value);
  // Replace username:password@ with username:***@ (best-effort)
  return raw.replace(/\/\/([^:/?#]+):([^@]+)@/g, "//$1:***@");
};

const truthy = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
};

const enforceDbName = (mongoUri, dbName) => {
  if (!dbName) return mongoUri;
  const raw = String(mongoUri || "").trim();
  if (!raw) return raw;

  try {
    const url = new URL(raw);
    // URL.pathname includes the leading "/"
    url.pathname = `/${String(dbName).trim()}`;
    return url.toString();
  } catch {
    // If parsing fails (rare), fall back to original URI.
    return raw;
  }
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

  const defaultDbName = process.env.MONGODB_DB || "chat-application";
  const forceDbName = truthy(process.env.MONGODB_FORCE_DB ?? "true");

  // If the URI already has a db name, keep it unless MONGODB_FORCE_DB is true.
  const hasDbName = /\/[^/?]+(?:\?|$)/.test(trimmed);
  const initialUri = hasDbName ? trimmed : `${trimmed.replace(/\/+$/, "")}/${defaultDbName}`;
  const uri = forceDbName ? enforceDbName(initialUri, defaultDbName) : initialUri;
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
