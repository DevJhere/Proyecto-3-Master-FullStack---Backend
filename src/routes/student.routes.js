/* RUTAS PARA ESTUDIANTES */
//1. Importamos las funciones del Controlador Student
import {
  getStudents,
  getStudentByID,
  updateStudent,
  deleteStudent,
  createStudent,
} from "../controllers/studentController.js";

//Importamos el middleware
import { isAuth } from "../middlewares/auth.middleware.js";

//2. Importamos Express
import express from "express";
import { uploadImage } from "../middlewares/file.middleware.js";

//3. Inicializamos Router
const router = express.Router();

//Definimos las rutas
router.get("/", isAuth, getStudents);
router.get("/:id", isAuth, getStudentByID);
router.put("/:id", isAuth, uploadImage.single("avatar"), updateStudent);
router.post("/", isAuth, uploadImage.single("avatar"), createStudent);
router.delete("/:id", isAuth, deleteStudent);

//Exportamos router
export default router;
