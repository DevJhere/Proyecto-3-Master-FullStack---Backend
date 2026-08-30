/* Archivo seed que nos ayuda a la importación de estudiantes a la base de datos como datos de prueba */
import "dotenv/config";
// fs
import fs from "fs";
// path
import path from "path";
// Para usar __dirname en ES Modules
import { fileURLToPath } from "url";

// Modelos
import { connectDB } from "../config/db.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// 1. Importamos el directorio actual del script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Importamos la función que inicia el seeder
const initializeSeeder = async () => {
  try {
    // Conectamos a la DB
    await connectDB();

    // Limpiamos la colección de estudiantes, es decir, eliminamos los estudiantes que se encuentren en la colección para evitar duplicados.
    await Student.deleteMany();
    console.log("Colección de estudiantes limpiada");

    /* TODO: Crear un Pedagogo por default para que se relacione con el estudiante */
    let pedagogo = await User.findOne({ email: "pedagogo@pedagogia.com" }); //Email del pedagogo para seed
    //Verificamos que el pedagogo exista
    if (!pedagogo) {
      pedagogo = await User.create({
        name: "Pedagogo Principal",
        email: "pedagogo@pedagogia.com",
        password: "password123", //Encriptar en producción
        specialization: "Psicología Educativa",
        rol: "pedagogo",
      });
      console.log("No se encontró el pedagogo. Creando pedagogo por defecto.");
    }

    // Leemos el archivo CSV de estudiantes
    const csvPath = path.join(__dirname, "../data/students.csv");
    // Lectura del contenido csv
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    // Almacenamos el contenido del csv en un array - parseado.
    const studentsData = csvContent
      .split("\n")
      .slice(1)
      .filter((line) => line.trim() !== "")
      .map((line) => {
        // Separamos por comas y limpiamos los espacios o retornos de carro (\r) en cada campo
        const [
          name,
          course,
          age,
          diagnosis,
          nameTutor,
          emailTutor,
          phoneNumberTutor,
        ] = line.split(",").map((val) => val.trim());

        // Devolvemos un objeto con los datos del estudiante y lo relacionamos con el pedagogo por default.
        return {
          name,
          course,
          age: Number(age), // Lo convertimos a número
          diagnosis,
          nameTutor,
          emailTutor,
          phoneNumberTutor,
          pedagogoAsignado: pedagogo._id,
        };
      });

    // 3. Insertamos los datos del CSV en la colección de estudiantes
    await Student.insertMany(studentsData);
    console.log(
      `Se han importado ${studentsData.length} estudiantes correctamente.`,
    );

    // Cerramos la conexión a la base de datos
    await mongoose.connection.close();
    console.log("Conexión a la base de datos cerrada.");

    // Terminamos el proceso
    process.exit(0);
  } catch (error) {
    console.error("Error en la ejecución del seeder:", error.message);
    process.exit(1);
  }
};

// Ejecutamos la función
initializeSeeder();
