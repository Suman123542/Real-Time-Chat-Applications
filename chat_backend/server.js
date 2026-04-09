import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './lib/db.js';
import userRouter from './routes/userRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import { Server } from 'socket.io';

// create express app and http server
const app = express();
const server = http.createServer(app);

// socket.io setup
export const io = new Server(server, {
  cors: {
    origin: '*',
  },
  transports: ["websocket"],
});

// store online users
export const userSocketMap = {}; // {userId: socketId}

// socket.io connection handler
io.on('connection', (socket) => {
  // support both query (older clients) and auth object (socket.io v4+)
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }
  console.log('New client connected:', userId, socket.id);

  userSocketMap[userId] = socket.id;

  // emit online users to all connected clients
  io.emit('onlineUsers', Object.keys(userSocketMap));

  // client may emit a message directly (e.g. when file upload succeeded) as a backup
  socket.on('sentMessage', (msg) => {
    const receiverSocketId = userSocketMap[msg.receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', msg);
    }
  });

  socket.on("typing", ({ to }) => {
    const receiverSocketId = userSocketMap[String(to)];
    if (receiverSocketId && userId) {
      io.to(receiverSocketId).emit("typing", { from: userId });
    }
  });

  socket.on("stopTyping", ({ to }) => {
    const receiverSocketId = userSocketMap[String(to)];
    if (receiverSocketId && userId) {
      io.to(receiverSocketId).emit("stopTyping", { from: userId });
    }
  });

  const forwardToUser = (to, event, payload) => {
    const receiverSocketId = userSocketMap[String(to)];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit(event, payload);
    }
  };

  socket.on("webrtc-offer", ({ to, offer, callType }) => {
    if (!to || !offer) return;
    forwardToUser(to, "webrtc-offer", { from: userId, offer, callType });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    if (!to || !answer) return;
    forwardToUser(to, "webrtc-answer", { from: userId, answer });
  });

  socket.on("webrtc-ice", ({ to, candidate }) => {
    if (!to || !candidate) return;
    forwardToUser(to, "webrtc-ice", { from: userId, candidate });
  });

  socket.on("webrtc-end", ({ to }) => {
    if (!to) return;
    forwardToUser(to, "webrtc-end", { from: userId });
  });

  socket.on("webrtc-busy", ({ to }) => {
    if (!to) return;
    forwardToUser(to, "webrtc-busy", { from: userId });
  });

  // handle client disconnect
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', userId, socket.id, reason);
    // Avoid removing mapping for a newer socket created during reconnect.
    if (userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
    }
    io.emit('onlineUsers', Object.keys(userSocketMap));
  });
});

// middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// connect to database
await connectDB();

// routes setup
app.use('/api/auth', userRouter);
app.use('/api/messages', messageRouter);
app.use('/api', (req, res) => res.send('Hello World!'));

// start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// handle common startup errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Make sure no other process is running or change the PORT.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
