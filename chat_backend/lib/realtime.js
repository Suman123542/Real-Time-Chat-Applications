// Central place to access Socket.IO from controllers without importing `server.js`.
// This avoids circular imports (server -> routes -> controllers -> server).

export const userSocketMap = {}; // { userId: socketId }

let ioInstance = null;

export const setIo = (io) => {
  ioInstance = io;
};

export const getIo = () => ioInstance;

