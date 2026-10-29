/* Utils para eliminar archivos en cloudinary */
import { cloudinary } from "../config/cloudinary.js";

//Estructura de las URL de Cloudinary: https://res.cloudinary.com/<cloud>/<tipo>/upload/[v<version>/]<public_id>[.<ext>]
const CLOUDINARY_URL = /\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/;

// Función reutilizable para eliminar archivos en Cloudinary
const deleteFile = async (urlDb, resource_type = "image") => {
  try {
    //1. Recibimos la url del archivo a eliminar

    if (!urlDb || urlDb === "") {
      return false;
    }

    //2. Obtenemos el tipo de recurso y el public_id a partir de la URL
    const match = urlDb.match(CLOUDINARY_URL);

    //Si no es una URL de Cloudinary (p. ej. el nombre del avatar por defecto) no hay nada que borrar
    if (!match) {
      return false;
    }

    //El tipo real de recurso está en la URL: los PDF se guardan como "image" y doc/docx/txt como "raw"
    const [, detectedType, path] = match;

    //Las imágenes y vídeos no incluyen la extensión en el public_id, los archivos "raw" sí
    const public_id = detectedType === "raw" ? path : path.replace(/\.[^./]+$/, "");

    //Eliminamos el archivo
    await cloudinary.uploader.destroy(decodeURIComponent(public_id), {
      //Debemos especificar el tipo de recurso para eliminarlo correctamente
      resource_type: detectedType || resource_type, //Tipo de archivo
    });

    return true;
  } catch (error) {
    console.log(error.message);
    //Debería devolver un false
    return false;
  }
};

//Exportamos
export default deleteFile;
