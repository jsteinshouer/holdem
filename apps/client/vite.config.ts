import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const socketProxyTarget = process.env.SOCKET_PROXY_TARGET ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: socketProxyTarget,
        ws: true
      }
    }
  }
});
