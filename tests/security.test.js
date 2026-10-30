/* Tests de seguridad: cabeceras de helmet, CORS restringido por origen y límite de intentos de login (429).
   No necesitan datos en la base: usan rutas que no consultan MongoDB y una mini-app de Express para el limitador. */
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import app from "../src/app.js";
import { createLoginLimiter, getAllowedOrigins } from "../src/middlewares/security.middleware.js";

// Helmet añade cabeceras de seguridad a todas las respuestas (aunque sea un 404) y oculta X-Powered-By
describe("helmet", () => {
  it("añade cabeceras de seguridad y oculta X-Powered-By", async () => {
    const res = await request(app).get("/api/ruta-que-no-existe");

    expect(res.status).toBe(404);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

// En test (no producción) y sin CORS_ORIGIN solo se autoriza el servidor de desarrollo de Vite: cualquier otro origen no recibe cabeceras CORS
describe("CORS", () => {
  it("autoriza el origen del frontend de desarrollo", async () => {
    const res = await request(app).get("/api/ruta-que-no-existe").set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("no autoriza un origen desconocido", async () => {
    const res = await request(app).get("/api/ruta-que-no-existe").set("Origin", "https://sitio-malicioso.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde al preflight del origen autorizado con los métodos permitidos", async () => {
    const res = await request(app)
      .options("/api/students")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "DELETE");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("las peticiones sin Origin (Postman, curl, tests) siguen funcionando", async () => {
    const res = await request(app).get("/api/ruta-que-no-existe");

    expect(res.status).toBe(404);
  });
});

// getAllowedOrigins lee las variables de entorno: restauramos su valor original tras cada test
describe("getAllowedOrigins", () => {
  const originalOrigin = process.env.CORS_ORIGIN;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalOrigin;
    process.env.NODE_ENV = originalEnv;
  });

  it("lee varios orígenes separados por comas y quita espacios y la barra final", () => {
    process.env.CORS_ORIGIN = "https://miapp.vercel.app/ , http://localhost:5173";

    expect(getAllowedOrigins()).toEqual(["https://miapp.vercel.app", "http://localhost:5173"]);
  });

  it("en desarrollo sin CORS_ORIGIN permite solo el servidor de Vite", () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "development";

    expect(getAllowedOrigins()).toEqual(["http://localhost:5173"]);
  });

  it("en producción sin CORS_ORIGIN no permite ningún origen", () => {
    delete process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";

    expect(getAllowedOrigins()).toEqual([]);
  });
});

// Mini-app con el limitador (3 intentos fallidos) y un login falso: la contraseña correcta es "ok"
const buildLoginApp = () => {
  const mini = express();
  mini.use(express.json());
  mini.post("/login", createLoginLimiter({ max: 3, skip: () => false }), (req, res) => {
    res.status(req.body.password === "ok" ? 200 : 401).json({});
  });
  return mini;
};

describe("límite de intentos de login", () => {
  it("bloquea con 429 tras superar los intentos fallidos y envía Retry-After", async () => {
    const mini = buildLoginApp();

    for (let i = 0; i < 3; i++) {
      expect((await request(mini).post("/login").send({ password: "mal" })).status).toBe(401);
    }

    const blocked = await request(mini).post("/login").send({ password: "mal" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe("Demasiados intentos");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("los logins correctos no cuentan para el límite", async () => {
    const mini = buildLoginApp();

    for (let i = 0; i < 6; i++) {
      expect((await request(mini).post("/login").send({ password: "ok" })).status).toBe(200);
    }
    // Tras 6 logins correctos todavía quedan los 3 intentos fallidos completos
    expect((await request(mini).post("/login").send({ password: "mal" })).status).toBe(401);
  });

  it("en el entorno de test el limitador real de la app está desactivado", async () => {
    // 15 intentos fallidos seguidos contra la ruta real: ninguno debe devolver 429 (la suite de auth depende de ello)
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).not.toBe(429);
    }
  });
});
