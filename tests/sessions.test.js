/* Tests de /api/sessions: alta, listado, detalle, edición y baja. */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import Session from "../src/models/Sessions.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData, at } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createStudent, createSession, createUser, uniqueEmail } from "./helpers/factories.js";

const ADMIN = "jheremi@admin.com";
const SAMANTHA = "samatha@pedagogo.com";
const OLD_DOC = "https://res.cloudinary.com/test/raw/upload/v1/API_pedagogia/documentos/viejo.pdf";
const NEW_OBJECT_ID = () => new mongoose.Types.ObjectId().toString();

let data;
let samanthaId;

// Sesión propia de Samantha sobre un alumno propio (cada test crea la suya para no depender del seed)
const ownSession = async (overrides = {}) => {
  const student = await createStudent(samanthaId);
  return createSession({ student: student._id, pedagogoAsignado: samanthaId, ...overrides });
};

// Base limpia + datos del seed antes de ejecutar el archivo
beforeAll(async () => {
  await connectTestDb();
  await resetDb();
  data = await seedTestData();
  samanthaId = data.users.samantha._id;
});

// Reinicia el spy de deleteFile para contar solo las llamadas de cada test
beforeEach(() => {
  deleteFile.mockClear();
});

afterAll(async () => {
  await disconnectTestDb();
});

// Alta: estado Pendiente por defecto, documento adjunto, duración, validaciones y permisos sobre el alumno.
// La sesión queda asignada al pedagogo del alumno (también cuando la crea un admin).
describe("POST /api/sessions", () => {
  it("devuelve 401 sin token", async () => {
    expect((await request(app).post("/api/sessions").send({})).status).toBe(401);
  });

  it("el pedagogo crea una sesión para su alumno con estado Pendiente por defecto", async () => {
    const notes = uniqueEmail("nota");
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .send({ student: data.students.s1._id, date: at(10, 9).toISOString(), notes });

    expect(res.status).toBe(201);
    const saved = await Session.findOne({ notes });
    expect(saved.status).toBe("Pendiente");
    expect(saved.pedagogoAsignado.toString()).toBe(samanthaId.toString());
    expect(saved.student.toString()).toBe(data.students.s1._id.toString());
  });

  it("guarda el documento adjunto subido", async () => {
    const notes = uniqueEmail("nota");
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .field("student", data.students.s1._id.toString())
      .field("date", at(11, 9).toISOString())
      .field("notes", notes)
      .attach("attachmentDocument", Buffer.from("pdf"), "informe.pdf");

    expect(res.status).toBe(201);
    expect((await Session.findOne({ notes })).attachmentDocument).toMatch(/documentos.*\.pdf$/);
  });

  it.each([
    ["sin student", (b) => delete b.student],
    ["sin date", (b) => delete b.date],
  ])("devuelve 400 %s", async (_, mutate) => {
    const body = { student: data.students.s1._id, date: at(12, 9).toISOString() };
    mutate(body);
    const res = await request(app).post("/api/sessions").set(await authHeader(SAMANTHA)).send(body);
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el alumno no existe", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .send({ student: NEW_OBJECT_ID(), date: at(12, 9).toISOString() });
    expect(res.status).toBe(400);
  });

  it("devuelve 400 con una fecha o un estado inválidos", async () => {
    const headers = await authHeader(SAMANTHA);
    const base = { student: data.students.s1._id };
    expect((await request(app).post("/api/sessions").set(headers).send({ ...base, date: "no-es-fecha" })).status).toBe(400);
    expect(
      (await request(app).post("/api/sessions").set(headers).send({ ...base, date: at(12, 9).toISOString(), status: "Inventado" })).status,
    ).toBe(400);
  });

  it("el pedagogo no puede crear sesiones para alumnos de otro (403)", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .send({ student: data.students.n1._id, date: at(12, 9).toISOString() });
    expect(res.status).toBe(403);
  });

  it("el admin puede crear sesiones para cualquier alumno", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(ADMIN))
      .send({ student: data.students.n1._id, date: at(13, 9).toISOString() });
    expect(res.status).toBe(201);
  });


  it("guarda la duración enviada", async () => {
    const notes = uniqueEmail("duracion");
    await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .send({ student: data.students.s1._id, date: at(14, 9).toISOString(), duration: 45, notes });

    expect((await Session.findOne({ notes })).duration).toBe(45);
  });

  it("una sesión creada por un admin debe quedar asignada al pedagogo del alumno, no al admin", async () => {
    const notes = uniqueEmail("admin-crea");
    await request(app)
      .post("/api/sessions")
      .set(await authHeader(ADMIN))
      .send({ student: data.students.s1._id, date: at(15, 9).toISOString(), notes });

    expect((await Session.findOne({ notes })).pedagogoAsignado.toString()).toBe(samanthaId.toString());
  });

  it("un student con id mal formado debe dar 400, no 500", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .send({ student: "id-invalido", date: at(16, 9).toISOString() });
    expect(res.status).toBe(400);
  });

  it("no debe permitir dos sesiones del mismo pedagogo a la misma hora", async () => {
    const headers = await authHeader(SAMANTHA);
    const date = at(40, 15).toISOString();
    const first = await request(app).post("/api/sessions").set(headers).send({ student: data.students.s1._id, date });
    const second = await request(app).post("/api/sessions").set(headers).send({ student: data.students.s2._id, date });

    expect(first.status).toBe(201);
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("debe borrar el archivo subido si la creación falla (falta la fecha)", async () => {
    await request(app)
      .post("/api/sessions")
      .set(await authHeader(SAMANTHA))
      .field("student", data.students.s1._id.toString())
      .attach("attachmentDocument", Buffer.from("pdf"), "informe.pdf");

    expect(deleteFile).toHaveBeenCalledTimes(1);
  });
});

