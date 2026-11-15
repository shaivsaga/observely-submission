import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths so the same build works on GitHub Pages (/observely/) and on any subpath.
  base: "./",
  plugins: [react()],
  // Google AI Studio only proxies port 3000, and it must listen on every interface.
  server: { host: "0.0.0.0", port: 3000, strictPort: true, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 3000, strictPort: true },
});
