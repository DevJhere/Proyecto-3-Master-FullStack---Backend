/* Configuración de la aplicación Express. No arranca el servidor ni conecta a la DB, así se puede importar desde los tests. */
//Importamos las rutas
import studentRoutes from "./routes/student.routes.js";
import authRoutes from "./routes/auth.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import userRoutes from "./routes/user.routes.js";

//Importamos Express
import express from "express";

//Importamos cors
import cors from "cors";

//CAMBIO (seguridad del backend): helmet añade cabeceras HTTP de seguridad y corsOptions limita qué frontends pueden usar la API
import helmet from "helmet";
import { corsOptions } from "./middlewares/security.middleware.js";

//1. Inicializamos Express
const app = express();

//CAMBIO (seguridad del backend): detrás de un proxy (Render, Railway...) la IP real del cliente llega en X-Forwarded-For.
//Con TRUST_PROXY=1 Express la usa, y así el límite de intentos de login cuenta por cliente y no por la IP del proxy.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

//2. Configurar middleware
//CAMBIO (seguridad del backend): cabeceras de seguridad (X-Content-Type-Options, Strict-Transport-Security, etc.). Va el primero para que afecte a todas las respuestas.
app.use(helmet());

//Permite que express entienda el json que viene del frontend
app.use(express.json());

//Habilitamos peticiones cors para poder trabajar con el frontend - React
//CAMBIO (seguridad del backend): antes cors() permitía cualquier origen; ahora solo los definidos en CORS_ORIGIN (ver security.middleware.js)
app.use(cors(corsOptions));

//3. Definimos Rutas de la API
app.use("/api/students", studentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/users", userRoutes);

//4. Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint no encontrado" });
});

//Exportamos
export default app;