// Listado: el pedagogo ve solo sus sesiones, el admin todas; llegan pobladas y ordenadas por fecha
describe("GET /api/sessions", () => {
  it("devuelve 401 sin token", async () => {
    expect((await request(app).get("/api/sessions")).status).toBe(401);
  });

  it("el pedagogo solo recibe sus sesiones, con alumno y pedagogo poblados", async () => {
    const res = await request(app).get("/api/sessions").set(await authHeader(SAMANTHA));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (const s of res.body) {
      expect(s.pedagogoAsignado.email).toBe(SAMANTHA);
      expect(s.student.name).toBeTruthy();
    }
  });

  it("el admin recibe sesiones de todos los pedagogos", async () => {
    const res = await request(app).get("/api/sessions").set(await authHeader(ADMIN));
    const owners = new Set(res.body.map((s) => s.pedagogoAsignado.email));
    expect(owners.has(SAMANTHA)).toBe(true);
    expect(owners.has("nathan@pedagogo.com")).toBe(true);
  });

  it("las sesiones deben llegar ordenadas por fecha", async () => {
    const pedagogo = await createUser();
    const student = await createStudent(pedagogo._id);
    // Se insertan deliberadamente desordenadas
    for (const offset of [20, 18, 19]) {
      await createSession({ student: student._id, pedagogoAsignado: pedagogo._id, date: at(offset, 10) });
    }

    const res = await request(app).get("/api/sessions").set(await authHeader(pedagogo.email));
    const times = res.body.map((s) => new Date(s.date).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

// Detalle: permisos por propietario (403), no encontrada (404) e id mal formado (400)
describe("GET /api/sessions/:id", () => {
  it("el pedagogo ve su sesión", async () => {
    const session = await ownSession();
    const res = await request(app).get(`/api/sessions/${session._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(200);
    expect(res.body.pedagogoAsignado.email).toBe(SAMANTHA);
  });

  it("el admin ve cualquier sesión", async () => {
    const res = await request(app).get(`/api/sessions/${data.sessions.sessionNathan._id}`).set(await authHeader(ADMIN));
    expect(res.status).toBe(200);
  });

  it("el pedagogo no ve sesiones de otro (403)", async () => {
    const res = await request(app).get(`/api/sessions/${data.sessions.sessionNathan._id}`).set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).get(`/api/sessions/${NEW_OBJECT_ID()}`).set(headers)).status).toBe(404);
    expect((await request(app).get("/api/sessions/id-invalido").set(headers)).status).toBe(400);
  });
});

// Edición: estado y notas, reasignación (solo admin), reemplazo del documento adjunto y limpieza de archivos subidos
describe("PUT /api/sessions/:id", () => {
  it("el pedagogo cambia el estado y las notas de su sesión", async () => {
    const session = await ownSession();
    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ status: "Completado", notes: "  Todo bien  " });

    expect(res.status).toBe(200);
    expect(res.body.updatedSession.status).toBe("Completado");
    expect(res.body.updatedSession.notes).toBe("Todo bien");
  });

  it("el pedagogo no puede reasignar la sesión a otro pedagogo (se ignora el campo)", async () => {
    const session = await ownSession();
    await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ pedagogoAsignado: data.users.nathan._id.toString() });

    expect((await Session.findById(session._id)).pedagogoAsignado.toString()).toBe(samanthaId.toString());
  });

  it("el admin sí puede reasignar la sesión", async () => {
    const session = await ownSession();
    await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(ADMIN))
      .send({ pedagogoAsignado: data.users.nathan._id.toString() });

    expect((await Session.findById(session._id)).pedagogoAsignado.toString()).toBe(data.users.nathan._id.toString());
  });

  it("el pedagogo no puede editar sesiones de otro (403)", async () => {
    const res = await request(app)
      .put(`/api/sessions/${data.sessions.sessionNathan._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ status: "Completado" });
    expect(res.status).toBe(403);
    expect((await Session.findById(data.sessions.sessionNathan._id)).status).toBe("Pendiente");
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).put(`/api/sessions/${NEW_OBJECT_ID()}`).set(headers).send({ notes: "x" })).status).toBe(404);
    expect((await request(app).put("/api/sessions/id-invalido").set(headers).send({ notes: "x" })).status).toBe(400);
  });

  it("al subir un documento nuevo borra el anterior (raw) y guarda el nuevo", async () => {
    const session = await ownSession({ attachmentDocument: OLD_DOC });
    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(SAMANTHA))
      .attach("attachmentDocument", Buffer.from("pdf"), "nuevo.pdf");

    expect(res.status).toBe(200);
    expect(res.body.updatedSession.attachmentDocument).toMatch(/documentos.*\.pdf$/);
    expect(deleteFile).toHaveBeenCalledWith(OLD_DOC, "raw");
  });

  it("borra el archivo subido si la sesión no existe o no es del pedagogo", async () => {
    const headers = await authHeader(SAMANTHA);
    await request(app).put(`/api/sessions/${NEW_OBJECT_ID()}`).set(headers).attach("attachmentDocument", Buffer.from("p"), "a.pdf");
    await request(app)
      .put(`/api/sessions/${data.sessions.sessionNathan._id}`)
      .set(headers)
      .attach("attachmentDocument", Buffer.from("p"), "a.pdf");

    expect(deleteFile).toHaveBeenCalledTimes(2);
  });


  it("un estado inválido debe dar 400, no 500", async () => {
    const session = await ownSession();
    const res = await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ status: "Inventado" });
    expect(res.status).toBe(400);
  });

  it("el pedagogo no debe poder mover su sesión al alumno de otro pedagogo", async () => {
    const session = await ownSession();
    await request(app)
      .put(`/api/sessions/${session._id}`)
      .set(await authHeader(SAMANTHA))
      .send({ student: data.students.n1._id.toString() });

    expect((await Session.findById(session._id)).student.toString()).toBe(session.student.toString());
  });
});

