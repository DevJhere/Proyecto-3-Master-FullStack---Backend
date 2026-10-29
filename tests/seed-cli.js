/* Resetea y rellena la base pedagogia-test. Uso: pnpm seed:test (carga .env.test con --env-file) */
import { connectTestDb, disconnectTestDb, resetDb, seedTestData } from "./helpers/seed.js";

try {
  await connectTestDb(); // incluye la comprobación de que la base es pedagogia-test
  await resetDb();
  const data = await seedTestData();

  console.log("Base pedagogia-test reiniciada con datos de prueba:");
  console.log(`  admin     ${data.users.admin.email}`);
  console.log(`  pedagogo  ${data.users.samantha.email}  (3 alumnos)`);
  console.log(`  pedagogo  ${data.users.nathan.email}  (2 alumnos)`);
  console.log(`  contraseña de todos: ${data.password}`);
  await disconnectTestDb();
} catch (error) {
  console.error("Error en el seed de test:", error.message);
  process.exit(1);
}
