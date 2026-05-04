import "../lib/loadEnv.js";
import mongoose from "mongoose";
import { connectDB } from "../lib/db.js";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
};

const main = async () => {
  const dbName = required("MONGODB_DB");
  const confirm = String(process.env.CONFIRM_DB_RESET ?? "").trim();

  if (confirm !== dbName) {
    console.error(
      "Refusing to drop database.",
      `\nSet CONFIRM_DB_RESET=${dbName} to confirm.`
    );
    process.exit(1);
  }

  await connectDB();
  const conn = mongoose.connection;

  if (!conn?.readyState) {
    throw new Error("Not connected to MongoDB.");
  }

  if (conn.name !== dbName) {
    console.error(
      "Safety check failed: connected DB name does not match MONGODB_DB.",
      `\n- connected: ${conn.name}`,
      `\n- expected: ${dbName}`
    );
    process.exit(1);
  }

  console.log(`Dropping database: ${conn.name}`);
  await conn.dropDatabase();
  console.log("Database dropped successfully.");

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error("DB reset failed:", err?.message || err);
  process.exit(1);
});

