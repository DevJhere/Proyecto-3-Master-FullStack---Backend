/* Tests de /api/students: listado, detalle, alta, edición y baja. */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import Student from "../src/models/Student.js";
import Session from "../src/models/Sessions.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createStudent, createSession, createUser, validStudentBody } from "./helpers/factories.js";

const ADMIN = "jheremi@admin.com";
const SAMANTHA = "samatha@pedagogo.com";
const CUSTOM_AVATAR = "https://res.cloudinary.com/test/image/upload/v1/API_pedagogia/avatars/anterior.png";
const SESSION_DOC = "https://res.cloudinary.com/test/raw/upload/v1/API_pedagogia/documentos/sesion.pdf";
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

describe("GET /api/students", () => {
  it("devuelve 401 sin token", async () => {
    expect((await request(app).get("/api/students")).status).toBe(401);
  });

  it("el pedagogo recibe solo sus alumnos, con el pedagogo poblado sin datos sensibles", async () => {
    const res = await request(app).get("/api/students").set(await authHeader(SAMANTHA));

    expect(res.status).toBe(200);
    expect(res.body.students.length).toBeGreaterThanOrEqual(3);
    for (const s of res.body.students) {
      expect(s.pedagogoAsignado.email).toBe(SAMANTHA);
      expect(Object.keys(s.pedagogoAsignado).sort()).toEqual(["_id", "email", "name"]);
    }
  });

  it("el admin recibe alumnos de todos los pedagogos", async () => {
    const res = await request(app).get("/api/students").set(await authHeader(ADMIN));
    const owners = new Set(res.body.students.map((s) => s.pedagogoAsignado.email));
    expect(owners.has(SAMANTHA)).toBe(true);
    expect(owners.has("nathan@pedagogo.com")).toBe(true);
  });
});

describe("GET /api/students/:id", () => {
  it("el pedagogo ve su alumno", async () => {
    const res = await request(app).get(`/api/students/${data.students.s1._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(data.students.s1.name);
    expect(res.body.pedagogoAsignado.email).toBe(SAMANTHA);
  });

  it("el admin ve cualquier alumno", async () => {
    const res = await request(app).get(`/api/students/${data.students.n1._id}`).set(await authHeader(ADMIN));
    expect(res.status).toBe(200);
  });

  it("el pedagogo no ve alumnos de otro pedagogo (403)", async () => {
    const res = await request(app).get(`/api/students/${data.students.n1._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).get(`/api/students/${NEW_OBJECT_ID()}`).set(headers)).status).toBe(404);
    expect((await request(app).get("/api/students/id-invalido").set(headers)).status).toBe(400);
  });
});

