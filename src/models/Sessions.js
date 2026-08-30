/* Model - Session - Colección de Sesiones */
import mongoose from "mongoose";

//1. Intanciamos la clase Schema
const Schema = mongoose.Schema;

//Definimos Schema de campos para la Session
const sessionSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId, //Referencia a Colección Studen - Relación 1 a Muchos
      ref: "Student",
      required: true,
    },
    pedagogoAsignado: {
      type: Schema.Types.ObjectId, //Referencia a Colección Users - Relación 1 a Muchos
      ref: "User", //Referencia a Colección User - Relación 1 a Muchos
      required: true,
    },
    date: {
      type: Date,
      required: [true, "La fecha es obligatoria"],
      index: true,
    },
    status: {
      type: String,
      enum: ["Pendiente", "Cancelado", "Completado"],
      default: "Pendiente",
      index: true,
    },
    attachmentDocument: {
      type: String, //URL Cloudinary
      default: "",
    },
    notes: {
      type: String, //Notas del pedagogo sobre la sesión
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, //Crea los campos createdAt y updatedAt
  },
);

//2. Exportamos el modelo
const Session = mongoose.model("Session", sessionSchema);
export default Session;
