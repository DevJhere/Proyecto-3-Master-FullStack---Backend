/* CONTROLLER PARA USUARIOS */

//1. Importamos los modelos
import User from "../models/User.js";
import Student from "../models/Student.js";
import Session from "../models/Sessions.js";
import deleteFile from "../utils/deleteFiles.js";

//2. Importamos librerias de seguridad
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//3. Creamos la función para Registrar un Usuario/Pedagogo
const userRegister = async (req, res) => {
  try {
    //1. Obtenemos los datos del usuario - Destructuring
    const { name, email, password, specialization } = req.body;

    //Si hay archivo, guardamos la ruta, si no, undefined
    let avatar = req.file ? req.file.path : undefined;

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

    // Mejora de Autenticación - Recupeacion el usuario logueado
    const userToReturn = user.toObject();
    delete userToReturn.password; //Eliminamos la contraseña hash por seguridad para que no se visualice

    //4. Enviamos el TOKEN al cliente con la respuesta exitosa
    return res.status(200).json({
      message: "Login exitoso",
      token,
      user: userToReturn,
    });
  } catch (error) {
    console.log(error);

    return res.status(400).json({
      message: "Error al iniciar sesión",
      error: error.message,
    });
  }
};

//5. Función para Listar Usuarios/Pedagogos
const getAllUsers = async (req, res) => {
  try {
    //Obtnemos datos solo usuarios/pedagogos
    const users = await User.find().select("-password");

    if (!users) {
      return res.status(404).json({
        message: "No se encontraron usuarios",
        error: "No hay usuarios registrados",
      });
    }

    //2. Enviamos la respuesta
    return res.status(200).json({
      users,
    });
  } catch (error) {
    console.log(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos del usuario",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        message: "Error al obtener usuarios",
        error: error.message,
      });
    }
  }
};

//5. Creamos función para actualizar perfil de usuario.
const updateProfileUser = async (req, res) => {
  try {
    //1. Obtenemos el ID del usuario
    const { id } = req.params;

    //2. Buscamos al usuario por su ID
    const user = await User.findById(id);

    //Verificamos si existe el usuario
    if (!user) {
      //Eliminamos el archivo si existe - Evitamos ocupar espacio en la nube
      if (req.file) {
        await deleteFile(req.file.path);
      }

      return res.status(404).json({
        message: "Usuario no encontrado",
        error: "El usuario no existe",
      });
    }

    //3. Verificamos si el usuario logueado es el mismo que el usuario a actualizar o si es administrador
    if (req.user.rol !== "admin" && !req.user._id.equals(id)) {
      //Eliminamos el archivo si existe - Evitamos ocupar espacio en la nube
      if (req.file) {
        await deleteFile(req.file.path);
      }

      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para actualizar el perfil de otro usuario",
      });
    }

    //4. Extraemos los datos dinamicamente
    let updateData = { ...req.body };
    // Verficamos que si se actualiza pedagogo obtenga permisos de admin
    if (req.user.rol !== "admin") {
      delete updateData.rol;
    }

    //Protejemos la contraseña para evitar actualizarla desde este endpoint
    if (updateData.password) {
      delete updateData.password; //Eliminamos la contraseña para que no sea modificada desde este endpoint
    }

    // Actualizamos y eliminamos las imágenes de Cloudinary si no es la imagen por defecto
    const defaultAvatar = process.env.IMAGE_DEFAULT || "profile-default.jpg";

    if (req.file) {
      updateData.avatar = req.file.path;

      if (user.avatar && !user.avatar.includes(defaultAvatar)) {
        await deleteFile(user.avatar);
      }
    }

    //5. Actualizamos los datos
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      message: "Perfil actualizado correctamente",
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);

    //Eliminamos el archivo si existe - Evitamos ocupar espacio en la nube
    if (req.file) {
      await deleteFile(req.file.path);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos del usuario",
        error: error.message,
      });
    } else if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID de usuario inválido",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        message: "Error interno del servidor al actualizar perfil",
        error: error.message,
      });
    }
  }
};

//6. Función para eliminar Usuario - Solo Administrador (Restricción preventiva si tiene dependencias)
const deleteUser = async (req, res) => {
  try {
    //1. Obtenemos el ID del usuario
    const { id } = req.params;

    //2. Obtenemos todos los datos del usuario
    const user = await User.findById(id);

    //Verificamos que el usuario existe
    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
        error: "El usuario no existe",
      });
    }

    //3. Verificamos permisos: solo los administradores pueden eliminar usuarios
    if (req.user.rol !== "admin") {
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para eliminar usuarios",
      });
    }

    //Evitamos que un administrador elimine su propia cuenta
    if (req.user._id.equals(id)) {
      return res.status(400).json({
        message: "Operación no permitida",
        error: "No puedes eliminar tu propia cuenta de administrador",
      });
    }

    //4. Restricción preventiva: verificamos si tiene estudiantes o sesiones asignadas
    const assignedStudentsCount = await Student.countDocuments({
      pedagogoAsignado: id,
    });
    const assignedSessionsCount = await Session.countDocuments({
      pedagogoAsignado: id,
    });

    if (assignedStudentsCount > 0 || assignedSessionsCount > 0) {
      return res.status(400).json({
        message: "No se puede eliminar el usuario",
        error:
          "El usuario tiene estudiantes o sesiones asignadas. Debes reasignarlos o gestionarlos antes de eliminarlo.",
        details: {
          estudiantesAsignados: assignedStudentsCount,
          sesionesAsignadas: assignedSessionsCount,
        },
      });
    }

    //5. Eliminamos al usuario de la base de datos
    await user.deleteOne();

    //6. Limpiamos los archivos de Cloudinary si no es la imagen por defecto
    const defaultAvatar = process.env.IMAGE_DEFAULT || "profile-default.jpg";

    if (user.avatar && !user.avatar.includes(defaultAvatar)) {
      await deleteFile(user.avatar);
    }

    //7. Devolvemos respuesta exitosa
    return res.status(200).json({
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.log(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID inválido",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        message: "Error interno del servidor",
        error: error.message,
      });
    }
  }
};

//7. Función que recupera el perfil del usuario logueado
const getMe = async (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};

//Exportamos el controlador
export {
  userRegister,
  userLogin,
  deleteUser,
  updateProfileUser,
  getMe,
  getAllUsers,
};
