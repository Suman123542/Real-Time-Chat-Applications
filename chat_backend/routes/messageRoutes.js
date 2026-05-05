import express from "express";
import multer from "multer";
import {
  deleteMessage,
  downloadMessageAttachment,
  editMessage,
  getMessages,
  getUsersForSidebar,
  markMessageAsSeen,
  sendMessage,
} from "../controllers/messageController.js";
import { protectRoute } from "../middleware/auth.js";

const upload = multer(); // memory storage by default
const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.post('/send/:id', protectRoute, upload.single('file'), sendMessage);
messageRouter.put("/:id", protectRoute, editMessage);
messageRouter.delete("/:id", protectRoute, deleteMessage);
messageRouter.get("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.get("/:id/download", protectRoute, downloadMessageAttachment);
messageRouter.get("/:id", protectRoute, getMessages);

export default messageRouter;
