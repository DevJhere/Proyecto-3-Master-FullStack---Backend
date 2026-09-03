/* RUTA DE AUTENTICACIÓN - Auth Routes */
//1. Importamos las funciones del controlador
import { userRegister, userLogin } from "../controllers/userController.js";

//2. Importamos Express
import express from "express";

//3. Inicializamos router
const router = express.Router();

//4. Definimos rutas
router.post("/register", userRegister);
router.post("/login", userLogin);

//5. Exportamos
export default router;
