/* Utils para eliminar archivos en cloudinary */
import { cloudinary } from "../config/cloudinary.js";

// Función reutilizable para eliminar archivos en Cloudinary
const deleteFile = async (urlDb, resource_type = "image") => {
  try {
    //1. Recibimos la url del archivo a eliminar

    if (!urlDb || urlDb === "") {
      return false;
    }

    const splitUrl = urlDb.split("/");
    // Usamos expresion regular para obtner directorio y nombre del archvo sin extension
    const nameFile = splitUrl[splitUrl.length - 1].split(".")[0]; //El último valor es el archivo, el split "." separa el nombre de la extensión
    const folderName = splitUrl[splitUrl.length - 2]; //El penúltimo valor es el nombre de la carpeta

    //El antepenúltimo valor es el nombre de la carpeta
    const anteFolderName = splitUrl[splitUrl.length - 3];

    //Reconstruimos el public_id con el formato de cloudinary
    const public_id = `${anteFolderName}/${folderName}/${nameFile}`;

    //Eliminamos el archivo
    await cloudinary.uploader.destroy(public_id, {
      //Debemos especificar el tipo de recurso para eliminarlo correctamente
      resource_type: resource_type, //Tipo de archivo
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
