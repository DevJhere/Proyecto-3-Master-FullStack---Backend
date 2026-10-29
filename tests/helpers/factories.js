/* Fábricas para crear datos propios dentro de un test sin depender del seed compartido */
import bcrypt from "bcrypt";
import User from "../../src/models/User.js";
import Student from "../../src/models/Student.js";
import Session from "../../src/models/Sessions.js";
import { TEST_PASSWORD } from "./seed.js";

let counter = 0;
const nextId = () => {
  counter += 1;
  return `${Date.now()}.${counter}`;
};

// Email único por ejecución para no chocar con datos de otros tests
const uniqueEmail = (prefix = "user", domain = "test.com") => `${prefix}.${nextId()}@${domain}`;

// Crea un usuario directamente en la base (sin pasar por la API) con la contraseña de test
const createUser = async (overrides = {}) => {
  const password = await bcrypt.hash(TEST_PASSWORD, 4);
  return User.create({
    name: "Usuario Factory",
    email: uniqueEmail("factory"),
    password,
    specialization: "Logopedia",
    rol: "pedagogo",
    ...overrides,
  });
};

// Body válido para POST /api/students (sin pedagogoAsignado)
const validStudentBody = (overrides = {}) => ({
  name: `Alumno ${nextId()}`,
  age: 9,
  course: "4 Primaria",
  diagnosis: "Dislexia",
  nameTutor: "Tutor Factory",
  emailTutor: uniqueEmail("tutor"),
  phoneNumberTutor: "611111111",
  tutorRelationship: "Madre",
  ...overrides,
});

// Crea un alumno directamente en la base asignado al pedagogo indicado
const createStudent = (pedagogoAsignado, overrides = {}) =>
  Student.create({ ...validStudentBody(), pedagogoAsignado, ...overrides });

// Crea una sesión directamente en la base
const createSession = (overrides = {}) => Session.create({ date: new Date(), ...overrides });

export { uniqueEmail, createUser, validStudentBody, createStudent, createSession };
