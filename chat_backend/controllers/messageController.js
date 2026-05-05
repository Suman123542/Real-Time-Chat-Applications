import Message from "../models/message.js";
import User from "../models/User.js";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { saveBufferToLocalUpload } from "../lib/localUpload.js";
import { getIo, userSocketMap } from "../lib/realtime.js";
import fs from "fs/promises";
import path from "path";

const toIdString = (value) => String(value || "");

const getBlockStatus = async (currentUserId, otherUserId, currentUserBlockedUsers = []) => {
    const blockedByMe = currentUserBlockedUsers.some(
        (id) => toIdString(id) === toIdString(otherUserId)
    );

    const otherUser = await User.findById(otherUserId).select("blockedUsers").lean();
    const blockedByThem = Boolean(
        otherUser?.blockedUsers?.some((id) => toIdString(id) === toIdString(currentUserId))
    );

    return {
        blockedByMe,
        blockedByThem,
        conversationBlocked: blockedByMe || blockedByThem,
    };
};

export const getUsersForSidebar = async (req, res) => {
    try {
        const userId = req.user._id;
        const myBlockedUsers = req.user.blockedUsers || [];
        const allUsers = await User.find({ _id: { $ne: userId } })
            .select("-password")
            .lean();

        const unseenAgg = await Message.aggregate([
            {
                $match: {
                    receiverId: userId,
                    seen: false,
                },
            },
            {
                $group: {
                    _id: "$senderId",
                    count: { $sum: 1 },
                },
            },
        ]);

        const latestConversationAgg = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: userId },
                        { receiverId: userId },
                    ],
                },
            },
            {
                $project: {
                    contactId: {
                        $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"],
                    },
                    createdAt: 1,
                },
            },
            {
                $group: {
                    _id: "$contactId",
                    lastMessageAt: { $max: "$createdAt" },
                },
            },
        ]);

        const unseenMessages = {};
        unseenAgg.forEach((item) => {
            unseenMessages[String(item._id)] = item.count;
        });

        const latestConversationMap = {};
        latestConversationAgg.forEach((item) => {
            latestConversationMap[String(item._id)] = item.lastMessageAt;
        });

        const usersWithActivity = allUsers
            .map((user) => ({
                ...user,
                lastMessageAt: latestConversationMap[String(user._id)] || null,
                isBlocked: myBlockedUsers.some((id) => toIdString(id) === toIdString(user._id)),
                hasBlockedMe: Boolean(
                    user.blockedUsers?.some((id) => toIdString(id) === toIdString(userId))
                ),
            }))
            .map(({ blockedUsers, ...user }) => user)
            .sort((a, b) => {
                if (a.lastMessageAt && b.lastMessageAt) {
                    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
                }
                if (a.lastMessageAt) return -1;
                if (b.lastMessageAt) return 1;
                return String(a.name || "").localeCompare(String(b.name || ""));
            });

        return res.status(200).json({ users: usersWithActivity, unseenMessages });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: selectedUserId } = req.params;
        const myId = req.user._id;
        const blockStatus = await getBlockStatus(myId, selectedUserId, req.user.blockedUsers || []);
        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ],
        })
            .sort({ createdAt: 1 })
            .lean();
        await Message.updateMany(
            { senderId: selectedUserId, receiverId: myId, seen: false },
            { seen: true }
        );

        const senderSocketId = userSocketMap[String(selectedUserId)];
        if (senderSocketId) {
            const io = getIo();
            io?.to(senderSocketId).emit("messagesSeen", {
                by: String(myId),
                forChatWith: String(selectedUserId),
            });
        }

        return res.status(200).json({ messages, ...blockStatus });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const markMessageAsSeen = async (req, res) => {
    try {
        const { id } = req.params;
        const me = String(req.user._id);
        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (String(message.receiverId) !== me) {
            return res.status(403).json({ message: "Not allowed" });
        }

        if (!message.seen) {
            message.seen = true;
            await message.save();
        }

        const senderSocketId = userSocketMap[String(message.senderId)];
        if (senderSocketId) {
            const io = getIo();
            io?.to(senderSocketId).emit("messagesSeen", {
                by: me,
                forChatWith: String(message.senderId),
            });
        }

        return res.status(200).json({ message: "Message marked as seen" });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

const cleanDownloadName = (value = "download") =>
    String(value || "download").replace(/[\r\n"]/g, "").trim() || "download";

const getLocalUploadPath = (attachmentUrl = "") => {
    let pathname = attachmentUrl;
    try {
        pathname = new URL(attachmentUrl).pathname;
    } catch {
        pathname = String(attachmentUrl || "");
    }

    if (!pathname.startsWith("/uploads/")) return null;

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const relativePath = pathname.replace(/^\/uploads\//, "");
    const filePath = path.resolve(uploadsRoot, relativePath);

    if (!filePath.startsWith(uploadsRoot + path.sep)) return null;
    return filePath;
};

export const downloadMessageAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const me = String(req.user._id);
        const message = await Message.findById(id).lean();

        if (!message || message.deleted) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        const isParticipant =
            String(message.senderId) === me || String(message.receiverId) === me;
        if (!isParticipant) {
            return res.status(403).json({ message: "Not allowed" });
        }

        const attachmentUrl = message.fileUrl || message.image;
        if (!attachmentUrl) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        const fallbackName = message.image ? "photo" : "download";
        const fileName = cleanDownloadName(message.fileName || fallbackName);
        const localPath = getLocalUploadPath(attachmentUrl);

        if (localPath) {
            try {
                await fs.access(localPath);
                return res.download(localPath, fileName);
            } catch {
                return res.status(410).json({
                    message: "This file is no longer available on the server. Please ask the sender to resend it.",
                });
            }
        }

        const upstream = await fetch(attachmentUrl);
        if (!upstream.ok || !upstream.body) {
            return res.status(410).json({
                message: "This file is no longer available. Please ask the sender to resend it.",
            });
        }

        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Content-Type", upstream.headers.get("content-type") || message.fileType || "application/octet-stream");
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) res.setHeader("Content-Length", contentLength);

        for await (const chunk of upstream.body) {
            res.write(chunk);
        }
        return res.end();
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Download failed" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const receiverId = req.params.id;
        const senderId = req.user._id;
        const blockStatus = await getBlockStatus(senderId, receiverId, req.user.blockedUsers || []);

        const text = req.body.text || "";
        const replyTo = req.body.replyTo || null;
        let imageUrl;
        let fileUrl;
        let fileName;
        let fileType;

        if (!text && !req.file && !req.body.image && !req.body.file) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }
        if (blockStatus.conversationBlocked) {
            return res.status(403).json({
                message: blockStatus.blockedByMe
                    ? "You blocked this user. Unblock them to send messages."
                    : "This user blocked you. You cannot send messages.",
            });
        }

        const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:5000";

        if (req.file && req.file.buffer) {
            if (isCloudinaryConfigured) {
                try {
                    const uploadBuffer = (buffer, options) =>
                        new Promise((resolve, reject) => {
                            const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            });
                            stream.end(buffer);
                        });

                    const result = await uploadBuffer(req.file.buffer, {
                        resource_type: "auto",
                        folder: "chat-app/messages",
                        timeout: 60000,
                    });
                    fileUrl = result.secure_url;
                } catch (uploadErr) {
                    console.warn("Cloudinary upload failed, using local fallback:", uploadErr?.message);
                }
            }

            if (!fileUrl) {
                const localPath = await saveBufferToLocalUpload(req.file.buffer, req.file.originalname, "messages");
                fileUrl = `${backendBaseUrl}${localPath}`;
            }
            fileName = req.file.originalname;
            fileType = req.file.mimetype;
        } else {
            const { image, file, fileName: fn, fileType: ft } = req.body;
            if (image) {
                const uploadResponse = await cloudinary.uploader.upload(image, {
                    folder: "chat-app/messages",
                    timeout: 60000,
                });
                imageUrl = uploadResponse.secure_url;
            }
            if (file) {
                const uploadResponse = await cloudinary.uploader.upload(file, {
                    resource_type: "auto",
                    folder: "chat-app/messages",
                    timeout: 60000,
                });
                fileUrl = uploadResponse.secure_url;
                fileName = fn;
                fileType = ft;
            }
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            fileUrl,
            fileName,
            fileType,
            replyTo,
        });

        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            const io = getIo();
            io?.to(receiverSocketId).emit("newMessage", newMessage);
        }

        return res.json({ success: true, newMessage });
    } catch (error) {
        console.log(error);
        const uploadMessage = error?.message || "Server error";
        return res.status(500).json({ message: `Upload failed: ${uploadMessage}` });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { text = "" } = req.body;
        const me = String(req.user._id);

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (String(message.senderId) !== me) {
            return res.status(403).json({ message: "Not allowed" });
        }
        if (message.deleted) {
            return res.status(400).json({ message: "Cannot edit deleted message" });
        }

        message.text = text;
        message.edited = true;
        await message.save();

        const receiverSocketId = userSocketMap[String(message.receiverId)];
        if (receiverSocketId) {
            const io = getIo();
            io?.to(receiverSocketId).emit("messageUpdated", message);
        }
        return res.status(200).json({ message: "Message updated", updatedMessage: message });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const me = String(req.user._id);
        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (String(message.senderId) !== me) {
            return res.status(403).json({ message: "Not allowed" });
        }

        message.text = "This message was deleted";
        message.image = undefined;
        message.fileUrl = undefined;
        message.fileName = undefined;
        message.fileType = undefined;
        message.deleted = true;
        await message.save();

        const receiverSocketId = userSocketMap[String(message.receiverId)];
        if (receiverSocketId) {
            const io = getIo();
            io?.to(receiverSocketId).emit("messageDeleted", { id: String(message._id) });
        }
        return res.status(200).json({ message: "Message deleted", deletedId: String(message._id) });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};
