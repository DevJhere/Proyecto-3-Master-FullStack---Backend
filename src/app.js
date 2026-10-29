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

//1. Inicializamos Express
const app = express();

//2. Configurar middleware
//Permite que express entienda el json que viene del frontend
app.use(express.json());

//Habilitamos peticiones cors para poder trabajar con el frontend - React
app.use(cors());

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
