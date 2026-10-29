/* Salvaguarda: los tests borran colecciones enteras, así que SOLO pueden correr contra la base pedagogia-test. */
const TEST_DB_NAME = "pedagogia-test";

const assertTestDb = () => {
  const url = process.env.DB_URL || "";
  // Nombre de la base: lo que hay entre la última "/" del host y el "?"
  const dbName = url.split("?")[0].split("/").pop();

  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `Abortado: DB_URL apunta a "${dbName || "(sin nombre)"}" y los tests solo pueden usar "${TEST_DB_NAME}". Revisa .env.test`,
    );
  }
};

export { assertTestDb, TEST_DB_NAME };
