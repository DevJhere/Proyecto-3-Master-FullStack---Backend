/* CAMBIO (despliegue): script para crear el PRIMER administrador (el registro público solo crea pedagogos).
   Uso (con las variables de la base a la que quieras apuntar, normalmente la de producción):
     ADMIN_EMAIL=admin@correo.com ADMIN_PASSWORD=<contraseña> ADMIN_NAME="Nombre Apellido" pnpm seed:admin
   - Si el correo NO existe, crea un usuario con rol admin.
   - Si el correo YA existe, lo promociona a admin (no cambia su contraseña).
   La contraseña se pasa por variable de entorno para que no quede en el código ni en el historial del repositorio. */
import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Administrador" } = process.env;

const run = async () => {
  //Validamos los datos antes de tocar la base de datos
  if (!ADMIN_EMAIL || !/^\S+@\S+\.\S+$/.test(ADMIN_EMAIL)) {
    throw new Error("Define ADMIN_EMAIL con un correo válido.");
  }
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6) {
    throw new Error("Define ADMIN_PASSWORD con al menos 6 caracteres.");
  }

  await connectDB();

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    //Ya existe: solo cambiamos el rol
    existing.rol = "admin";
    await existing.save();
    console.log(`El usuario ${email} ya existía: ahora es administrador.`);
    return;
  }

  //No existe: lo creamos con la contraseña cifrada igual que en el registro
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(ADMIN_PASSWORD, salt);

  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    password,
    specialization: "Orientación Educativa",
    rol: "admin",
  });
  console.log(`Administrador creado: ${email}`);
};

try {
  await run();
} catch (error) {
  console.error("Error:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
