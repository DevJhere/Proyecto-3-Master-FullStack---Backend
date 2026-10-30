/* Configuración centralizada de CORS y límite de intentos de login.
   Se usa desde app.js (CORS) y auth.routes.js (loginLimiter). Helmet se aplica directamente en app.js. */
import { rateLimit } from "express-rate-limit";

//Origen del frontend permitido en desarrollo cuando no se define CORS_ORIGIN (servidor de Vite)
const DEV_DEFAULT_ORIGIN = "http://localhost:5173";

/* CORS restringido.
   - CORS_ORIGIN admite uno o varios orígenes separados por comas (p. ej. "https://miapp.vercel.app,http://localhost:5173").
   - Si no se define y NO estamos en producción, se permite solo el servidor de Vite (http://localhost:5173).
   - Si no se define en producción, no se autoriza ningún origen del navegador (más seguro que dejarlo abierto) y se avisa por consola.
   Las peticiones sin cabecera Origin (Postman, curl, supertest) no pasan por CORS y siguen funcionando. */
const getAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN;

  if (raw && raw.trim()) {
    return raw
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, "")) //Quitamos la barra final: el navegador envía el origen sin ella
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("CORS_ORIGIN no está definido: no se permitirá ningún origen de navegador. Defínelo con la URL del frontend.");
    return [];
  }

  return [DEV_DEFAULT_ORIGIN];
};

//Los orígenes se calculan en la primera petición (y no al importar el módulo) para que ya estén cargadas las variables de entorno
let allowedOrigins = null;

const corsOptions = {
  origin: (origin, callback) => {
    allowedOrigins ??= getAllowedOrigins();
    //true -> se añaden las cabeceras CORS para ese origen; false -> el navegador bloqueará la petición
    callback(null, allowedOrigins.includes(origin));
  },
};

/* Límite de intentos de login contra fuerza bruta.
   Por defecto: 10 intentos FALLIDOS por IP cada 15 minutos (skipSuccessfulRequests: los logins correctos no cuentan).
   Se exporta como función para poder probarla con otros valores. */
const createLoginLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 10,
  skip = () => process.env.NODE_ENV === "test", //Los tests de API hacen muchos logins seguidos: en test el límite se desactiva
} = {}) =>
  rateLimit({
    windowMs,
    limit: max,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7", //Envía las cabeceras RateLimit-* y Retry-After
    legacyHeaders: false,
    skip,
    handler: (req, res) =>
      res.status(429).json({
        message: "Demasiados intentos",
        error: "Has superado el número de intentos de inicio de sesión. Inténtalo de nuevo más tarde.",
      }),
  });

const loginLimiter = createLoginLimiter();

export { corsOptions, getAllowedOrigins, createLoginLimiter, loginLimiter };
