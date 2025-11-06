
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Absolute path to your built Vite app
const distDir = path.join(__dirname, "..", "dist");

// Serve static files from the dist folder
app.use(express.static(distDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// SPA fallback: always return index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
