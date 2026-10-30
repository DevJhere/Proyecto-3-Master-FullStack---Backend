# Backend – Raíces y Alas (Gestión PT)

API REST para la gestión de un gabinete pedagógico: usuarios (administradores y pedagogos), alumnos, sesiones de intervención e informes. Es el backend del proyecto *Raíces y Alas*; el cliente está en `../Frontend-Pedagogia/frontend-pedagogia`.

## Tecnologías

| Área | Herramienta |
|---|---|
| Runtime / framework | Node.js (ES Modules) + Express 5 |
| Base de datos | MongoDB + Mongoose 9 |
| Autenticación | JWT (`jsonwebtoken`, caducidad 2 h) + contraseñas con `bcrypt` |
| Archivos | Multer + Cloudinary (avatares y documentos) |
| Tests | Vitest + Supertest |
| Gestor de paquetes | pnpm |

## Estructura

```
Backend-Pedagogia/
├── src/
│   ├── app.js                 # Configura Express (middlewares y rutas). No arranca el servidor: se importa desde los tests
│   ├── index.js               # Punto de entrada: conecta DB y Cloudinary y escucha en PORT
│   ├── config/                # db.js (MongoDB) y cloudinary.js
│   ├── models/                # User, Student, Sessions
│   ├── controllers/           # userController, studentController, sessionsController
│   ├── routes/                # auth, user, student, session
│   ├── middlewares/           # auth.middleware.js (isAuth, isAdmin) y file.middleware.js (subidas)
│   ├── utils/                 # deleteFiles, escapeRegExp, students.seed.js
│   └── data/students.csv      # Datos de ejemplo para el seeder
├── tests/                     # Suite de tests (ver sección Tests)
├── Esquema - DB/              # Esquema visual de la base de datos (HTML)
└── .env.test.example          # Plantilla de variables para tests
```

## Puesta en marcha

### 1. Requisitos
- Node.js 20.6 o superior (se usa `--env-file`).
- pnpm.
- Una base MongoDB (Atlas o local) y una cuenta de Cloudinary.

### 2. Instalación
```bash
pnpm install
```

### 3. Variables de entorno
Crea un archivo `.env` en la raíz (no se versiona):

```env
DB_URL=mongodb+srv://<usuario>:<password>@<cluster>/pedagogia?retryWrites=true&w=majority
PORT=3000
JWT_SECRET=<cadena-larga-y-aleatoria>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
IMAGE_DEFAULT=profile-default.jpg
```

`IMAGE_DEFAULT` es el nombre de la imagen por defecto: los avatares que la contengan no se borran de Cloudinary al eliminar un alumno o usuario.

### 4. Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor con recarga automática (nodemon) |
| `pnpm start` | Servidor en modo producción |
| `pnpm test` | Ejecuta toda la suite de tests una vez |
| `pnpm test:watch` | Tests en modo observación |
| `pnpm seed:test` | Siembra la base de datos **de tests** |

El servidor queda en `http://localhost:3000` (o el `PORT` indicado) y la API cuelga de `/api`.

### 5. Primer administrador
El registro público (`POST /api/auth/register`) **siempre crea un pedagogo**. El rol `admin` solo lo puede asignar otro administrador. Para crear el primer administrador, registra un usuario normal y cambia su campo `rol` a `"admin"` directamente en MongoDB (Atlas o `mongosh`). A partir de ahí, el administrador gestiona los roles desde la pantalla *Usuarios* del frontend.

### Datos de ejemplo (opcional)
`src/utils/students.seed.js` importa los alumnos de `src/data/students.csv`, creando un pedagogo de ejemplo. **Atención:** ejecuta `Student.deleteMany()`, por lo que borra todos los alumnos existentes. Úsalo solo en una base de desarrollo.

## Modelo de datos

- **User**: `name`, `email` (único), `password` (hash, `select: false`), `specialization`, `avatar`, `rol` (`admin` | `pedagogo`, por defecto `pedagogo`).
- **Student**: `name`, `course`, `age` (3–18), `diagnosis`, `nameTutor`, `emailTutor`, `phoneNumberTutor` (9 dígitos), `tutorRelationship`, `avatar`, `pedagogoAsignado` (→ User) y `reports[]` (`title`, `attachmentDocument`, `date`).
- **Session**: `student` (→ Student), `pedagogoAsignado` (→ User), `date`, `status` (`Pendiente` | `Cancelado` | `Completado`), `duration` (min, 60 por defecto), `attachmentDocument`, `notes`.

Relaciones: un pedagogo tiene muchos alumnos; un alumno tiene muchas sesiones. El esquema visual está en `Esquema - DB/esquema_bd_pedagogia.html`.

## Autenticación y roles

Las rutas protegidas exigen la cabecera:

```
Authorization: Bearer <token>
```

El token se obtiene en `POST /api/auth/login` y caduca a las 2 horas.

| Rol | Alcance |
|---|---|
| `pedagogo` | Solo ve y gestiona **sus** alumnos y **sus** sesiones. Puede editar su propio perfil |
| `admin` | Ve todos los alumnos y sesiones, asigna alumnos a pedagogos, gestiona usuarios y roles |