// Baja: solo el propietario o el admin; al borrar se elimina el documento adjunto (tipo raw) de Cloudinary
describe("DELETE /api/sessions/:id", () => {
  it("el pedagogo elimina su sesión y se borra su documento (raw)", async () => {
    const session = await ownSession({ attachmentDocument: OLD_DOC });
    const res = await request(app).delete(`/api/sessions/${session._id}`).set(await authHeader(SAMANTHA));

    expect(res.status).toBe(200);
    expect(await Session.findById(session._id)).toBeNull();
    expect(deleteFile).toHaveBeenCalledWith(OLD_DOC, "raw");
  });

  it("sin documento adjunto no llama a Cloudinary", async () => {
    const session = await ownSession();
    await request(app).delete(`/api/sessions/${session._id}`).set(await authHeader(SAMANTHA));
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("el pedagogo no puede eliminar sesiones de otro (403)", async () => {
    const res = await request(app)
      .delete(`/api/sessions/${data.sessions.sessionNathan._id}`)
      .set(await authHeader(SAMANTHA));
    expect(res.status).toBe(403);
    expect(await Session.findById(data.sessions.sessionNathan._id)).not.toBeNull();
  });

  it("el admin puede eliminar cualquier sesión", async () => {
    const session = await ownSession();
    const res = await request(app).delete(`/api/sessions/${session._id}`).set(await authHeader(ADMIN));
    expect(res.status).toBe(200);
  });

  it("devuelve 404 si no existe y 400 si el id es inválido", async () => {
    const headers = await authHeader(ADMIN);
    expect((await request(app).delete(`/api/sessions/${NEW_OBJECT_ID()}`).set(headers)).status).toBe(404);
    expect((await request(app).delete("/api/sessions/id-invalido").set(headers)).status).toBe(400);
  });
});
