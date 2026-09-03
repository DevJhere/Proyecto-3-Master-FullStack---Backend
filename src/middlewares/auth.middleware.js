/* Middleware para verificar que la petición se ha realizado desde un usuario autorizado */
//Importamos librerias de seguridad
import jwt from "jsonwebtoken";
//Importamos el modelo de Usuario
import User from "../models/User.js";

//Definimos Función - Usuario autenticado
const isAuth = async (req, res, next) => {
  try {
    //1. Obtenemos el token en la cabecera - Authorization: Bearer <token>
    const token = req.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Token no proporcionado o formato incorrecto.",
        details:
          "Asegúrate de enviar el token en el formato Authorization: Bearer <token>",
      });
    }

    //2. Extraemos el token sin el prefijo 'Bearer'
    const tokenClean = token.split(" ")[1]; //Dividimos la cabecera por el espacio

    //3. Verificamos el token
    const decoded = jwt.verify(tokenClean, process.env.JWT_SECRET);

    //4. Buscamos el usuario por ID
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: "Usuario no autenticado",
      });
    }

    //5. Exito verificación entonces guardamos datos ID - user en la petición
    req.user = user;

    //6. Autorizamos paso al siguiente middleware o ruta
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      error: "Token inválido o expirado",
      details: error.message,
    });
  }
};
//Exportamos el middleware
export { isAuth };
