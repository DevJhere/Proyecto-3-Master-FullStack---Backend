/* RUTA DE USUARIOS - User Routes */
//1. Importamos las funciones del controlador
import { deleteUser } from "../controllers/userController.js";

//Importamos middleware de protección de rutas
import { isAuth } from "../middlewares/auth.middleware.js";

//2. Importamos Express
import express from "express";

//3. Inicializamos router
const router = express.Router();

//4. Definimos rutas
router.delete("/:id", isAuth, deleteUser);

//5. Exportamos
export default router;