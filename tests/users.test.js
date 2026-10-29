/* Tests de /api/users: listado, actualización de perfil y eliminación.
   it.fails = BUG conocido (pasa mientras el bug exista; al corregirlo se pone en rojo y hay que cambiarlo por it). */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Student from "../src/models/Student.js";
import Session from "../src/models/Sessions.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData, TEST_PASSWORD } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createUser, uniqueEmail } from "./helpers/factories.js";

const ADMIN = "jheremi@admin.com";
const SAMANTHA = "samatha@pedagogo.com";
const CUSTOM_AVATAR = "https://res.cloudinary.com/test/image/upload/v1/API_pedagogia/avatars/anterior.png";
const NEW_OBJECT_ID = () => new mongoose.Types.ObjectId().toString();

let data;

beforeAll(async () => {
  await connectTestDb();
  await resetDb();
  data = await seedTestData();
});

beforeEach(() => {
  deleteFile.mockClear();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("GET /api/users", () => {
  it("devuelve 401 sin token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("el admin recibe todos los usuarios sin contraseña", async () => {
    const res = await request(app).get("/api/users").set(await authHeader(ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(res.body)).not.toContain('"password"');
  });

  it.fails("BUG seguridad: un pedagogo no debe poder listar todos los usuarios (403)", async () => {
    const res = await request(app).get("/api/users").set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/users/:id", () => {
  it("devuelve 401 sin token", async () => {
    const res = await request(app).put(`/api/users/${data.users.samantha._id}`).send({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("el pedagogo actualiza su propio nombre y especialización", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .send({ name: "Nombre Nuevo", specialization: "Neuropsicología" });

    expect(res.status).toBe(200);
    const saved = await User.findById(user._id);
    expect(saved.name).toBe("Nombre Nuevo");
    expect(saved.specialization).toBe("Neuropsicología");
  });

  it("el pedagogo no puede cambiarse el rol a admin (se ignora)", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .send({ rol: "admin" });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).rol).toBe("pedagogo");
  });

  it("no permite cambiar la contraseña desde este endpoint", async () => {
    const user = await createUser();
    await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .send({ password: "otraClave999" });

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it("un pedagogo no puede actualizar a otro usuario (403)", async () => {
    const res = await request(app)
      .put(`/api/users/${data.users.nathan._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ name: "Hackeado" });

    expect(res.status).toBe(403);
    expect((await User.findById(data.users.nathan._id)).name).toBe("Nathan Test");
  });

  it("el admin puede actualizar el nombre y el rol de otro usuario", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(ADMIN))
      .send({ name: "Promocionado", rol: "admin" });

    expect(res.status).toBe(200);
    const saved = await User.findById(user._id);
    expect(saved.name).toBe("Promocionado");
    expect(saved.rol).toBe("admin");
  });

  it("devuelve 400 con una especialización inválida", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .send({ specialization: "Astrología" });
    expect(res.status).toBe(400);
  });

  it("devuelve 404 si el usuario no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).put(`/api/users/${NEW_OBJECT_ID()}`).set(headers).send({ name: "X" })).status).toBe(404);
    expect((await request(app).put("/api/users/id-invalido").set(headers).send({ name: "X" })).status).toBe(400);
  });

  it("guarda la URL del avatar subido y no borra nada si tenía el avatar por defecto", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .attach("avatar", Buffer.from("img"), "nuevo.png");

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).avatar).toMatch(/avatars.*\.png$/);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("al subir un avatar nuevo borra el anterior de Cloudinary", async () => {
    const user = await createUser({ avatar: CUSTOM_AVATAR });
    await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .attach("avatar", Buffer.from("img"), "nuevo.png");

    expect(deleteFile).toHaveBeenCalledWith(CUSTOM_AVATAR);
  });

  it("si la actualización falla, borra el avatar recién subido", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .field("specialization", "Astrología")
      .attach("avatar", Buffer.from("img"), "nuevo.png");

    expect(res.status).toBe(400);
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });

  // ---- BUGS / HUECOS CONOCIDOS ----

  it.fails("BUG: cambiar el email a uno ya usado debe dar un 4xx, no un 500", async () => {
    const user = await createUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(await authHeader(user.email))
      .send({ email: ADMIN });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it.fails("HUECO: el admin no debería poder quitarse a sí mismo el rol si es el último admin", async () => {
    // Se deja solo un admin temporal para no afectar al admin del seed
    await User.deleteMany({ rol: "admin", email: { $ne: ADMIN } });
    const onlyAdmin = await User.findOne({ email: ADMIN });

    const res = await request(app)
      .put(`/api/users/${onlyAdmin._id}`)
      .set(await authHeader(ADMIN))
      .send({ rol: "pedagogo" });

    try {
      expect(res.status).toBe(400);
    } finally {
      await User.updateOne({ _id: onlyAdmin._id }, { rol: "admin" }); // restauramos el admin del seed
    }
  });
});

describe("DELETE /api/users/:id", () => {
  it("devuelve 401 sin token", async () => {
    const res = await request(app).delete(`/api/users/${data.users.nathan._id}`);
    expect(res.status).toBe(401);
  });

  it("un pedagogo no puede eliminar usuarios (403)", async () => {
    const target = await createUser();
    const res = await request(app).delete(`/api/users/${target._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
    expect(await User.findById(target._id)).not.toBeNull();
  });

  it("el admin elimina un usuario sin dependencias", async () => {
    const target = await createUser();
    const res = await request(app).delete(`/api/users/${target._id}`).set(await authHeader(ADMIN));

    expect(res.status).toBe(200);
    expect(await User.findById(target._id)).toBeNull();
  });

  it("al eliminar un usuario borra su avatar de Cloudinary, salvo el por defecto", async () => {
    const withAvatar = await createUser({ avatar: CUSTOM_AVATAR });
    const withDefault = await createUser();
    const headers = await authHeader(ADMIN);

    await request(app).delete(`/api/users/${withAvatar._id}`).set(headers);
    expect(deleteFile).toHaveBeenCalledWith(CUSTOM_AVATAR);

    deleteFile.mockClear();
    await request(app).delete(`/api/users/${withDefault._id}`).set(headers);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("el admin no puede eliminar su propia cuenta (400)", async () => {
    const admin = await User.findOne({ email: ADMIN });
    const res = await request(app).delete(`/api/users/${admin._id}`).set(await authHeader(ADMIN));
    expect(res.status).toBe(400);
    expect(await User.findById(admin._id)).not.toBeNull();
  });

  it("no elimina a un usuario con alumnos asignados e informa de los conteos", async () => {
    const res = await request(app).delete(`/api/users/${data.users.samantha._id}`).set(await authHeader(ADMIN));

    expect(res.status).toBe(400);
    expect(res.body.details.estudiantesAsignados).toBe(3);
    expect(await User.findById(data.users.samantha._id)).not.toBeNull();
  });

  it("no elimina a un usuario que solo tiene sesiones asignadas", async () => {
    const target = await createUser();
    await Session.create({ student: data.students.s1._id, pedagogoAsignado: target._id, date: new Date() });

    const res = await request(app).delete(`/api/users/${target._id}`).set(await authHeader(ADMIN));

    expect(res.status).toBe(400);
    expect(res.body.details.sesionesAsignadas).toBe(1);
    expect(res.body.details.estudiantesAsignados).toBe(0);
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).delete(`/api/users/${NEW_OBJECT_ID()}`).set(headers)).status).toBe(404);
    expect((await request(app).delete("/api/users/id-invalido").set(headers)).status).toBe(400);
  });

  it("el token de un usuario eliminado deja de ser válido", async () => {
    const target = await createUser({ email: uniqueEmail("temporal") });
    const targetHeaders = await authHeader(target.email);

    await request(app).delete(`/api/users/${target._id}`).set(await authHeader(ADMIN));

    const res = await request(app).get("/api/auth/me").set(targetHeaders);
    expect(res.status).toBe(401);
  });
});

describe("integridad del seed tras los tests de usuarios", () => {
  it("los alumnos del seed siguen existiendo", async () => {
    expect(await Student.countDocuments()).toBe(5);
  });
});
