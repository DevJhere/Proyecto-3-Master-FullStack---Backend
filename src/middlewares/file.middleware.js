/* CONFIGURACIÓN PARA EL MANEJO DE ARCHIVOS,SUBIDA Y RECEPCIÓN */
import { cloudinary } from "../config/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

//Creamos una instancia de Cloudinary
const storageImage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    //Nombre de la carpeta en Cloudinary
    folder: "API_pedagogia/avatars",
    //Formatos de archivos permitidos
    allowed_formats: ["jpg", "png", "webp", "jpeg"],
  },
});

const storageDocument = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    //Nombre de la carpeta en Cloudinary
    folder: "API_pedagogia/documentos",
    //Formatos de archivos permitidos
    allowed_formats: ["pdf", "doc", "docx", "txt"],
    resource_type: "auto", //Detecta el formato automáticamente
  },
});

//Configuramos Multer - Toda la información almacenada en Cloudinary la recibe upload
const uploadImage = multer({
  storage: storageImage,
  limits: { fileSize: 5 * 1024 * 1024 }, //Tamaño máximo de 5MB
});

const uploadDocument = multer({
  storage: storageDocument,
  limits: { fileSize: 20 * 1024 * 1024 }, //Tamaño máximo de 20MB
});

//Exportamos
export { uploadImage, uploadDocument };
