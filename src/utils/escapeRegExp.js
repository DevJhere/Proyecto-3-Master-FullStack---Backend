/* Escapa los caracteres especiales de una expresión regular para usar texto del usuario como búsqueda literal */
const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//Exportamos
export default escapeRegExp;
