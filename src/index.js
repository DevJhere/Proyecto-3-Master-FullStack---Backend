import dotenv from "dotenv";

//Importamos la configuración de la base de datos
import { connectDB } from "./config/db.js";
//Importamos Student
import studentRoutes from "./routes/student.routes.js";
//Importamos Express
import express from "express";

//Llama a la config de la base de datos
dotenv.config();

//1. Ejecutamos la conexión a la base de datos
connectDB();

//2. Inicializamos Express
const app = express();

//3. Configurar middleware
//Permite que express entienda el json que viene del frontend
app.use(express.json());

//4. Definimos puerto
const PORT = process.env.PORT || 3000;

//5. Definimos Rutas de la API
app.use("/api/students", studentRoutes);

//6. Conexión a la Base de Datos y arrancar servidor
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint no encontrado" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
