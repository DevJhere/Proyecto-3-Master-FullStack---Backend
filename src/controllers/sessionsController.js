import Session from "../models/Sessions.js";
import Student from "../models/Student.js";
import deleteFile from "../utils/deleteFiles.js";

//Crear sesión
const createSession = async (req, res) => {
  try {
    //1. Extraemos los datos de Session
    const { student, date, status, notes } = req.body;

    //Pedagogo Asignado = El usuario que tiene asignado
    const pedagogoAsignado = req.user._id;

    //Comprobamos si hay informe
    let attachmentDocument = req.file ? req.file.path : "";

    //Verificamos que los datos sean correctos
    if (!student || !date) {
      return res.status(400).json({
        message: "Datos incompletos",
        error: "Debes rellenar todos los campos requeridos",
      });
    }

    //Verificamos que el estudiante exista
    const studentExist = await Student.findById(student);
    if (!studentExist) {
      return res.status(400).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //Comprobar si el pedagogoAsignado coincide con el ID del estudiante para la sesión que se ha creado
    if (
      req.user.rol !== "admin" && //El rol es diferente de admin
      !studentExist.pedagogoAsignado.equals(pedagogoAsignado) //El pedagogo asignado no coincide con el usuario que está creando la sesión
    ) {
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para crear sesiones de este estudiante",
      });
    }

    //Creamos la sesión
    await Session.create({
      student,
      pedagogoAsignado,
      date,
      status,
      notes,
      attachmentDocument,
    });

    return res.status(201).json({
      message: "Sesión creada exitosamente",
    });
  } catch (error) {
    console.log(error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        message: "Error al crear la sesión",
        error: error.message,
      });
    }
  }
};

//Obtener sesiones - Obtener todas las sesiones de los estudiantes asignados
const getSessions = async (req, res) => {
  try {
    //1. Si es Admin, obtenemos todas las sesiones
    //2. Si es Pedagogo, obtenemos todas las sesiones del pedagogo asignado
    const queryFilter =
      req.user.rol === "admin" ? {} : { pedagogoAsignado: req.user._id };

    //3. Ejecutamos la busqueda
    const sessions = await Session.find(queryFilter)
      .populate("student", "name course diagnosis nameTutor") //Datos clave del alumno
      .populate("pedagogoAsignado", "name email"); //Datos clave del pedagogo

    //4. Respondemos con todas las sesiones
    return res.status(200).json(sessions);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Error al obtener las sesiones",
      error: error.message,
    });
  }
};

//Obtener sesion por ID
const getSessionById = async (req, res) => {
  try {
    //1. Obtnemos el ID
    const { id } = req.params;

    //2. Buscamos la sesión y lo poblamos con los datos del alumno y el pedagogo
    const session = await Session.findById(id)
      .populate("student", "name age diagnosis")
      .populate("pedagogoAsignado", "name email");

    //Verificamos que la sesión exista
    if (!session) {
      return res.status(404).json({
        message: "Sesión no encontrada",
        error: "No se encontró la sesión solicitada",
      });
    }

    //3. Verificación de permisos. Solo pedagogoAsignado o admin pueden ver la sesion
    if (
      req.user.rol !== "admin" &&
      !req.user._id.equals(session.pedagogoAsignado._id)
    ) {
      return res.status(403).json({
        message: "No tienes permisos autorizados",
        error: "No tienes permiso para ver esta sesión",
      });
    }

    //4. Respuesta exitosa
    return res.status(200).json(session);
  } catch (error) {
    console.log(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID de sesión inválido",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error al obtener la sesión",
      error: error.message,
    });
  }
};

//Actualizar sesión.
const updateSession = async (req, res) => {
  try {
    //1. Obtenemos el ID
    const { id } = req.params;
    const session = await Session.findById(id);

    //Verificamos que la sesión exista
    if (!session) {
      //Si hay un archivo nuevo, lo subimos y borramos el anterior
      if (req.file) {
        await deleteFile(req.file.path); //Borramos el archivo anterior
      }

      return res.status(404).json({
        message: "Sesión no encontrada",
        error: "No se encontró la sesión solicitada",
      });
    }

    let updateData = { ...req.body }; //Extraemos los datos del body

    //2. Verificación de permisos.
    if (
      req.user.rol !== "admin" &&
      !req.user._id.equals(session.pedagogoAsignado)
    ) {
      //Si hay un archivo nuevo, lo subimos y borramos el anterior
      if (req.file) {
        await deleteFile(req.file.path); //Borramos el archivo anterior
      }
      return res.status(403).json({
        message: "No autorizado para editar esta sesión",
        error: "No tienes permiso para actualizar esta sesión",
      });
    }

    // Si no es administrador, no permitimos que cambie el pedagogo asignado a la sesión
    if (req.user.rol !== "admin") {
      delete updateData.pedagogoAsignado;
    }

    //Archivo adjunto
    if (req.file) {
      updateData.attachmentDocument = req.file.path; //Actualizamos el archivo adjunto

      //Si la sesión ya tiene un documento lo borramos de Cloudinary
      if (session.attachmentDocument) {
        await deleteFile(session.attachmentDocument, "raw");
      }
    }

    //3. Actualizamos los datos
    const updatedSession = await Session.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true, //para validar los datos antes de actualizar
    }).populate("student", "name course diagnosis");

    //4. Respuesta exitosa
    return res.status(200).json({
      message: "Sesión actualizada exitosamente",
      updatedSession,
    });
  } catch (error) {
    console.log(error);

    if (req.file) {
      await deleteFile(req.file.path);
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID de sesión inválido",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error al actualizar la sesión",
      error: error.message,
    });
  }
};

//Eliminar sesión
const deleteSession = async (req, res) => {
  try {
    //1. Obtenemos el ID
    const { id } = req.params;
    const session = await Session.findById(id);

    //2. Verificamos que la sesión exista
    if (!session) {
      return res.status(404).json({
        message: "Sesión no encontrada",
        error: "No se encontró la sesión solicitada",
      });
    }

    //3. Verificación de permisos.
    if (
      req.user.rol !== "admin" &&
      !req.user._id.equals(session.pedagogoAsignado)
    ) {
      return res.status(403).json({
        message: "No autorizado para eliminar esta sesión",
        error: "No tienes permiso para eliminar esta sesión",
      });
    }

    //4. Limpiamos Cloudinary del archivo adjunto
    if (session.attachmentDocument) {
      await deleteFile(session.attachmentDocument, "raw");
    }

    //5. Eliminamos la sesión de la base de datos
    await session.deleteOne();

    //6. Respuesta exitosa
    return res.status(200).json({
      message: "Sesión eliminada exitosamente",
    });
  } catch (error) {
    console.log(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID de sesión inválido",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error al eliminar la sesión",
      error: error.message,
    });
  }
};

//Exportamos
export {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
};
