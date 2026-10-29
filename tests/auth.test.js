/* Tests de autenticación: registro, login, /me y validación del token. */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../src/app.js";
import User from "../src/models/User.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData, TEST_PASSWORD } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createUser, uniqueEmail } from "./helpers/factories.js";

const validUser = (overrides = {}) => ({
  name: "Nuevo Usuario",
  email: uniqueEmail("nuevo"),
  password: TEST_PASSWORD,
  specialization: "Logopedia",
  ...overrides,
});

const register = (body) => request(app).post("/api/auth/register").send(body);

beforeAll(async () => {
  await connectTestDb();
  await resetDb();
  await seedTestData();
});

beforeEach(() => {
  deleteFile.mockClear();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("POST /api/auth/register", () => {
  it("registra un pedagogo y guarda la contraseña hasheada", async () => {
    const body = validUser();
    const res = await register(body);

    expect(res.status).toBe(201);

    const saved = await User.findOne({ email: body.email }).select("+password");
    expect(saved.rol).toBe("pedagogo");
    expect(saved.password).not.toBe(body.password);
    expect(await bcrypt.compare(body.password, saved.password)).toBe(true);
  });

  it("el usuario recién registrado puede iniciar sesión", async () => {
    const body = validUser();
    await register(body);
    const res = await request(app).post("/api/auth/login").send({ email: body.email, password: body.password });
    expect(res.status).toBe(200);
  });

  it("ignora el campo rol enviado en el body", async () => {
    const body = validUser({ rol: "admin" });
    await register(body);
    const saved = await User.findOne({ email: body.email });
    expect(saved.rol).toBe("pedagogo");
  });

  it.each(["name", "email", "password", "specialization"])("devuelve 400 si falta %s", async (field) => {
    const body = validUser();
    delete body[field];
    const res = await register(body);
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el email ya está registrado", async () => {
    const body = validUser();
    await register(body);
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Usuario ya registrado");
  });

  it("devuelve 400 con una especialización fuera del catálogo", async () => {
    const res = await register(validUser({ specialization: "Astrología" }));
    expect(res.status).toBe(400);
  });

  it("devuelve 400 con un email mal formado", async () => {
    const res = await register(validUser({ email: "no-es-un-email" }));
    expect(res.status).toBe(400);
  });

  it("guarda la URL del avatar subido", async () => {
    const body = validUser();
    const res = await request(app)
      .post("/api/auth/register")
      .field("name", body.name)
      .field("email", body.email)
      .field("password", body.password)
      .field("specialization", body.specialization)
      .attach("avatar", Buffer.from("img"), "avatar.png");

    expect(res.status).toBe(201);
    const saved = await User.findOne({ email: body.email });
    expect(saved.avatar).toMatch(/avatars.*\.png$/);
  });

  it("rechaza el registro de un email que solo difiere en mayúsculas", async () => {
    const email = uniqueEmail("caso");
    await register(validUser({ email }));
    const res = await register(validUser({ email: email.toUpperCase() }));
    expect(res.status).toBe(400);
  });

  it.each(["intruso@admin.com", "intruso@Admin.com", "intruso@admin.com.evil.net"])(
    "el registro público de %s crea un pedagogo, nunca un admin",
    async (suffix) => {
      const body = validUser({ email: uniqueEmail("intruso", suffix.split("@")[1]) });
      const res = await register(body);

      expect(res.status).toBe(201);
      expect((await User.findOne({ email: body.email })).rol).toBe("pedagogo");
    },
  );

  it("rechaza contraseñas de menos de 6 caracteres, pero acepta exactamente 6", async () => {
    // El minLength del modelo se evalúa sobre el hash (60 chars), así que la validación se hace antes de encriptar
    expect((await register(validUser({ password: "1" }))).status).toBe(400);
    expect((await register(validUser({ password: "12345" }))).status).toBe(400);
    expect((await register(validUser({ password: "123456" }))).status).toBe(201);
  });

  it("rechaza una contraseña que no es texto", async () => {
    const res = await register(validUser({ password: 1234567 }));
    expect(res.status).toBe(400);
  });

  it("no crea el usuario cuando la contraseña es demasiado corta", async () => {
    const body = validUser({ password: "123" });
    await register(body);
    expect(await User.findOne({ email: body.email })).toBeNull();
  });

  describe("borra el avatar subido si el registro falla", () => {
    const registerWithAvatar = (fields) => {
      const req = request(app).post("/api/auth/register");
      for (const [key, value] of Object.entries(fields)) req.field(key, value);
      return req.attach("avatar", Buffer.from("img"), "avatar.png");
    };

    it("por email duplicado", async () => {
      const existing = await createUser();
      const res = await registerWithAvatar({ ...validUser({ email: existing.email }) });

      expect(res.status).toBe(400);
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("por campos obligatorios sin rellenar", async () => {
      const { name, ...incomplete } = validUser();
      const res = await registerWithAvatar(incomplete);

      expect(res.status).toBe(400);
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("por contraseña demasiado corta", async () => {
      const res = await registerWithAvatar(validUser({ password: "123" }));

      expect(res.status).toBe(400);
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("pero no lo borra cuando el registro es correcto", async () => {
      const res = await registerWithAvatar(validUser());

      expect(res.status).toBe(201);
      expect(deleteFile).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/auth/login", () => {
  it("devuelve token JWT con el id del usuario y caducidad de 2 horas", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "samatha@pedagogo.com", password: TEST_PASSWORD });

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.id).toBe(res.body.user._id);
    expect(payload.exp - payload.iat).toBe(2 * 60 * 60);
  });

  it("no expone la contraseña en la respuesta", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "samatha@pedagogo.com", password: TEST_PASSWORD });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("devuelve 401 con contraseña incorrecta", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "samatha@pedagogo.com", password: "mala" });
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con un email inexistente", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nadie@test.com", password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it.each([{ email: "samatha@pedagogo.com" }, { password: TEST_PASSWORD }, {}])("devuelve 400 si faltan campos (%o)", async (body) => {
    const res = await request(app).post("/api/auth/login").send(body);
    expect(res.status).toBe(400);
  });

  it("acepta el email en mayúsculas", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "SAMATHA@PEDAGOGO.COM", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("el mensaje de error no debe revelar si el email existe", async () => {
    const wrongPassword = await request(app).post("/api/auth/login").send({ email: "samatha@pedagogo.com", password: "mala" });
    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "nadie@test.com", password: "mala" });
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });
});

describe("GET /api/auth/me y validación del token", () => {
  it("devuelve el usuario sin contraseña", async () => {
    const res = await request(app).get("/api/auth/me").set(await authHeader("jheremi@admin.com"));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("jheremi@admin.com");
    expect(res.body.password).toBeUndefined();
  });

  it("devuelve 401 si el token no lleva el prefijo Bearer", async () => {
    const { Authorization } = await authHeader("jheremi@admin.com");
    const res = await request(app).get("/api/auth/me").set({ Authorization: Authorization.replace("Bearer ", "") });
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con un token caducado", async () => {
    const user = await User.findOne({ email: "jheremi@admin.com" });
    const expired = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${expired}` });
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con un token firmado con otro secreto", async () => {
    const user = await User.findOne({ email: "jheremi@admin.com" });
    const forged = jwt.sign({ id: user._id }, "otro-secreto", { expiresIn: "1h" });
    const res = await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
  });

  it("devuelve 401 si el usuario del token ya no existe", async () => {
    const user = await createUser();
    const headers = await authHeader(user.email);
    await User.deleteOne({ _id: user._id });

    const res = await request(app).get("/api/auth/me").set(headers);
    expect(res.status).toBe(401);
  });
});