Reglas de negocio destacadas:
- Un pedagogo que crea un alumno queda como su pedagogo asignado; un admin debe elegir un pedagogo existente.
- Siempre debe existir al menos un administrador.
- Un admin no puede eliminar su propia cuenta.
- No se permite eliminar un usuario que tenga alumnos o sesiones asignados (la respuesta incluye el detalle en `details`).
- Una sesión no puede solaparse en el tiempo con otra del mismo pedagogo (error de conflicto de horario).
- Al eliminar un alumno se eliminan también sus sesiones y los archivos asociados en Cloudinary.

## Endpoints

Base: `/api`. Los envíos con archivos usan `multipart/form-data`.

### Auth – `/api/auth`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/register` | Público | Registra un pedagogo. Campos: `name`, `email`, `password` (mín. 6), `specialization`, `avatar` (archivo, opcional) |
| POST | `/login` | Público | Devuelve el usuario y el `token` |
| GET | `/me` | Autenticado | Datos del usuario del token |

### Usuarios – `/api/users`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/` | Admin | Lista de usuarios |
| PUT | `/:id` | Propio usuario o admin | Actualiza perfil (`name`, `specialization`, `avatar`…). Solo un admin puede cambiar `rol` |
| DELETE | `/:id` | Admin | Elimina un usuario (con las restricciones indicadas arriba) |

### Alumnos – `/api/students`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/` | Autenticado | Admin: todos. Pedagogo: solo los suyos |
| GET | `/:id` | Autenticado | Ficha de un alumno (el pedagogo solo si es suyo) |
| POST | `/` | Autenticado | Crea un alumno. Campos obligatorios: `name`, `age`, `course`, `diagnosis`, `nameTutor`, `emailTutor`, `phoneNumberTutor`, `tutorRelationship`; `pedagogoAsignado` solo para admin; `avatar` opcional |
| PUT | `/:id` | Autenticado | Actualiza un alumno |
| DELETE | `/:id` | Autenticado | Elimina al alumno, sus sesiones y archivos |
| POST | `/:id/reports` | Autenticado | Sube un informe: `title` + `attachmentDocument` (pdf, doc, docx, txt; máx. 20 MB) |

### Sesiones – `/api/sessions`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/` | Autenticado | Admin: todas. Pedagogo: las suyas |
| GET | `/:id` | Autenticado | Detalle de una sesión |
| POST | `/` | Autenticado | Crea una sesión: `student`, `date` obligatorios; `status`, `duration`, `notes`, `attachmentDocument` opcionales |
| PUT | `/:id` | Autenticado | Actualiza `date`, `status`, `duration`, `notes` o el documento (el admin también `student` y `pedagogoAsignado`) |
| DELETE | `/:id` | Autenticado | Elimina la sesión |

Cualquier otra ruta responde `404 { "message": "Endpoint no encontrado" }`.

### Formato de errores
Las respuestas de error siguen el patrón `{ "message": "...", "error": "..." }` (a veces con `details`). Códigos habituales: `400` datos inválidos, `401` sin token o token inválido, `403` sin permisos, `404` no encontrado, `409`/conflicto de horario en sesiones, `500` error interno.

### Archivos
- Imágenes (avatares): jpg, jpeg, png, webp, máx. 5 MB.
- Documentos (informes y adjuntos de sesión): pdf, doc, docx, txt, máx. 20 MB.
- Se almacenan en Cloudinary (`API_pedagogia/avatars` y `API_pedagogia/documentos`). Si una petición falla tras subir un archivo, el controlador lo borra para no dejarlo huérfano.

## Tests

La suite (Vitest + Supertest) cubre autenticación, usuarios, alumnos, informes, sesiones, agenda y utilidades: **8 archivos, 228 tests**.

1. Copia `.env.test.example` a `.env.test` y rellénalo. **`DB_URL` debe apuntar a una base distinta de la real** (por ejemplo `pedagogia-test`). `tests/helpers/guard.js` aborta la ejecución si la base no parece de tests.
2. Ejecuta `pnpm test`.

Notas:
- Cloudinary se sustituye por mocks: los tests no suben ni borran archivos reales.
- Los archivos se ejecutan de uno en uno (`fileParallelism: false`) porque comparten la misma base remota; la suite tarda alrededor de un minuto.
- Cada archivo de test lleva comentarios que indican qué funcionalidad cubre.

## Seguridad y limitaciones conocidas

- CORS está abierto a cualquier origen (`cors()` sin restricciones); en producción conviene limitarlo al dominio del frontend.
- No hay `helmet` ni límite de peticiones (*rate limiting*), por ejemplo en el login.
- No existe recuperación de contraseña ni verificación de correo.
- El primer administrador se crea manualmente en la base de datos.
- Las listas (`GET /students`, `GET /sessions`) no están paginadas en el servidor; la paginación de Alumnos se hace en el cliente.
- La contraseña de ejemplo del seeder (`password123`) es solo para desarrollo.
