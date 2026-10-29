/* Fábricas para crear datos propios dentro de un test sin depender del seed compartido */
import bcrypt from "bcrypt";
import User from "../../src/models/User.js";
import { TEST_PASSWORD } from "./seed.js";

let counter = 0;

// Email único por ejecución para no chocar con datos de otros tests
const uniqueEmail = (prefix = "user", domain = "test.com") => {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@${domain}`;
};

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

export { uniqueEmail, createUser };
