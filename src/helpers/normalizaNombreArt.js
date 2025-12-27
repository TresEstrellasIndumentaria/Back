/**
 * Normaliza un texto para comparaciones:
 * - elimina espacios al inicio y fin
 * - pasa a minúsculas
 * - quita acentos
 * - colapsa espacios múltiples
 */
const normalizarTexto = (texto = "") => {
    return texto
        .trim()
        .toLowerCase()
        .normalize("NFD")               // separa acentos
        .replace(/[\u0300-\u036f]/g, "") // elimina acentos
        .replace(/\s+/g, " ");          // espacios múltiples → uno solo
};

module.exports = normalizarTexto; 
