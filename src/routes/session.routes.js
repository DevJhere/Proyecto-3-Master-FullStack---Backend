/* Definición de rutas para las Sesiones */
import {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
} from "../controllers/sessionsController.js";
import { uploadDocument } from "../middlewares/file.middleware.js";
import { isAuth } from "../middlewares/auth.middleware.js";
import express from "express";

const router = express.Router();

//Definimos las routes
//Método POST - Endpoint: /api/sessions
router.post(
  "/",
  isAuth,
  uploadDocument.single("attachmentDocument"),
  createSession,
);

//Método GET - Endpoint: /api/sessions
router.get("/", isAuth, getSessions);
router.get("/:id", isAuth, getSessionById);
router.put("/:id", isAuth, uploadDocument.single("attachmentDocument"), updateSession);
router.delete("/:id", isAuth, deleteSession);

//Exportamos
export default router;
