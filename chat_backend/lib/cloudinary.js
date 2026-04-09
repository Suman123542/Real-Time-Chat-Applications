import {v2 as cloudinary} from "cloudinary";
import dotenv from "dotenv";    
dotenv.config();

const sanitizeEnv = (value = "") =>
  String(value).trim().replace(/^['"]|['"]$/g, "");

const cloudName = sanitizeEnv(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = sanitizeEnv(process.env.CLOUDINARY_API_KEY);
const apiSecret = sanitizeEnv(process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
});

export const isCloudinaryConfigured =
  Boolean(cloudName) && Boolean(apiKey) && Boolean(apiSecret);

export default cloudinary;
