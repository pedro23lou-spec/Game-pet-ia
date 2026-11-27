import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  const app = express();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build não encontrado. Execute npm run build.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cantinho do Pet servidor estático rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
