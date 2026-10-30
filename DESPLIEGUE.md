# Despliegue en producción – Raíces y Alas (Gestión PT)

Documento del despliegue realizado. La aplicación se publica en tres servicios gratuitos:

| Capa | Servicio | URL |
|---|---|---|
| Base de datos | MongoDB Atlas (cluster `MyCluster`, base `pedagogia-prod`) | – |
| Backend (API) | Render (Web Service) | `https://proyecto-3-master-fullstack-backend.onrender.com` |
| Frontend (SPA) | Vercel | `https://proyecto-3-master-full-stack-fronte.vercel.app` |

Además se usa **Cloudinary** (ya existente) para las fotos y los documentos.

```
Navegador ──► Vercel (React) ──► Render (Express /api) ──► Atlas (pedagogia-prod)
                                          └──────────────► Cloudinary
```

> Ningún secreto se guarda en el repositorio. Todas las credenciales se definen como variables de entorno en cada servicio.

---

## 1. Preparación del código (cambios hechos antes de desplegar)

| Cambio | Archivo | Motivo |
|---|---|---|
| Script `start` sin `--env-file=.env` | `package.json` | En Render no existe el archivo `.env`; las variables las inyecta la plataforma |
| `engines.node >= 20.6` | `package.json` | Render usa la versión de Node indicada |
| Cabeceras de seguridad | `src/app.js` (`helmet`) | Protección básica HTTP |
| CORS restringido a `CORS_ORIGIN` | `src/middlewares/security.middleware.js` | Solo el frontend desplegado puede usar la API desde un navegador |
| Límite de intentos de login | `src/middlewares/security.middleware.js` + `auth.routes.js` | 10 fallos por IP cada 15 min (429) |
| `TRUST_PROXY` | `src/app.js` | Render está detrás de un proxy; así el límite usa la IP real |
| Plantilla `.env.example` | raíz | Documenta las variables necesarias |
| Script `seed:admin` | `src/utils/createAdmin.js` | El registro público solo crea pedagogos; el primer admin se crea con este script |
| Reescritura SPA | `vercel.json` (frontend) | Recargar `/students` o `/login` no debe dar 404 |

---

## 2. Base de datos – MongoDB Atlas

1. Se reutilizó el cluster `MyCluster`, pero con una **base distinta** para no mezclar datos de desarrollo y producción: `pedagogia-prod`.
   - MongoDB crea la base al escribir el primer documento; en Atlas se creó vacía desde *Browse Collections → Create Database*.
2. El usuario de base de datos tiene permisos de lectura y escritura sobre el cluster.
3. En **Network Access** debe permitirse el acceso desde Render. Como el plan gratuito de Render no tiene IP fija, se permite `0.0.0.0/0` (cualquier IP). La seguridad recae en la contraseña del usuario de Atlas.
4. La cadena de conexión de producción es la misma que la de desarrollo cambiando el nombre de la base por `pedagogia-prod`:

```
mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/pedagogia-prod?retryWrites=true&w=majority
```

> Regla seguida durante todo el proyecto: los tests y el servidor de desarrollo usan siempre bases separadas (`pedagogia-test`, `pedagogia-db`) y nunca `pedagogia-prod`.

---

## 3. Backend – Render

Se creó un **Web Service** conectado al repositorio de GitHub del backend.

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `pnpm install` |
| Start Command | `pnpm start` (ejecuta `node src/index.js`) |
| Plan | Free |

### Variables de entorno (Environment)

| Variable | Valor |
|---|---|
| `DB_URL` | Cadena de conexión a `pedagogia-prod` |
| `JWT_SECRET` | Cadena larga y aleatoria (distinta a la de desarrollo) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary |
| `IMAGE_DEFAULT` | Nombre de la imagen por defecto |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGIN` | `https://proyecto-3-master-full-stack-fronte.vercel.app` (sin barra final y sin `/login`) |

`PORT` no se define: Render lo inyecta automáticamente.

