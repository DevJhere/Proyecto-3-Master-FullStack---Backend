/* ARCHIVO PARA LA CONFIGURACIÓN DE CLOUDINARY */
import { v2 as cloudinary } from "cloudinary";

// Definimos la función para conectarnos a Cloudinary
const connectCloudinary = () => {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log("Conexión a CLOUDINARY establecida correctamente");
  } catch (error) {
    console.log("Error al conectar con Cloudinary:", error);
  }
};

//Exportamos la función
export { cloudinary };
export default connectCloudinary;
