import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".",
  publicDir: "public",
  base: "/faire-part/",
  server: {
    open: true,
  },
  plugins: [react()],
});