describe("POST /api/students", () => {
  it("el pedagogo crea un alumno asignado a sí mismo, normalizando los textos", async () => {
    const body = validStudentBody({ name: "  Lucía Prueba  ", emailTutor: "  TUTOR.Lucia@Correo.COM " });
    const res = await request(app).post("/api/students").set(await authHeader(SAMANTHA)).send(body);

    expect(res.status).toBe(201);
    expect(res.body.student.name).toBe("Lucía Prueba");
    expect(res.body.student.emailTutor).toBe("tutor.lucia@correo.com");
    expect(res.body.student.pedagogoAsignado.email).toBe(SAMANTHA);
  });

  it("sin archivo asigna el avatar por defecto", async () => {
    const res = await request(app).post("/api/students").set(await authHeader(SAMANTHA)).send(validStudentBody());
    expect(res.body.student.avatar).toContain("profile-default");
  });

  it("con archivo guarda la URL subida", async () => {
    const b = validStudentBody();
    const req = request(app).post("/api/students").set(await authHeader(SAMANTHA));
    for (const [k, v] of Object.entries(b)) req.field(k, String(v));
    const res = await req.attach("avatar", Buffer.from("img"), "foto.png");

    expect(res.status).toBe(201);
    expect(res.body.student.avatar).toMatch(/avatars.*\.png$/);
  });

  it("un pedagogo no puede asignar el alumno a otro pedagogo (se ignora pedagogoAsignado)", async () => {
    const res = await request(app)
      .post("/api/students")
      .set(await authHeader(SAMANTHA))
      .send(validStudentBody({ pedagogoAsignado: data.users.nathan._id.toString() }));

    expect(res.status).toBe(201);
    expect(res.body.student.pedagogoAsignado.email).toBe(SAMANTHA);
  });

  it.each(["name", "age", "course", "diagnosis", "nameTutor", "emailTutor", "phoneNumberTutor", "tutorRelationship"])(
    "devuelve 400 si falta %s",
    async (field) => {
      const body = validStudentBody();
      delete body[field];
      const res = await request(app).post("/api/students").set(await authHeader(SAMANTHA)).send(body);
      expect(res.status).toBe(400);
    },
  );

  it.each([
    ["edad menor de 3", { age: 2 }],
    ["edad mayor de 18", { age: 19 }],
    ["curso fuera del catálogo", { course: "7 Primaria" }],
    ["diagnóstico fuera del catálogo", { diagnosis: "Inventado" }],
    ["relación fuera del catálogo", { tutorRelationship: "Abuelo" }],
    ["teléfono de 8 dígitos", { phoneNumberTutor: "60000000" }],
    ["teléfono con prefijo", { phoneNumberTutor: "+34600000000" }],
    ["email de tutor inválido", { emailTutor: "no-es-email" }],
  ])("devuelve 400 con %s", async (_, override) => {
    const res = await request(app)
      .post("/api/students")
      .set(await authHeader(SAMANTHA))
      .send(validStudentBody(override));
    expect(res.status).toBe(400);
  });

  it("rechaza un duplicado (mismo nombre sin importar mayúsculas/espacios y mismo email de tutor)", async () => {
    const headers = await authHeader(SAMANTHA);
    const body = validStudentBody({ name: "Duplicado Uno" });
    await request(app).post("/api/students").set(headers).send(body);

    const res = await request(app)
      .post("/api/students")
      .set(headers)
      .send({ ...body, name: "  duplicado UNO " });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("El estudiante ya existe");
  });

  it("permite dos hermanos con el mismo tutor y distinto nombre", async () => {
    const headers = await authHeader(SAMANTHA);
    const tutor = validStudentBody();
    const a = await request(app).post("/api/students").set(headers).send(tutor);
    const b = await request(app).post("/api/students").set(headers).send({ ...tutor, name: `${tutor.name} Hermano` });
    expect([a.status, b.status]).toEqual([201, 201]);
  });

  it("borra el archivo subido si la validación o el duplicado fallan", async () => {
    const b = validStudentBody({ age: 2 });
    const req = request(app).post("/api/students").set(await authHeader(SAMANTHA));
    for (const [k, v] of Object.entries(b)) req.field(k, String(v));
    const res = await req.attach("avatar", Buffer.from("img"), "foto.png");

    expect(res.status).toBe(400);
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });

  describe("como admin", () => {
    it("sin pedagogoAsignado devuelve 400 (la UI actual no envía este campo)", async () => {
      const res = await request(app).post("/api/students").set(await authHeader(ADMIN)).send(validStudentBody());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Pedagogo asignado obligatorio");
    });

    it.each([
      ["id", () => data.users.nathan._id.toString()],
      ["email", () => "nathan@pedagogo.com"],
      ["nombre (sin importar mayúsculas)", () => "nathan TEST"],
    ])("asigna el alumno a un pedagogo indicado por %s", async (_, getRef) => {
      const res = await request(app)
        .post("/api/students")
        .set(await authHeader(ADMIN))
        .send(validStudentBody({ pedagogoAsignado: getRef() }));

      expect(res.status).toBe(201);
      expect(res.body.student.pedagogoAsignado.email).toBe("nathan@pedagogo.com");
    });

    it("devuelve 404 si el pedagogo no existe", async () => {
      const res = await request(app)
        .post("/api/students")
        .set(await authHeader(ADMIN))
        .send(validStudentBody({ pedagogoAsignado: "fantasma@nadie.com" }));
      expect(res.status).toBe(404);
    });

    it("devuelve 403 si el usuario indicado no tiene rol pedagogo", async () => {
      const res = await request(app)
        .post("/api/students")
        .set(await authHeader(ADMIN))
        .send(validStudentBody({ pedagogoAsignado: ADMIN }));
      expect(res.status).toBe(403);
    });
  });

  describe("nombres con caracteres especiales de regex", () => {
    it.each(["Ana [", "Ana (Test", "A.B.", "Pepe+Luis", "Mª ¿José?"])("permite crear un alumno llamado %s", async (name) => {
      const res = await request(app)
        .post("/api/students")
        .set(await authHeader(SAMANTHA))
        .send(validStudentBody({ name }));
      expect(res.status).toBe(201);
      expect(res.body.student.name).toBe(name);
    });

    it("el nombre se compara de forma literal: '.*' no choca con otros alumnos del mismo tutor", async () => {
      const headers = await authHeader(SAMANTHA);
      const tutorEmail = "tutor.regex@correo.com";
      await request(app).post("/api/students").set(headers).send(validStudentBody({ emailTutor: tutorEmail }));

      const res = await request(app)
        .post("/api/students")
        .set(headers)
        .send(validStudentBody({ name: ".*", emailTutor: tutorEmail }));
      expect(res.status).toBe(201);
    });

    it("sigue detectando duplicados cuando el nombre lleva caracteres especiales", async () => {
      const headers = await authHeader(SAMANTHA);
      const body = validStudentBody({ name: "Ana (Dup) [1]" });
      await request(app).post("/api/students").set(headers).send(body);

      const res = await request(app).post("/api/students").set(headers).send({ ...body, name: "ANA (dup) [1]" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("El estudiante ya existe");
    });

    it("el admin puede asignar por nombre a un pedagogo cuyo nombre lleva caracteres especiales", async () => {
      const pedagogo = await createUser({ name: "Dr. (Luis) [Prueba]" });
      const res = await request(app)
        .post("/api/students")
        .set(await authHeader(ADMIN))
        .send(validStudentBody({ pedagogoAsignado: "dr. (luis) [prueba]" }));

      expect(res.status).toBe(201);
      expect(res.body.student.pedagogoAsignado._id).toBe(pedagogo._id.toString());
    });
  });
});

describe("PUT /api/students/:id", () => {
  it("el pedagogo actualiza su alumno y recibe el alumno actualizado", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await request(app)
      .put(`/api/students/${student._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ course: "2 ESO", age: 13 });

    expect(res.status).toBe(200);
    expect(res.body.course).toBe("2 ESO");
    expect(res.body.age).toBe(13);
    expect((await Student.findById(student._id)).course).toBe("2 ESO");
  });

  it("el pedagogo no puede reasignar el alumno (se ignora pedagogoAsignado)", async () => {
    const student = await createStudent(data.users.samantha._id);
    await request(app)
      .put(`/api/students/${student._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ pedagogoAsignado: data.users.nathan._id.toString() });

    expect((await Student.findById(student._id)).pedagogoAsignado.toString()).toBe(data.users.samantha._id.toString());
  });

  it("el pedagogo no puede editar alumnos de otro (403)", async () => {
    const res = await request(app)
      .put(`/api/students/${data.students.n1._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ age: 10 });
    expect(res.status).toBe(403);
  });

  it("el admin puede reasignar el alumno a otro pedagogo", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await request(app)
      .put(`/api/students/${student._id}`)
      .set(await authHeader(ADMIN))
      .send({ pedagogoAsignado: "nathan@pedagogo.com" });

    expect(res.status).toBe(200);
    expect(res.body.pedagogoAsignado.email).toBe("nathan@pedagogo.com");
  });

  it.each([
    ["un admin como destino", ADMIN],
    ["un pedagogo inexistente", "fantasma@nadie.com"],
  ])("el admin no puede reasignar a %s (400)", async (_, target) => {
    const student = await createStudent(data.users.samantha._id);
    const res = await request(app)
      .put(`/api/students/${student._id}`)
      .set(await authHeader(ADMIN))
      .send({ pedagogoAsignado: target });
    expect(res.status).toBe(400);
  });

  it.each([
    ["curso inválido", { course: "Curso X" }],
    ["teléfono inválido", { phoneNumberTutor: "123" }],
    ["edad fuera de rango", { age: 40 }],
  ])("devuelve 400 con %s", async (_, update) => {
    const student = await createStudent(data.users.samantha._id);
    const res = await request(app).put(`/api/students/${student._id}`).set(await authHeader(SAMANTHA)).send(update);
    expect(res.status).toBe(400);
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).put(`/api/students/${NEW_OBJECT_ID()}`).set(headers).send({ age: 9 })).status).toBe(404);
    expect((await request(app).put("/api/students/id-invalido").set(headers).send({ age: 9 })).status).toBe(400);
  });

  it("al subir un avatar nuevo borra el anterior, salvo que fuese el de por defecto", async () => {
    const withCustom = await createStudent(data.users.samantha._id, { avatar: CUSTOM_AVATAR });
    const withDefault = await createStudent(data.users.samantha._id);
    const headers = await authHeader(SAMANTHA);

    const res = await request(app).put(`/api/students/${withCustom._id}`).set(headers).attach("avatar", Buffer.from("i"), "n.png");
    expect(res.body.avatar).toMatch(/avatars.*\.png$/);
    expect(deleteFile).toHaveBeenCalledWith(CUSTOM_AVATAR);

    deleteFile.mockClear();
    await request(app).put(`/api/students/${withDefault._id}`).set(headers).attach("avatar", Buffer.from("i"), "n.png");
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("borra el archivo subido si el alumno no existe, no es suyo o la validación falla", async () => {
    const headers = await authHeader(SAMANTHA);
    const own = await createStudent(data.users.samantha._id);

    await request(app).put(`/api/students/${NEW_OBJECT_ID()}`).set(headers).attach("avatar", Buffer.from("i"), "a.png");
    await request(app).put(`/api/students/${data.students.n1._id}`).set(headers).attach("avatar", Buffer.from("i"), "a.png");
    await request(app).put(`/api/students/${own._id}`).set(headers).field("age", "99").attach("avatar", Buffer.from("i"), "a.png");

    expect(deleteFile).toHaveBeenCalledTimes(3);
  });

  it("un pedagogo no puede sobrescribir los informes vía PUT", async () => {
    const student = await createStudent(data.users.samantha._id, {
      reports: [{ title: "Informe real", attachmentDocument: SESSION_DOC }],
    });

    await request(app)
      .put(`/api/students/${student._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ reports: [{ title: "Falso", attachmentDocument: "http://evil.example/x.pdf" }] });

    const saved = await Student.findById(student._id);
    expect(saved.reports.map((r) => r.title)).toEqual(["Informe real"]);
  });
});

describe("DELETE /api/students/:id", () => {
  it("el pedagogo elimina su alumno junto con sus sesiones y limpia Cloudinary", async () => {
    const student = await createStudent(data.users.samantha._id, { avatar: CUSTOM_AVATAR });
    await createSession({ student: student._id, pedagogoAsignado: data.users.samantha._id, attachmentDocument: SESSION_DOC });
    await createSession({ student: student._id, pedagogoAsignado: data.users.samantha._id });

    const res = await request(app).delete(`/api/students/${student._id}`).set(await authHeader(SAMANTHA));

    expect(res.status).toBe(200);
    expect(await Student.findById(student._id)).toBeNull();
    expect(await Session.countDocuments({ student: student._id })).toBe(0);
    expect(deleteFile).toHaveBeenCalledWith(CUSTOM_AVATAR);
    expect(deleteFile).toHaveBeenCalledWith(SESSION_DOC, "raw");
  });

  it("no borra el avatar si es el de por defecto", async () => {
    const student = await createStudent(data.users.samantha._id);
    await request(app).delete(`/api/students/${student._id}`).set(await authHeader(SAMANTHA));
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("el pedagogo no puede eliminar alumnos de otro (403) y el alumno sigue existiendo", async () => {
    const res = await request(app).delete(`/api/students/${data.students.n2._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
    expect(await Student.findById(data.students.n2._id)).not.toBeNull();
  });

  it("el admin puede eliminar cualquier alumno", async () => {
    const student = await createStudent(data.users.nathan._id);
    const res = await request(app).delete(`/api/students/${student._id}`).set(await authHeader(ADMIN));
    expect(res.status).toBe(200);
    expect(await Student.findById(student._id)).toBeNull();
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).delete(`/api/students/${NEW_OBJECT_ID()}`).set(headers)).status).toBe(404);
    expect((await request(app).delete("/api/students/id-invalido").set(headers)).status).toBe(400);
  });

  it("al eliminar un alumno debe borrar de Cloudinary los archivos de sus informes", async () => {
    const reportUrl = "https://res.cloudinary.com/test/image/upload/v1/API_pedagogia/documentos/informe.pdf";
    const student = await createStudent(data.users.samantha._id, {
      reports: [{ title: "Informe", attachmentDocument: reportUrl }],
    });

    await request(app).delete(`/api/students/${student._id}`).set(await authHeader(SAMANTHA));

    const deletedUrls = deleteFile.mock.calls.map((call) => call[0]);
    expect(deletedUrls).toContain(reportUrl);
  });
});
