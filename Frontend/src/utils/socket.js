import { io } from "socket.io-client";

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.PROD
    ? "https://arenasync-reel.onrender.com"
    : "http://localhost:5000");

const socket = io(SOCKET_URL, {
  withCredentials: true
});

export default socket;