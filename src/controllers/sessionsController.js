import Session from "../models/Sessions.js";
import Student from "../models/Student.js";

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

//Exportamos
export { createSession, getSessions };
