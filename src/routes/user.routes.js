/* RUTA DE USUARIOS - User Routes */
//1. Importamos las funciones del controlador
import {
  deleteUser,
  updateProfileUser,
  getAllUsers,
} from "../controllers/userController.js";

//Importamos middleware de protección de rutas
import { isAuth } from "../middlewares/auth.middleware.js";

//2. Importamos Express
import express from "express";

//Importamos el middleware de archivos
import { uploadImage } from "../middlewares/file.middleware.js";

//3. Inicializamos router
const router = express.Router();

//4. Definimos rutas
router.delete("/:id", isAuth, deleteUser);
router.put("/:id", isAuth, uploadImage.single("avatar"), updateProfileUser);
router.get("/", isAuth, getAllUsers);

//5. Exportamos
export default router;
