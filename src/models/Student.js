/* Model - Student - Colección de Estudiantes */
import mongoose from "mongoose";

//1. Instanciamos - Clase Schema
const Schema = mongoose.Schema;

//Definimos la estructura de las colección de estudiantes
const studentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    course: {
      type: String,
      trim: true,
      enum: [
        "Infantil 3 años",
        "Infantil 4 años",
        "Infantil 5 años",
        "1 Primaria",
        "2 Primaria",
        "3 Primaria",
        "4 Primaria",
        "5 Primaria",
        "6 Primaria",
        "1 ESO",
        "2 ESO",
        "3 ESO",
        "4 ESO",
        "1 Bachillerato",
        "2 Bachillerato",
        "FP",
      ],
      required: [true, "El curso es obligatorio"],
      index: true,
    },
    age: {
      type: Number,
      required: [true, "La edad es obligatoria"],
      min: [3, "La edad mínima es 3"],
      max: [18, "La edad máxima es 18"],
    },
    diagnosis: {
      type: String,
      trim: true,
      required: [true, "El diagnóstico es obligatorio"],
    },
    nameTutor: {
      type: String,
      trim: true,
      required: [true, "El nombre del tutor es obligatorio"],
    },
    emailTutor: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "El correo electrónico es obligatorio"],
      match: [/^\S+@\S+\.\S+$/, "Correo electrónico inválido"],
    },
    phoneNumberTutor: {
      type: String,
      trim: true,
      match: [/^\d{9}$/, "Teléfono inválido"], //Valida que el teléfono tenga 9 dígitos
      required: [true, "El número de teléfono del tutor es obligatorio"],
    },
    avatar: {
      type: String,
      default: "",
    },
    pedagogoAsignado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Hace referencia al modelo User - Relación 1 a Muchos
      required: true,
    },
  },
  {
    timestamps: true, //Crea los campos createdAt y updatedAt
  },
);

//2. Exportamos el modelo
const Student = mongoose.model("Student", studentSchema);
export default Student;