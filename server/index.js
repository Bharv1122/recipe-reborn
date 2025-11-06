import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 8080;

// absolute path to your built app
const distDir = path.join(__dirname, "..", "dist");

// serve static files from /dist, and make sure .js gets the right MIME type
app.use(express.static(distDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
  }
}));

// SPA fallback → always return /dist/index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
