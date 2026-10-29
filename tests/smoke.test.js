/* Tests de humo: verifican que el entorno de pruebas funciona (app, base de test, auth, permisos y mocks de Cloudinary). */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";

let data;

beforeAll(async () => {
  await connectTestDb();
  await resetDb();
  data = await seedTestData();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("entorno", () => {
  it("usa la base pedagogia-test", () => {
    expect(mongoose.connection.name).toBe("pedagogia-test");
  });

  it("devuelve JSON 404 en rutas inexistentes", async () => {
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Endpoint no encontrado" });
  });
});

describe("auth", () => {
  it("login correcto devuelve token y usuario sin contraseña", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jheremi@admin.com", password: data.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.rol).toBe("admin");
    expect(res.body.user.password).toBeUndefined();
  });

  it("login con contraseña incorrecta devuelve 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jheremi@admin.com", password: "incorrecta" });
    expect(res.status).toBe(401);
  });

  it("login sin campos devuelve 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("/auth/me devuelve el usuario del token", async () => {
    const res = await request(app).get("/api/auth/me").set(await authHeader("samatha@pedagogo.com"));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("samatha@pedagogo.com");
  });

  it("rutas protegidas devuelven 401 sin token o con token falso", async () => {
    expect((await request(app).get("/api/students")).status).toBe(401);
    const res = await request(app).get("/api/students").set({ Authorization: "Bearer abc" });
    expect(res.status).toBe(401);
  });
});

describe("permisos básicos", () => {
  it("el pedagogo solo ve sus alumnos", async () => {
    const res = await request(app).get("/api/students").set(await authHeader("samatha@pedagogo.com"));
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(3);
  });

  it("el admin ve todos los alumnos", async () => {
    const res = await request(app).get("/api/students").set(await authHeader("jheremi@admin.com"));
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(5);
  });

  it("el pedagogo recibe 403 al pedir un alumno de otro pedagogo", async () => {
    const res = await request(app)
      .get(`/api/students/${data.students.n1._id}`)
      .set(await authHeader("samatha@pedagogo.com"));
    expect(res.status).toBe(403);
  });
});

describe("subida de archivos (Cloudinary mockeado)", () => {
  it("crea un alumno con avatar usando una URL falsa y sin llamar a Cloudinary", async () => {
    const res = await request(app)
      .post("/api/students")
      .set(await authHeader("samatha@pedagogo.com"))
      .field("name", "Alumno Con Foto")
      .field("age", "9")
      .field("course", "4 Primaria")
      .field("diagnosis", "Dislexia")
      .field("nameTutor", "Tutor Foto")
      .field("emailTutor", "foto@correo.com")
      .field("phoneNumberTutor", "611111111")
      .field("tutorRelationship", "Padre")
      .attach("avatar", Buffer.from("fake-image"), "foto.png");

    expect(res.status).toBe(201);
    expect(res.body.student.avatar).toMatch(/^https:\/\/res\.cloudinary\.com\/test\/.*avatars.*\.png$/);
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
