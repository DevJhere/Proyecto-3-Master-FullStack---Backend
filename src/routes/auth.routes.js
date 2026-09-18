/* RUTA DE AUTENTICACIÓN - Auth Routes */
//1. Importamos las funciones del controlador
import {
  userRegister,
  userLogin,
  getMe,
} from "../controllers/userController.js";
import { isAuth } from "../middlewares/auth.middleware.js";

//Importamos middleware de gestión de archivos
import { uploadImage } from "../middlewares/file.middleware.js";

//2. Importamos Express
import express from "express";

//3. Inicializamos router
const router = express.Router();

//4. Definimos rutas del campo en el frontend para enviar el archivo
router.post("/register", uploadImage.single("avatar"), userRegister); //"avatar" tiene que coincidir con el nombre del archivo
router.post("/login", userLogin);
router.get("/me", isAuth, getMe);

//5. Exportamos
export default router;
