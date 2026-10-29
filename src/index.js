import dotenv from "dotenv";

//Importamos la configuración de la base de datos
import { connectDB } from "./config/db.js";

//Importamos la configuración de Cloudinary
import connectCloudinary from "./config/cloudinary.js";

//Importamos la aplicación Express (rutas y middlewares)
import app from "./app.js";

//Llama a la config de la base de datos
dotenv.config();

//1. Ejecutamos la conexión a la base de datos
connectDB();

//Conectamos a Cloudinary
connectCloudinary();

//2. Definimos puerto
const PORT = process.env.PORT || 3000;

//3. Arrancamos el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
