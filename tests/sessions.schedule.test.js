/* Tests de solapes de horario y gestión de archivos al crear/editar sesiones (POST y PUT /api/sessions). */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import Session from "../src/models/Sessions.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData, at } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createStudent, createSession, createUser } from "./helpers/factories.js";

const ADMIN = "jheremi@admin.com";
const OLD_DOC = "https://res.cloudinary.com/test/raw/upload/v1/API_pedagogia/documentos/viejo.pdf";

let data;

// Base limpia + datos del seed antes de ejecutar el archivo
beforeAll(async () => {
  await connectTestDb();
  await resetDb();
  data = await seedTestData();
});

// Reinicia el spy de deleteFile para contar solo las llamadas de cada test
beforeEach(() => {
  deleteFile.mockClear();
});

afterAll(async () => {
  await disconnectTestDb();
});

// Un pedagogo nuevo con un alumno, para que cada test trabaje en un calendario vacío
const freshTeacher = async () => {
  const pedagogo = await createUser();
  const student = await createStudent(pedagogo._id);
  const headers = await authHeader(pedagogo.email);
  return { pedagogo, student, headers };
};

// Fecha ISO del día 50 a la hora y minutos indicados
const slot = (hour, minute = 0) => {
  const d = at(50, hour);
  d.setMinutes(minute);
  return d.toISOString();
};

// Crea una sesión vía API (POST) para el alumno del pedagogo; permite cambiar el usuario que hace la petición
const book = (teacher, date, extra = {}, headers = teacher.headers) =>
  request(app)
    .post("/api/sessions")
    .set(headers)
    .send({ student: teacher.student._id, date, ...extra });

// Inserta una sesión directamente en la base (sin pasar por la regla de solapes), útil para preparar escenarios
const sessionAt = (teacher, date, overrides = {}) =>
  createSession({ student: teacher.student._id, pedagogoAsignado: teacher.pedagogo._id, date: new Date(date), ...overrides });

// Regla de solapes al crear: un pedagogo no puede tener dos sesiones activas a la vez (409).
// Cuenta la duración de ambas sesiones, ignora las canceladas y es independiente entre pedagogos.
describe("POST /api/sessions: solapes de horario", () => {
  it("rechaza con 409 una sesión que empieza mientras otra está en curso", async () => {
    const t = await freshTeacher();
    expect((await book(t, slot(10))).status).toBe(201);

    const res = await book(t, slot(10, 30));
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Horario no disponible");
    expect(await Session.countDocuments({ student: t.student._id })).toBe(1);
  });

  it("rechaza dos sesiones exactamente a la misma hora", async () => {
    const t = await freshTeacher();
    await book(t, slot(10));
    expect((await book(t, slot(10))).status).toBe(409);
  });

  it("permite sesiones consecutivas: una empieza cuando acaba la otra", async () => {
    const t = await freshTeacher();
    const statuses = [(await book(t, slot(10))).status, (await book(t, slot(11))).status, (await book(t, slot(9))).status];
    expect(statuses).toEqual([201, 201, 201]);
  });

  it("tiene en cuenta la duración de la sesión que ya existe", async () => {
    const t = await freshTeacher();
    await book(t, slot(10), { duration: 90 });

    expect((await book(t, slot(11))).status).toBe(409);
    expect((await book(t, slot(11, 30))).status).toBe(201);
  });

  it("tiene en cuenta la duración de la sesión nueva", async () => {
    const t = await freshTeacher();
    await book(t, slot(11));

    expect((await book(t, slot(10, 30))).status).toBe(409);
    expect((await book(t, slot(10))).status).toBe(201);
  });

  it("una sesión cancelada no bloquea el horario", async () => {
    const t = await freshTeacher();
    await sessionAt(t, slot(10), { status: "Cancelado" });

    expect((await book(t, slot(10))).status).toBe(201);
  });

  it("crear una sesión ya cancelada no comprueba el horario", async () => {
    const t = await freshTeacher();
    await book(t, slot(10));

    expect((await book(t, slot(10), { status: "Cancelado" })).status).toBe(201);
  });

  it("otro pedagogo puede tener una sesión a la misma hora", async () => {
    const a = await freshTeacher();
    const b = await freshTeacher();
    await book(a, slot(10));

    expect((await book(b, slot(10))).status).toBe(201);
  });

  it("las sesiones creadas por un admin se comprueban contra el horario del pedagogo del alumno", async () => {
    const t = await freshTeacher();
    await book(t, slot(10));

    const res = await book(t, slot(10), {}, await authHeader(ADMIN));
    expect(res.status).toBe(409);
  });

  it("borra el archivo subido cuando la sesión se rechaza por solape", async () => {
    const t = await freshTeacher();
    await book(t, slot(10));

    const res = await request(app)
      .post("/api/sessions")
      .set(t.headers)
      .field("student", t.student._id.toString())
      .field("date", slot(10))
      .attach("attachmentDocument", Buffer.from("pdf"), "informe.pdf");

    expect(res.status).toBe(409);
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });

  it.each([0, -5, "abc"])("devuelve 400 con una duración inválida (%s)", async (duration) => {
    const t = await freshTeacher();
    const res = await book(t, slot(10), { duration });
    expect(res.status).toBe(400);
  });
});

