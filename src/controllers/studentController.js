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

//Exportamos la función
export { getStudents };
