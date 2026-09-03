/* CONTROLLER PARA USUARIOS */

//1. Importamos los modelos
import User from "../models/User.js";

//2. Importamos librerias de seguridad
import bcrypt from "bcrypt";
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
    const rol = email.includes("@admin.com") ? "admin" : "pedagogo";

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

//4. Creamos la función Login
const userLogin = async (req, res) => {
  try {
    //1. Recuperamos los datos de email y password
    const { email, password } = req.body;

    //Comprobación petición sin email o sin contraseña
    if (!email || !password) {
      return res.status(400).json({
        error: "Campos obligatorios de email o contraseña no completados",
      });
    }

    //2. Verificamos si el usuario existe
    const user = await User.findOne({ email }).select("+password"); //+password para poder obtenerla ya que es private en el modelo

    if (!user) {
      return res.status(401).json({
        error: "Usuario no registrado",
      });
    }

    //Verificamos si la contraseña es correcta
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Email o contraseña incorrectos",
      });
    }

    //3. Generamos TOKEN de JWT si la contraseña es válida
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    //4. Enviamos el TOKEN al cliente con la respuesta exitosa
    return res.status(200).json({ message: "Login exitoso", token });
  } catch (error) {
    console.log(error);

    return res.status(400).json({
      message: "Error al iniciar sesión",
      error: error.message,
    });
  }
};
//Exportamos el controlador
export { userRegister, userLogin };
