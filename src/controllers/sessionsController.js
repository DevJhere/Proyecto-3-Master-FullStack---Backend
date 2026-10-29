import Session from "../models/Sessions.js";
import Student from "../models/Student.js";
import deleteFile from "../utils/deleteFiles.js";

//Campos que puede modificar el pedagogo propietario. El admin además puede cambiar el alumno y el pedagogo.
const UPDATABLE_FIELDS = ["date", "status", "duration", "notes"];
const ADMIN_UPDATABLE_FIELDS = ["student", "pedagogoAsignado"];

//Duración máxima que consideramos al buscar sesiones que se solapen (12 horas en ms)
const MAX_SESSION_WINDOW = 12 * 60 * 60 * 1000;

//Busca otra sesión activa (no cancelada) del mismo pedagogo que se solape con el horario indicado
const findScheduleConflict = async ({
  pedagogoAsignado,
  date,
  duration,
  excludeId,
}) => {
  const start = new Date(date).getTime();
  const end = start + duration * 60000;

  const filter = {
    pedagogoAsignado,
    status: { $ne: "Cancelado" },
    //Solo miramos las sesiones que empiezan antes de que acabe la nueva y no mucho antes de que empiece
    date: { $gt: new Date(start - MAX_SESSION_WINDOW), $lt: new Date(end) },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const candidates = await Session.find(filter);

  //Una sesión anterior solo se solapa si termina después de que empiece la nueva
  return (
    candidates.find(
      (session) =>
        session.date.getTime() + (session.duration || 60) * 60000 > start,
    ) || null
  );
};

//Respuesta cuando el pedagogo ya tiene otra sesión en ese horario
const scheduleConflictResponse = (res) =>
  res.status(409).json({
    message: "Horario no disponible",
    error: "El pedagogo ya tiene una sesión programada en ese horario",
  });

//Crear sesión
const createSession = async (req, res) => {
  try {
    //1. Extraemos los datos de Session
    const { student, date, status, notes } = req.body;
    const duration = req.body.duration === undefined ? 60 : Number(req.body.duration);

    //Comprobamos si hay informe
    let attachmentDocument = req.file ? req.file.path : "";

    //Verificamos que los datos sean correctos
    if (!student || !date) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: "Datos incompletos",
        error: "Debes rellenar todos los campos requeridos",
      });
    }

    if (Number.isNaN(new Date(date).getTime()) || !(duration > 0)) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: "Datos incorrectos",
        error: "La fecha o la duración de la sesión no son válidas",
      });
    }

    //Verificamos que el estudiante exista
    const studentExist = await Student.findById(student);
    if (!studentExist) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //Comprobar si el pedagogoAsignado coincide con el ID del estudiante para la sesión que se ha creado
    if (
      req.user.rol !== "admin" && //El rol es diferente de admin
      !studentExist.pedagogoAsignado.equals(req.user._id) //El pedagogo asignado no coincide con el usuario que está creando la sesión
    ) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para crear sesiones de este estudiante",
      });
    }

    //Pedagogo Asignado = El pedagogo del alumno (si la crea un admin, la sesión no se queda asignada al admin)
    const pedagogoAsignado = studentExist.pedagogoAsignado;

    //Evitamos que el pedagogo tenga dos sesiones a la misma hora
    if (status !== "Cancelado") {
      const conflict = await findScheduleConflict({
        pedagogoAsignado,
        date,
        duration,
      });

      if (conflict) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return scheduleConflictResponse(res);
      }
    }

    //Creamos la sesión
    await Session.create({
      student,
      pedagogoAsignado,
      date,
      status,
      duration,
      notes,
      attachmentDocument,
    });

    return res.status(201).json({
      message: "Sesión creada exitosamente",
    });
  } catch (error) {
    console.log(error);

    if (req.file) {
      await deleteFile(req.file.path);
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos",
        error: error.message,
      });
    } else if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID de estudiante inválido",
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

    //3. Ejecutamos la busqueda, ordenada por fecha
    const sessions = await Session.find(queryFilter)
      .sort({ date: 1 })
      .populate("student", "name course diagnosis nameTutor avatar") //Datos clave del alumno
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

    //Solo copiamos los campos permitidos del body. Si no es administrador, no puede cambiar el alumno ni el pedagogo asignado a la sesión
    const allowedFields =
      req.user.rol === "admin"
        ? [...UPDATABLE_FIELDS, ...ADMIN_UPDATABLE_FIELDS]
        : UPDATABLE_FIELDS;

    let updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (
      (updateData.date !== undefined &&
        Number.isNaN(new Date(updateData.date).getTime())) ||
      (updateData.duration !== undefined && !(Number(updateData.duration) > 0))
    ) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: "Datos incorrectos",
        error: "La fecha o la duración de la sesión no son válidas",
      });
    }

    //Si cambia el horario, la duración, el pedagogo o se reactiva una sesión cancelada, comprobamos que no se solape con otra sesión activa
    const finalStatus = updateData.status ?? session.status;
    const movesSchedule = ["date", "duration", "pedagogoAsignado"].some(
      (field) => updateData[field] !== undefined,
    );
    const isReactivated =
      session.status === "Cancelado" && finalStatus !== "Cancelado";

    if ((movesSchedule || isReactivated) && finalStatus !== "Cancelado") {
      const conflict = await findScheduleConflict({
        pedagogoAsignado: updateData.pedagogoAsignado ?? session.pedagogoAsignado,
        date: updateData.date ?? session.date,
        duration: Number(updateData.duration ?? session.duration ?? 60),
        excludeId: session._id,
      });

      if (conflict) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return scheduleConflictResponse(res);
      }
    }

    //Archivo adjunto
    if (req.file) {
      updateData.attachmentDocument = req.file.path; //Actualizamos el archivo adjunto
    }

    //3. Actualizamos los datos
    const updatedSession = await Session.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true, //para validar los datos antes de actualizar
    }).populate("student", "name course diagnosis");

    //Si la sesión tenía un documento y se ha sustituido, lo borramos de Cloudinary (solo cuando la actualización ha ido bien)
    if (req.file && session.attachmentDocument) {
      await deleteFile(session.attachmentDocument, "raw");
    }

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

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos incorrectos",
        error: error.message,
      });
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
