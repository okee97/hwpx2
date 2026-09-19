import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import {
  getRhwpVersion,
  getRhwpCapabilities,
  parseHwpFile,
} from "./server/rhwp.ts";

const app = express();
const PORT = 3000;

// Multer upload config
const TEMP_UPLOAD_BASE = "/tmp/rhwp_uploads";
if (!fs.existsSync(TEMP_UPLOAD_BASE)) {
  fs.mkdirSync(TEMP_UPLOAD_BASE, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(
      TEMP_UPLOAD_BASE,
      `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Preserve extension safely
    const ext = path.extname(file.originalname);
    cb(null, `doc_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB upload limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".hwp" || ext === ".hwpx") {
      cb(null, true);
    } else {
      cb(new Error("지원하지 않는 파일 형식입니다. .hwp 또는 .hwpx 파일만 업로드 가능합니다."));
    }
  },
});

app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Query rhwp version & capabilities
app.get("/api/rhwp/status", async (_req, res) => {
  try {
    const version = await getRhwpVersion();
    const capabilities = await getRhwpCapabilities();
    res.json({
      success: true,
      version,
      capabilities,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      error: `rhwp 상태 확인 실패: ${message}`,
    });
  }
});

// Parse uploaded HWP/HWPX file
app.post("/api/parse", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "파일이 전송되지 않았습니다. 'file' 필드로 HWP/HWPX 파일을 업로드해주세요.",
    });
  }

  const tempFilePath = req.file.path;
  const tempDir = req.file.destination;
  const originalName = req.file.originalname;
  const sizeBytes = req.file.size;

  try {
    const result = await parseHwpFile(tempFilePath, originalName, sizeBytes);
    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error: `파싱 중 내부 오류 발생: ${message}`,
    });
  } finally {
    // Temporary file cleanup immediately
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.warn("임시 파일 정리 경고:", cleanupErr);
    }
  }
});

// Sample file parser endpoint for quick validation
app.post("/api/parse-sample", async (req, res) => {
  const type = req.query.type === "hwpx" ? "hwpx" : "hwp";
  const samplePath = path.resolve(
    process.cwd(),
    type === "hwpx" ? "fixtures/sample_table.hwpx" : "fixtures/sample_table.hwp"
  );

  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({
      success: false,
      error: `샘플 파일(${type})을 찾을 수 없습니다.`,
    });
  }

  const stat = fs.statSync(samplePath);
  const originalName = path.basename(samplePath);

  try {
    const result = await parseHwpFile(samplePath, originalName, stat.size);
    return res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error: `샘플 파싱 중 오류: ${message}`,
    });
  }
});

// Express error handler for multer limits or filter
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "파일 크기가 너무 큽니다. 최대 50MB까지 지원됩니다.",
      });
    }
    return res.status(400).json({
      success: false,
      error: `파일 업로드 오류: ${err.message}`,
    });
  } else if (err instanceof Error) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  next(err);
});

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
