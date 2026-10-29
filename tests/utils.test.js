/* Tests unitarios de utilidades: deleteFile (public_id y tipo de recurso de Cloudinary) y escapeRegExp. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import escapeRegExp from "../src/utils/escapeRegExp.js";

const destroy = vi.fn();

// Cloudinary falso: comprobamos con qué public_id y tipo de recurso se pide el borrado
vi.mock("../src/config/cloudinary.js", () => ({
  cloudinary: { uploader: { destroy: (...args) => destroy(...args) } },
}));

// setup.js sustituye deleteFile por un spy en todos los tests: aquí necesitamos la implementación real
const { default: deleteFile } = await vi.importActual("../src/utils/deleteFiles.js");

// URL base de Cloudinary de ejemplo para construir las URLs de los casos
const BASE = "https://res.cloudinary.com/demo";

// A partir de la URL de Cloudinary deduce public_id y resource_type; las imágenes pierden la extensión y los raw la conservan.
// Si la URL no es de Cloudinary no hace nada y, si Cloudinary falla, devuelve false sin lanzar error.
describe("deleteFile", () => {
  beforeEach(() => {
    destroy.mockReset();
    destroy.mockResolvedValue({ result: "ok" });
  });

  it("imagen: public_id sin extensión y tipo image", async () => {
    const ok = await deleteFile(`${BASE}/image/upload/v1700000000/API_pedagogia/avatars/abc123.jpg`);

    expect(ok).toBe(true);
    expect(destroy).toHaveBeenCalledWith("API_pedagogia/avatars/abc123", { resource_type: "image" });
  });

  it("PDF subido como image: se borra como image aunque el código pida raw", async () => {
    await deleteFile(`${BASE}/image/upload/v1700000000/API_pedagogia/documentos/informe.pdf`, "raw");
    expect(destroy).toHaveBeenCalledWith("API_pedagogia/documentos/informe", { resource_type: "image" });
  });

  it("archivo raw (docx): conserva la extensión en el public_id", async () => {
    await deleteFile(`${BASE}/raw/upload/v1700000000/API_pedagogia/documentos/informe.docx`);
    expect(destroy).toHaveBeenCalledWith("API_pedagogia/documentos/informe.docx", { resource_type: "raw" });
  });

  it("funciona sin segmento de versión y con carpetas anidadas", async () => {
    await deleteFile(`${BASE}/image/upload/API_pedagogia/avatars/2026/foto.png`);
    expect(destroy).toHaveBeenCalledWith("API_pedagogia/avatars/2026/foto", { resource_type: "image" });
  });

  it("no toca los puntos del nombre de carpeta ni del archivo salvo la extensión final", async () => {
    await deleteFile(`${BASE}/image/upload/v1/carpeta.v2/mi.foto.final.jpg`);
    expect(destroy).toHaveBeenCalledWith("carpeta.v2/mi.foto.final", { resource_type: "image" });
  });

  it.each([undefined, null, "", "profile-default.jpg", "https://example.com/foto.jpg"])(
    "devuelve false sin llamar a Cloudinary si no es una URL de Cloudinary (%s)",
    async (value) => {
      expect(await deleteFile(value)).toBe(false);
      expect(destroy).not.toHaveBeenCalled();
    },
  );

  it("devuelve false, sin lanzar error, si Cloudinary falla", async () => {
    destroy.mockRejectedValue(new Error("Cloudinary caído"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(await deleteFile(`${BASE}/image/upload/v1/a/b.jpg`)).toBe(false);
    log.mockRestore();
  });
});

// Permite usar texto del usuario dentro de un RegExp como búsqueda literal (nombres con paréntesis, puntos, etc.)
describe("escapeRegExp", () => {
  it("escapa los caracteres especiales para buscar el texto literal", () => {
    const text = "Ana [1] (Test) a+b*c? ^$ | \\ .";
    expect(new RegExp(`^${escapeRegExp(text)}$`).test(text)).toBe(true);
  });

  it("un comodín deja de funcionar como comodín", () => {
    expect(new RegExp(`^${escapeRegExp(".*")}$`).test("Cualquier nombre")).toBe(false);
  });

  it("deja intacto el texto normal", () => {
    expect(escapeRegExp("María José")).toBe("María José");
  });
});
