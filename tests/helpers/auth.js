/* Helpers de autenticación para los tests de API */
import request from "supertest";
import app from "../../src/app.js";
import { TEST_PASSWORD } from "./seed.js";

// Caché por archivo de test (los módulos se aíslan por archivo): evita repetir logins contra la base remota
const cache = new Map();

// Hace login real contra la API y devuelve el header Authorization listo para usar
const authHeader = async (email, password = TEST_PASSWORD) => {
  const key = `${email}:${password}`;
  if (cache.has(key)) return cache.get(key);

  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login de test fallido para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const header = { Authorization: `Bearer ${res.body.token}` };
  cache.set(key, header);
  return header;
};

export { authHeader };
