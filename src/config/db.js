/* Configuración conexión a MongoDB */
// 1. Importamos Mongoose
import mongoose from 'mongoose';


// 2. Definimos una función asíncrona para realizar la conexión a la DB
const connectDB = async () => {
    try {
        
        //3. Usamos el método connect de mongoose para conectarnos a la DB
        await mongoose.connect(process.env.DB_URL, {
            family: 4 //Soluciona a alertas de conexión IPv6/IPv4
        });
        
        //4. Usamos la variable de entorno DB_URL 
        console.log('MongoDB conectado exitosamente');
    } catch (error) {
        console.log("Error en la conexión de la DB: ", error.message);
        process.exit(1); // Con esto finaliza el proceso si existe un error 
    }
}

// Exportamos la función
export { connectDB };