// Regla de solapes al editar: solo se comprueba si cambia fecha, duración o se reactiva una cancelada.
// Además verifica que no se pierda el documento anterior ni queden archivos nuevos huérfanos si la edición falla.
describe("PUT /api/sessions/:id: solapes de horario y archivos", () => {
  const put = (teacher, sessionId, body, headers = teacher.headers) =>
    request(app).put(`/api/sessions/${sessionId}`).set(headers).send(body);

  it("rechaza con 409 mover la sesión a un horario ocupado y no la modifica", async () => {
    const t = await freshTeacher();
    await sessionAt(t, slot(12));
    const mine = await sessionAt(t, slot(10));

    const res = await put(t, mine._id, { date: slot(12) });

    expect(res.status).toBe(409);
    expect((await Session.findById(mine._id)).date.toISOString()).toBe(slot(10));
  });

  it("permite mover la sesión a un horario libre", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10));

    const res = await put(t, mine._id, { date: slot(15) });
    expect(res.status).toBe(200);
    expect((await Session.findById(mine._id)).date.toISOString()).toBe(slot(15));
  });

  it("una sesión no choca consigo misma al guardarse con el mismo horario", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10));

    const res = await put(t, mine._id, { date: slot(10), notes: "Mismo horario" });
    expect(res.status).toBe(200);
  });

  it("rechaza ampliar la duración si pasa a solaparse con la siguiente", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10));
    await sessionAt(t, slot(11));

    expect((await put(t, mine._id, { duration: 90 })).status).toBe(409);
    expect((await put(t, mine._id, { duration: 60 })).status).toBe(200);
  });

  it("rechaza reactivar una sesión cancelada si su horario ya está ocupado", async () => {
    const t = await freshTeacher();
    const cancelled = await sessionAt(t, slot(10), { status: "Cancelado" });
    await sessionAt(t, slot(10));

    const res = await put(t, cancelled._id, { status: "Pendiente" });
    expect(res.status).toBe(409);
    expect((await Session.findById(cancelled._id)).status).toBe("Cancelado");
  });

  it("permite reactivar una sesión cancelada si su horario está libre", async () => {
    const t = await freshTeacher();
    const cancelled = await sessionAt(t, slot(10), { status: "Cancelado" });

    expect((await put(t, cancelled._id, { status: "Pendiente" })).status).toBe(200);
  });

  it("cambiar solo el estado o las notas no comprueba solapes (datos anteriores a esta regla)", async () => {
    const t = await freshTeacher();
    const first = await sessionAt(t, slot(10));
    await sessionAt(t, slot(10, 30)); // se solapa con la primera, como podía ocurrir antes

    expect((await put(t, first._id, { status: "Completado" })).status).toBe(200);
    expect((await put(t, first._id, { notes: "Solo notas" })).status).toBe(200);
  });

  it.each([
    ["una fecha inválida", { date: "no-es-fecha" }],
    ["una duración de 0", { duration: 0 }],
    ["una duración no numérica", { duration: "abc" }],
  ])("devuelve 400 con %s", async (_, body) => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10));
    expect((await put(t, mine._id, body)).status).toBe(400);
  });

  it("borra el archivo nuevo, y conserva el anterior, si la edición se rechaza por solape", async () => {
    const t = await freshTeacher();
    await sessionAt(t, slot(12));
    const mine = await sessionAt(t, slot(10), { attachmentDocument: OLD_DOC });

    const res = await request(app)
      .put(`/api/sessions/${mine._id}`)
      .set(t.headers)
      .field("date", slot(12))
      .attach("attachmentDocument", Buffer.from("pdf"), "nuevo.pdf");

    expect(res.status).toBe(409);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).not.toHaveBeenCalledWith(OLD_DOC, "raw");
    expect((await Session.findById(mine._id)).attachmentDocument).toBe(OLD_DOC);
  });

  it("conserva el documento anterior si la edición falla por un estado inválido", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10), { attachmentDocument: OLD_DOC });

    const res = await request(app)
      .put(`/api/sessions/${mine._id}`)
      .set(t.headers)
      .field("status", "Inventado")
      .attach("attachmentDocument", Buffer.from("pdf"), "nuevo.pdf");

    expect(res.status).toBe(400);
    expect(deleteFile).toHaveBeenCalledTimes(1); // solo el archivo recién subido
    expect(deleteFile).not.toHaveBeenCalledWith(OLD_DOC, "raw");
  });

  it("el pedagogo no puede cambiar el documento adjunto enviando una URL en el body", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10), { attachmentDocument: OLD_DOC });

    await put(t, mine._id, { attachmentDocument: "http://evil.example/x.pdf", notes: "ok" });

    const saved = await Session.findById(mine._id);
    expect(saved.attachmentDocument).toBe(OLD_DOC);
    expect(saved.notes).toBe("ok");
  });

  it("el admin sí puede mover una sesión a otro alumno", async () => {
    const t = await freshTeacher();
    const mine = await sessionAt(t, slot(10));

    const res = await put(t, mine._id, { student: data.students.n1._id.toString() }, await authHeader(ADMIN));
    expect(res.status).toBe(200);
    expect((await Session.findById(mine._id)).student.toString()).toBe(data.students.n1._id.toString());
  });
});
