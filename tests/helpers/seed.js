/* Datos de prueba: 1 admin, 2 pedagogos, 5 alumnos y 4 sesiones. Se usan tanto en los tests de API como en los E2E. */
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../../src/models/User.js";
import Student from "../../src/models/Student.js";
import Session from "../../src/models/Sessions.js";
import { assertTestDb } from "./guard.js";

const TEST_PASSWORD = "password1234";

const connectTestDb = async () => {
  assertTestDb();
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.DB_URL, { family: 4 });
  // Garantiza que los índices (p. ej. email único) existen antes de que empiecen los tests
  await Promise.all([User.init(), Student.init(), Session.init()]);
};

const disconnectTestDb = async () => {
  await mongoose.disconnect();
};

// Vacía solo las colecciones de la app (no dropea la base)
const resetDb = async () => {
  assertTestDb();
  await Promise.all([Session.deleteMany({}), Student.deleteMany({}), User.deleteMany({})]);
};

// Fecha relativa a hoy: at(0, 10) = hoy a las 10:00 (hora local), at(-1, 10) = ayer
const at = (dayOffset, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const studentBase = (n, pedagogoAsignado, extra = {}) => ({
  name: `Alumno Test ${n}`,
  course: "3 Primaria",
  age: 8,
  diagnosis: "Dislexia",
  nameTutor: `Tutor Test ${n}`,
  emailTutor: `tutor${n}@correo.com`,
  phoneNumberTutor: "600000000",
  tutorRelationship: "Madre",
  pedagogoAsignado,
  ...extra,
});

const seedTestData = async () => {
  // Hash con coste bajo: más rápido y bcrypt.compare funciona igual con cualquier coste
  const password = await bcrypt.hash(TEST_PASSWORD, 4);

  const [admin, samantha, nathan] = await User.create([
    { name: "Jheremi Admin", email: "jheremi@admin.com", password, specialization: "Orientación Educativa", rol: "admin" },
    { name: "Samantha Test", email: "samatha@pedagogo.com", password, specialization: "Psicología Educativa", rol: "pedagogo" },
    { name: "Nathan Test", email: "nathan@pedagogo.com", password, specialization: "Logopedia", rol: "pedagogo" },
  ]);

  // 3 alumnos de Samantha y 2 de Nathan (para probar permisos cruzados)
  const [s1, s2, s3, n1, n2] = await Student.create([
    studentBase(1, samantha._id),
    studentBase(2, samantha._id, { course: "1 Primaria", age: 6, diagnosis: "Disgrafía" }),
    studentBase(3, samantha._id, { course: "Infantil 4 años", age: 4, diagnosis: "Retraso del Lenguaje" }),
    studentBase(4, nathan._id, { course: "2 ESO", age: 13, diagnosis: "TDAH" }),
    studentBase(5, nathan._id, { course: "5 Primaria", age: 10, diagnosis: "TEA" }),
  ]);

  const [sessionToday, sessionDone, sessionCancelled, sessionNathan] = await Session.create([
    { student: s1._id, pedagogoAsignado: samantha._id, date: at(0, 10), status: "Pendiente", notes: "Sesión de hoy" },
    { student: s1._id, pedagogoAsignado: samantha._id, date: at(-1, 10), status: "Completado", notes: "Sesión realizada" },
    { student: s2._id, pedagogoAsignado: samantha._id, date: at(1, 12), status: "Cancelado", notes: "Sesión cancelada" },
    { student: n1._id, pedagogoAsignado: nathan._id, date: at(0, 11), status: "Pendiente", notes: "Sesión de Nathan" },
  ]);

  return {
    password: TEST_PASSWORD,
    users: { admin, samantha, nathan },
    students: { s1, s2, s3, n1, n2 },
    sessions: { sessionToday, sessionDone, sessionCancelled, sessionNathan },
  };
};

export { TEST_PASSWORD, connectTestDb, disconnectTestDb, resetDb, seedTestData, at };
