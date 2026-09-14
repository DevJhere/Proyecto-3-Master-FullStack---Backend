/* Controlador para obtener estudiantes */

//Importamos el modelo de Student para poder interactuar con la base de datos
import Student from "../models/Student.js";
import Session from "../models/Sessions.js";
import deleteFile from "../utils/deleteFiles.js";

//Definimos función para obtener estudiantes
const getStudents = async (req, res) => {
  try {
    //1. Obtenemos los datos del estudiante
    const students = await Student.find().populate(
      "pedagogoAsignado",
      "name email",
    );

    //2. Devolvemos respuesta exitosa
    return res.status(200).json(students);
  } catch (error) {
    //3. Si obtenemos un error en la base de datos
    console.log(error);

    return res.status(500).json({
      error: "Error al obtener datos de estudiantes",
      details: error.message,
    });
  }
};

//Función para obtener los datos de un Estudiante por su ID
const getStudentByID = async (req, res) => {
  try {
    //1. Obtenemos el ID de la URL
    const { id } = req.params;

    //2. Buscamos al estudiante por ID
    const student = await Student.findById(id).populate(
      "pedagogoAsignado",
      "name email",
    );

    //3. Verificamos si el estudiante existe
    if (!student) {
      return res.status(404).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //4. Verificamos si el estudiante tiene un pedagogo asignado
    if (
      req.user.rol === "pedagogo" &&
      !student.pedagogoAsignado?._id?.equals(req.user._id) //Esto permite verificar si el pedagogo asignado es el mismo que el usuario que está haciendo la petición
    ) {
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para acceder a este estudiante",
      });
    }

    //5. Devolvemos respuesta exitosa
    return res.status(200).json(student);
  } catch (error) {
    console.log(error);
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID inválido",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        error: "Error al obtener datos del estudiante",
        details: error.message,
      });
    }
  }
};

//Función para actualizar Student
const updateStudent = async (req, res) => {
  try {
    //1. Obtenemos ID estudiante
    const { id } = req.params;

    //Buscamos al estudiante por ID
    const student = await Student.findById(id).populate(
      "pedagogoAsignado",
      "name email",
    );

    //Verificamos que el estudiante existe
    if (!student) {
      return res.status(404).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //2. Verificamos que el pedagogo tenga permiso para actualizar al estudiante
    if (
      req.user.rol === "pedagogo" &&
      !student.pedagogoAsignado?._id?.equals(req.user._id) //Esto permite verificar si el pedagogo asignado es el mismo que el usuario que está haciendo la petición
    ) {
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para acceder a este estudiante",
      });
    }

    //3. Creamos un objeto con todos los datos del body para ir añadiendo los campos que el Frontend los envíe
    let updateData = { ...req.body };

    //Actualización de imagen
    if (req.file) {
      updateData.avatar = req.file.path;
    } //Si existe el archivo, añadimos la ruta

    //5. Actualizamos datos del estudiante
    const updatedStudent = await Student.findByIdAndUpdate(id, updateData, {
      new: true, //Devuelve el objeto actualizado
      runValidators: true, //Ejecuta las validaciones del schema
    }).populate("pedagogoAsignado", "name email");

    //6. Verificamos si se actualizó correctamente
    if (!updatedStudent) {
      return res.status(404).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //7. Devolvemos respuesta exitosa
    return res.status(200).json(updatedStudent);
  } catch (error) {
    console.log(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID inválido",
        error: error.message,
      });
    } else if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Error en los datos",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        error: "Error al actualizar estudiante",
        details: error.message,
      });
    }
  }
};

//Función para eliminar Student
const deleteStudent = async (req, res) => {
  try {
    //1. Obtenemos el ID
    const { id } = req.params;

    //Definimos variable para obtener el url por defecto
    const defaultAvatar = process.env.IMAGE_DEFAULT || "profile-default.jpg";

    //2. Buscamos al estudiante por el ID
    const student = await Student.findById(id).populate(
      "pedagogoAsignado",
      "name email",
    );

    //3. Verificamos que existe el estudiante
    if (!student) {
      return res.status(404).json({
        message: "Estudiante no encontrado",
        error: "El estudiante no existe",
      });
    }

    //4. Verificamos que el pedagogo tenga permiso para eliminar al estudiante (RBAC)
    if (
      req.user.rol === "pedagogo" &&
      !student.pedagogoAsignado?._id?.equals(req.user._id)
    ) {
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para eliminar este estudiante",
      });
    }

    //Comprobamos que estudiante tiene un avatar
    if (student.avatar) {
      //Verificamos que no incluya la URL de imagen por defecto
      if (!student.avatar.includes(defaultAvatar)) {
        //Eliminamos el archivo de la base de datos
        await deleteFile(student.avatar);
      }
    }

    //Realizamos consulta para buscar todas las sesiones
    const sessions = await Session.find({ student: id });

    //Recorremos las sesiones encontradas
    for (const session of sessions) {
      if (session.attachmentDocument) {
        await deleteFile(session.attachmentDocument, "raw");
      }
    }

    //5. Eliminamos las sesiones del Estudiante
    await Session.deleteMany({ student: id });

    //6. Eliminamos al Estudiante
    await student.deleteOne();

    //7. Devolvemos respuesta exitosa
    return res.status(200).json({
      message: "Estudiante eliminado correctamente",
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
        message: "Error al eliminar estudiante",
        error: error.message,
      });
    }
  }
};

//Exportamos la función
export { getStudents, getStudentByID, updateStudent, deleteStudent };
