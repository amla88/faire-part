import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  root: ".",
  publicDir: "public",
  base: "/faire-part/",
  server: {
    open: true,
  },
  plugins: [react()],
});
