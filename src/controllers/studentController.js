/* Controlador para obtener estudiantes */

//Importamos el modelo de Student para poder interactuar con la base de datos
import mongoose from "mongoose";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Session from "../models/Sessions.js";
import deleteFile from "../utils/deleteFiles.js";

//Definimos función para obtener estudiantes
const getStudents = async (req, res) => {
  try {
    // Si es Admin obtenemos todos los estudiantes, si es pedagogo obtenemos solo los asignados
    const queryFilter =
      req.user.rol === "admin" ? {} : { pedagogoAsignado: req.user._id };

    //1. Obtenemos los datos del estudiante
    const students = await Student.find(queryFilter).populate(
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

//Función para dar de alta un estudiante
const createStudent = async (req, res) => {
  try {
    //1. Recuperar los datos
    const {
      name,
      age,
      course,
      diagnosis,
      nameTutor,
      emailTutor,
      phoneNumberTutor,
      tutorRelationship,
    } = req.body;

    //Verificamos que los campos obligatorios se hayan enviado
    if (
      !name ||
      !age ||
      !course ||
      !diagnosis ||
      !nameTutor ||
      !emailTutor ||
      !phoneNumberTutor ||
      !tutorRelationship
    ) {
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: "Datos enviados incorrectamente",
        error: "Debes rellenar todos los campos requeridos",
      });
    }

    //Pedagogo asignado será el usuario logueado con rol de pedagogo
    let pedagogoAsignado = req.user._id;

    //Verificamos si lo asigna un admin o el propio pedagogo - Solo estos pueden. Admin puede asignar estudiantes a otros pedagogos y el pedagogo puede asignar estudiantes a él mismo.
    if (req.user.rol === "admin") {
      const pedagogoInput = req.body.pedagogoAsignado;

      //Comprobamos que se haya asignado un pedagogo
      if (!pedagogoInput) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(400).json({
          message: "Pedagogo asignado obligatorio",
          error: "Debes asignar un pedagogo al estudiante",
        });
      }

      //Comprobamos que el pedagogo asignado existe (por ID o por nombre/email)
      let pedagogo = null;
      if (mongoose.Types.ObjectId.isValid(pedagogoInput)) {
        pedagogo = await User.findById(pedagogoInput);
      }

      if (!pedagogo) {
        pedagogo = await User.findOne({
          $or: [
            { name: new RegExp(`^${pedagogoInput.toString().trim()}$`, "i") },
            { email: pedagogoInput.toString().trim().toLowerCase() },
          ],
        });
      }

      if (!pedagogo) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(404).json({
          message: "Pedagogo no encontrado",
          error: "El pedagogo no existe",
        });
      }

      //Comprobamos que usuario tenga el rol de pedagogo
      if (pedagogo.rol !== "pedagogo") {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(403).json({
          message: "No autorizado",
          error: "El usuario asignado debe tener el rol de pedagogo",
        });
      }

      pedagogoAsignado = pedagogo._id;
    }

    //2. Verificamos que el estudiante ya existe y no se pueda crear un nuevo estudiante con el mismo tutor - Controlamos minusculas y espacios en blanco
    const existsStudent = await Student.findOne({
      name: new RegExp(`^${name.trim()}$`, "i"),
      emailTutor: emailTutor.trim().toLowerCase(),
    });

    if (existsStudent) {
      //Eliminamos la imagen subida en esta petición para rollback
      if (req.file) {
        await deleteFile(req.file.path);
      }

      //Devolvemos error
      return res.status(400).json({
        message: "El estudiante ya existe",
        error: "Ya existe un estudiante con ese nombre y tutor registrado",
      });
    }

    //3. Asignamos la imagen (si se subió archivo usamos su ruta, si no usamos la por defecto)
    const defaultAvatar =
      process.env.IMAGE_DEFAULT ||
      "https://res.cloudinary.com/kvayxt5w/image/upload/v1788861354/profile-default.jpg";
    const avatar = req.file ? req.file.path : defaultAvatar;

    //4. Instanciamos el nuevo estudiante
    const student = new Student({
      name: name.trim(),
      age,
      course: course.trim(),
      diagnosis: diagnosis.trim(),
      nameTutor: nameTutor.trim(),
      emailTutor: emailTutor.trim().toLowerCase(),
      phoneNumberTutor: phoneNumberTutor.trim(),
      tutorRelationship: tutorRelationship.trim(),
      avatar,
      pedagogoAsignado,
    });

    //5. Guardamos en la base de datos
    await student.save();

    //6. Poblamos el pedagogo asignado
    await student.populate("pedagogoAsignado", "name email");

    //7. Devolvemos respuesta exitosa
    return res.status(201).json({
      message: "Estudiante creado exitosamente",
      student,
    });
  } catch (error) {
    console.log(error);

    //Verificamos rollback del archivo
    if (req.file) {
      await deleteFile(req.file.path);
    }

    if (error.name === "ConflictError") {
      return res.status(409).json({
        message: "Conflicto - El estudiante ya existe",
        error: error.message,
      });
    } else if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Datos enviados incorrectamente",
        error: error.message,
      });
    } else if (error.name === "CastError") {
      return res.status(400).json({
        message: "ID inválido",
        error: error.message,
      });
    } else {
      return res.status(500).json({
        error: "Error interno del servidor al crear estudiante",
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
      if (req.file) {
        await deleteFile(req.file.path);
      }
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
      if (req.file) {
        await deleteFile(req.file.path);
      }
      return res.status(403).json({
        message: "No autorizado",
        error: "No tienes permiso para acceder a este estudiante",
      });
    }

    //3. Creamos un objeto con todos los datos del body para ir añadiendo los campos que el Frontend los envíe
    let updateData = { ...req.body };

    // Si el usuario es pedagogo, no puede reasignar el pedagogoAsignado
    if (req.user.rol === "pedagogo") {
      delete updateData.pedagogoAsignado;
    } else if (req.user.rol === "admin" && updateData.pedagogoAsignado) {
      // Si el admin envía un pedagogoAsignado, validamos que exista y tenga rol pedagogo (por ID o por nombre/email)
      let pedagogo = null;
      if (mongoose.Types.ObjectId.isValid(updateData.pedagogoAsignado)) {
        pedagogo = await User.findById(updateData.pedagogoAsignado);
      }
      if (!pedagogo) {
        pedagogo = await User.findOne({
          $or: [
            { name: new RegExp(`^${updateData.pedagogoAsignado.toString().trim()}$`, "i") },
            { email: updateData.pedagogoAsignado.toString().trim().toLowerCase() },
          ],
        });
      }
      if (!pedagogo || pedagogo.rol !== "pedagogo") {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(400).json({
          message: "Pedagogo asignado inválido",
          error: "El pedagogo asignado no existe o no tiene el rol de pedagogo",
        });
      }
      updateData.pedagogoAsignado = pedagogo._id;
    }

    //Actualización de imagen
    if (req.file) {
      const defaultAvatar = process.env.IMAGE_DEFAULT || "profile-default.jpg";
      // Si el estudiante tenía un avatar previo que no es el default, lo eliminamos de Cloudinary
      if (student.avatar && !student.avatar.includes(defaultAvatar)) {
        await deleteFile(student.avatar);
      }
      updateData.avatar = req.file.path;
    }

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

    if (req.file) {
      await deleteFile(req.file.path);
    }

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
export {
  getStudents,
  getStudentByID,
  updateStudent,
  deleteStudent,
  createStudent,
};
