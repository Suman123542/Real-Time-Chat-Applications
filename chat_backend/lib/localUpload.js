import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const sanitizeExt = (fileName = "") => {
  const ext = path.extname(fileName || "").toLowerCase();
  if (!ext || ext.length > 10) return "";
  return ext.replace(/[^a-z0-9.]/g, "");
};

export const saveBufferToLocalUpload = async (buffer, originalName, subDir = "messages") => {
  const ext = sanitizeExt(originalName);
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const uploadsRoot = path.join(process.cwd(), "uploads");
  const targetDir = path.join(uploadsRoot, subDir);
  await ensureDir(targetDir);

  const filePath = path.join(targetDir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/uploads/${subDir}/${fileName}`;
};

