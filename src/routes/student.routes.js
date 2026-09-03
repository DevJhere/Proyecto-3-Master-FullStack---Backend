/* RUTAS PARA ESTUDIANTES */
//1. Importamos la función del Controlador
import { getStudents } from "../controllers/studentController.js";

//Importamos el middleware
import { isAuth } from "../middlewares/auth.middleware.js";

//2. Importamos Express
import express from "express";

//3. Inicializamos Router
const router = express.Router();

//Definimos las rutas
router.get("/", isAuth, getStudents);

//Exportamos router
export default router;
