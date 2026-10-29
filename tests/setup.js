/* Setup global de Vitest: carga .env.test, comprueba la base y sustituye Cloudinary por mocks. */
import { resolve } from "node:path";
import dotenv from "dotenv";
import { vi } from "vitest";
import { assertTestDb } from "./helpers/guard.js";

// override: true para que ninguna variable del shell (p. ej. DB_URL real) pise la de tests
dotenv.config({ path: resolve(process.cwd(), ".env.test"), override: true, quiet: true });
assertTestDb();

// Mock de las subidas: no se llama a Cloudinary. req.file.path será una URL falsa con el mismo formato que la real.
vi.mock("../src/middlewares/file.middleware.js", async () => {
  const { default: multer } = await import("multer");

  const fakeStorage = (folder) => ({
    _handleFile(req, file, cb) {
      file.stream.on("data", () => {}); // consumimos el stream sin guardarlo
      file.stream.on("error", cb);
      file.stream.on("end", () => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        cb(null, {
          path: `https://res.cloudinary.com/test/image/upload/v1/API_pedagogia/${folder}/${Date.now()}.${ext}`,
        });
      });
    },
    _removeFile(req, file, cb) {
      cb(null);
    },
  });

  return {
    uploadImage: multer({ storage: fakeStorage("avatars"), limits: { fileSize: 5 * 1024 * 1024 } }),
    uploadDocument: multer({ storage: fakeStorage("documentos"), limits: { fileSize: 20 * 1024 * 1024 } }),
  };
});

// Borrado de archivos en Cloudinary: spy que siempre "funciona"; los tests pueden comprobar con qué se llamó.
vi.mock("../src/utils/deleteFiles.js", () => ({
  default: vi.fn(async () => true),
}));
