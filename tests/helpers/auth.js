/* Helpers de autenticación para los tests de API */
import request from "supertest";
import app from "../../src/app.js";
import { TEST_PASSWORD } from "./seed.js";

// Hace login real contra la API y devuelve el header Authorization listo para usar
const authHeader = async (email, password = TEST_PASSWORD) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login de test fallido para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { Authorization: `Bearer ${res.body.token}` };
};

export { authHeader };
