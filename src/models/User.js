/* Model - User - Colección de Usuarios */
import mongoose from "mongoose";

//1.Clase Schema (Estructura de datos)
const Schema = mongoose.Schema;

/* Definimos la estructura de nuestra colección usuarios - Los campos que tendrá modelo Users*/
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "El correo electrónico es obligatorio"],
      trim: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Correo electrónico inválido"],
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minLength: 6,
      select: false, //Evitamos que se muestre en las consultas
    },
    specialization: {
      type: String,
      trim: true,
      enum: [
        "Psicología Educativa",
        "Logopedia",
        "Atención Temprana",
        "Neuropsicología",
        "Orientación Educativa",
      ],
      required: [true, "La especialización es obligatoria"],
      index: true, // para búsquedas más rápidas
    },
    avatar: {
      type: String, //URL Cloudinary
      default: "",
    },
    rol: {
      type: String,
      enum: ["admin", "pedagogo"],
      default: "pedagogo",
    },
  },
  {
    timestamps: true, //Crea los campos createdAt y updatedAt
  },
);

//2. Exportamos el modelo
const User = mongoose.model("User", userSchema);
export default User;
