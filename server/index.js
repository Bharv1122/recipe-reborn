import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Serve static files from the dist folder
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// ✅ Send index.html on all other routes (for React Router)
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
