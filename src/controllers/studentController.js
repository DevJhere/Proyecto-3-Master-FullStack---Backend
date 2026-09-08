/* Controlador para obtener estudiantes */

//Importamos el modelo de Student para poder interactuar con la base de datos
import Student from "../models/Student.js";

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

//Exportamos la función
export { getStudents, getStudentByID };
