import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // ✅ important: relative asset paths for production
  build: {
    outDir: "dist", // output folder for build
  },
});
