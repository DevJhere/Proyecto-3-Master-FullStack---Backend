/* CONTROLLER PARA USUARIOS */

//1. Importamos los modelos
import User from "../models/User.js";

//2. Importamos librerias de seguridad
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

//3. Creamos la función para Registrar un Usuario/Pedagogo
const userRegister = async (req, res) => {
  try {
    //1. Obtenemos los datos del usuario - Destructuring
    const { name, email, password, specialization, avatar } = req.body;

    //2. Verficiamos si los datos recuperados son correctos o estan completos
    if (!name || !email || !password || !specialization) {
      return res.status(400).json({
        message: "Datos incompletos o incorrectos",
        error: "Debes rellenar todos los campos requeridos",
      });
    }

    //3. Verificamos si existe el usuario con el email
    const userRegistered = await User.findOne({ email });

    if (userRegistered) {
      return res.status(400).json({
        message: "Usuario ya registrado",
        error: "El correo electrónico ya está registrado",
      });
    }

    //4. Encriptamos la contraseña
    const passwordSalt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, passwordSalt);

    //5. Definimos el Rol
    let rol = "pedagogo";

    if (email.includes("@admin.com")) {
      rol = "admin";
    } else {
      rol = "pedagogo";
    }

    //6 Creamos el nuevo usuario
    await User.create({
      name,
      email,
      password: passwordHash,
      specialization,
      rol,
      avatar,
    });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
    });
  } catch (error) {
    console.log(error);

    //Verificamos en caso de no obtener los datos completos del usuario y en cualquier otro caso
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos del usuario",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        message: "Error al registrar usuario",
        error: error.message,
      });
    }
  }
};

//Exportamos el controlador
export { userRegister };
