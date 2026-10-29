/* Tests de POST /api/students/:id/reports (informes de un alumno).
   La validación de formato/tamaño del archivo la hace multer + Cloudinary, que aquí están mockeados: no se cubre en este archivo. */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import Student from "../src/models/Student.js";
import deleteFile from "../src/utils/deleteFiles.js";
import { connectTestDb, disconnectTestDb, resetDb, seedTestData } from "./helpers/seed.js";
import { authHeader } from "./helpers/auth.js";
import { createStudent } from "./helpers/factories.js";

const ADMIN = "jheremi@admin.com";
const SAMANTHA = "samatha@pedagogo.com";
const NEW_OBJECT_ID = () => new mongoose.Types.ObjectId().toString();

let data;

const uploadReport = async (studentId, headers, { title, file = true } = {}) => {
  const req = request(app).post(`/api/students/${studentId}/reports`).set(headers);
  if (title !== undefined) req.field("title", title);
  if (file) req.attach("attachmentDocument", Buffer.from("pdf"), "informe.pdf");
  else req.field("sin", "archivo"); // fuerza multipart sin adjuntar archivo
  return req;
};

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

describe("POST /api/students/:id/reports", () => {
  it("devuelve 401 sin token", async () => {
    const res = await request(app).post(`/api/students/${data.students.s1._id}/reports`);
    expect(res.status).toBe(401);
  });

  it("el pedagogo sube un informe a su alumno y se guarda en la base", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await uploadReport(student._id, await authHeader(SAMANTHA), { title: "  Informe inicial  " });

    expect(res.status).toBe(201);
    expect(res.body.report.title).toBe("Informe inicial");
    expect(res.body.report.attachmentDocument).toMatch(/documentos.*\.pdf$/);
    expect(res.body.reports).toHaveLength(1);

    const saved = await Student.findById(student._id);
    expect(saved.reports).toHaveLength(1);
    expect(saved.reports[0].title).toBe("Informe inicial");
  });

  it("los informes nuevos se añaden al principio de la lista", async () => {
    const student = await createStudent(data.users.samantha._id);
    const headers = await authHeader(SAMANTHA);
    await uploadReport(student._id, headers, { title: "Primero" });
    const res = await uploadReport(student._id, headers, { title: "Segundo" });

    expect(res.body.reports.map((r) => r.title)).toEqual(["Segundo", "Primero"]);
  });

  it("sin título usa el título por defecto", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await uploadReport(student._id, await authHeader(SAMANTHA), { title: "   " });
    expect(res.body.report.title).toBe("Intervención sin evaluar");
  });

  it("el informe aparece en el detalle del alumno", async () => {
    const student = await createStudent(data.users.samantha._id);
    const headers = await authHeader(SAMANTHA);
    await uploadReport(student._id, headers, { title: "Visible" });

    const res = await request(app).get(`/api/students/${student._id}`).set(headers);
    expect(res.body.reports.map((r) => r.title)).toEqual(["Visible"]);
  });

  it("el admin puede subir informes a cualquier alumno", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await uploadReport(student._id, await authHeader(ADMIN), { title: "Del admin" });
    expect(res.status).toBe(201);
  });

  it("devuelve 400 si no se adjunta ningún archivo", async () => {
    const student = await createStudent(data.users.samantha._id);
    const res = await uploadReport(student._id, await authHeader(SAMANTHA), { title: "Sin archivo", file: false });
    expect(res.status).toBe(400);
    expect((await Student.findById(student._id)).reports).toHaveLength(0);
  });

  it("devuelve 404 si el alumno no existe", async () => {
    const res = await uploadReport(NEW_OBJECT_ID(), await authHeader(SAMANTHA), { title: "X" });
    expect(res.status).toBe(404);
  });

  it("un pedagogo no puede subir informes a alumnos de otro pedagogo (403) y no se guarda nada", async () => {
    const res = await uploadReport(data.students.n1._id, await authHeader(SAMANTHA), { title: "Intruso" });

    expect(res.status).toBe(403);
    expect((await Student.findById(data.students.n1._id)).reports).toHaveLength(0);
  });

  it("devuelve 400 si el id del alumno está mal formado", async () => {
    const res = await uploadReport("id-invalido", await authHeader(SAMANTHA), { title: "X" });
    expect(res.status).toBe(400);
  });

  describe("borra el archivo subido cuando el informe no se guarda", () => {
    it("porque el alumno no existe", async () => {
      await uploadReport(NEW_OBJECT_ID(), await authHeader(SAMANTHA), { title: "X" });
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("porque el alumno es de otro pedagogo", async () => {
      await uploadReport(data.students.n1._id, await authHeader(SAMANTHA), { title: "X" });
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("porque el id está mal formado", async () => {
      await uploadReport("id-invalido", await authHeader(SAMANTHA), { title: "X" });
      expect(deleteFile).toHaveBeenCalledTimes(1);
    });

    it("pero no lo borra cuando el informe se guarda correctamente", async () => {
      const student = await createStudent(data.users.samantha._id);
      await uploadReport(student._id, await authHeader(SAMANTHA), { title: "Correcto" });
      expect(deleteFile).not.toHaveBeenCalled();
    });
  });
});