> `CORS_ORIGIN` compara el **origen exacto** (esquema + dominio). Si se añade una barra final o una ruta, el navegador bloqueará las peticiones. Para varios orígenes se separan por comas.

---

## 4. Frontend – Vercel

Se importó el repositorio del frontend (carpeta `frontend-pedagogia`).

| Campo | Valor |
|---|---|
| Framework | Vite |
| Build Command | `pnpm build` |
| Output Directory | `dist` |

### Variable de entorno

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://proyecto-3-master-fullstack-backend.onrender.com/api` |

Vite incrusta esta variable **en la compilación**: si se cambia, hay que volver a desplegar el frontend. Debe incluir `/api` al final.

`vercel.json` reescribe todas las rutas a `index.html` para que React Router funcione al recargar.

---

## 5. Primer administrador

El registro público siempre crea pedagogos, así que el primer administrador se crea con `pnpm seed:admin` apuntando a **producción** (desde el PowerShell local, con variables solo para esa ejecución):

```powershell
cd Backend-Pedagogia
$env:DB_URL = "<cadena de Atlas con /pedagogia-prod?...>"
$env:ADMIN_EMAIL = "<correo>"
$env:ADMIN_PASSWORD = "<contraseña, mínimo 6 caracteres>"
$env:ADMIN_NAME = "<nombre>"
pnpm seed:admin
Remove-Item Env:DB_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_NAME
```

Resultado esperado: `Administrador creado: <correo>`. El script es idempotente: si el correo ya existe, solo lo promociona a admin sin cambiar su contraseña.

Antes de lanzarlo se comprobó que la URL terminaba en `/pedagogia-prod?` para no tocar la base de desarrollo.

---

## 6. Verificación realizada

| Comprobación | Resultado |
|---|---|
| Backend: cabeceras de `helmet` | Presentes |
| Backend: ruta inexistente | 404 en JSON |
| Backend: `/api/students` sin token | 401 |
| Backend: login con usuario inexistente | 401 (confirma conexión con Atlas) |
| Frontend: `/`, `/login`, `/students`, `/dashboard` | 200 (el reescrito SPA funciona) |
| Frontend: URL de la API incrustada en el bundle | La del backend en Render |
| CORS: preflight desde el dominio de Vercel | 204 con `access-control-allow-origin` correcto |
| CORS: preflight desde otro origen | Sin cabecera `access-control-allow-origin` (bloqueado) |
| Login del administrador en producción | 200 |
| Prueba manual en la web | Login, alumno con foto (Cloudinary), recarga de `/students`, registro de pedagogo y sesiones: correcto |

---

## 7. Notas de operación

- **Arranque en frío**: en el plan gratuito, Render duerme el servicio tras 15 minutos sin tráfico; la primera petición tarda 30-60 s.
- **Redespliegues**: cada `push` a `main` redespliega automáticamente en Render y Vercel. Cambiar una variable de entorno en Render también reinicia el servicio.
- **Contraseña del administrador**: la inicial se cambia desde *Perfil* tras el primer acceso.
- **Límite de login en memoria**: se reinicia con el servicio y no se comparte entre instancias (suficiente con una sola instancia).
- **Problemas frecuentes**:

| Síntoma | Causa probable |
|---|---|
| Error de CORS en la consola del navegador | `CORS_ORIGIN` mal escrito (barra final, ruta, `http` en vez de `https`) |
| El frontend llama a `localhost` | `VITE_API_URL` no estaba definida al compilar; definirla y redesplegar |
| 404 al recargar una ruta | Falta `vercel.json` |
| Login siempre 401 | La base de datos de `DB_URL` no es `pedagogia-prod` o el admin no se creó |
| 429 en el login | Más de 10 intentos fallidos en 15 min desde la misma IP |
| El backend no arranca en Render | Falta alguna variable obligatoria (`DB_URL`, `JWT_SECRET`, Cloudinary) |
