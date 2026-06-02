const Categoria = require("../models/categoriaArticulo");
const Articulo = require("../models/articulo");
const normalizar = require("../helpers/normalizaNombreArt");

// ⬇ GET TODAS
const getCategorias = async (req, res) => {
    try {
        const cats = await Categoria.find();
        res.json(cats);
    } catch (error) {
        res.status(500).json({ msg: "Error al obtener categorías" });
    }
};

// ⬇ CREAR
const crearCategoria = async (req, res) => {
    try {
        const { nombre, esProveedor } = req.body;

        if (!nombre) {
            return res.status(400).json({
                error: "El nombre es obligatorio"
            });
        }

        const nombreNormalizado = normalizar(nombre);
        const existe = await Categoria.findOne({ nombreNormalizado });

        if (existe) {
            return res.status(400).json({
                error: "La categoría ya existe"
            });
        }

        const nuevaCategoria = new Categoria({
            nombre: nombre.trim(),
            nombreNormalizado,
            esProveedor: Boolean(esProveedor)
        });

        await nuevaCategoria.save();

        return res.status(201).json(nuevaCategoria);

    } catch (error) {
        console.error("Error al crear categoría:", error);

        return res.status(500).json({
            error: "Error al crear categoría",
            detalle: error.message
        });
    }
};

// ⬇ EDITAR
const editarCategoria = async (req, res) => {
    const { id } = req.params;
    const { nombre, esProveedor } = req.body;

    try {
        const categoria = await Categoria.findById(id);
        if (!categoria) {
            return res.status(404).json({ msg: "Categoría no encontrada" });
        }

        if (nombre !== undefined) {
            if (!String(nombre).trim()) {
                return res.status(400).json({ msg: "El nombre no puede estar vacío" });
            }

            const nombreNormalizado = normalizar(nombre);
            const existe = await Categoria.findOne({
                nombreNormalizado,
                _id: { $ne: id }
            });

            if (existe) {
                return res.status(400).json({ msg: "La categoría ya existe" });
            }

            categoria.nombre = String(nombre).trim();
            categoria.nombreNormalizado = nombreNormalizado;
        }

        if (esProveedor !== undefined) {
            categoria.esProveedor = Boolean(esProveedor);
        }

        await categoria.save();

        res.json({ msg: "Categoría actualizada", categoria });

    } catch (error) {
        res.status(500).json({ msg: "Error al editar categoría" });
    }
};

// ⬇ ELIMINAR
const eliminarCategoria = async (req, res) => {
    const { id } = req.params;

    try {
        await Categoria.findByIdAndDelete(id);
        res.json({ msg: "Categoría eliminada" });
    } catch (error) {
        res.status(500).json({ msg: "Error al eliminar categoría" });
    }
};

// DESVINCULAR ARTICULO
const desvincularArticulo = async (req, res) => {
    const { id, articuloId } = req.params;

    try {
        const articulo = await Articulo.findById(articuloId);
        if (!articulo) {
            return res.status(404).json({ msg: "Articulo no encontrado" });
        }

        if (!articulo.categoria || String(articulo.categoria) !== id) {
            return res.status(400).json({ msg: "El articulo no pertenece a esta categoria" });
        }

        articulo.categoria = null;
        await articulo.save();

        await Categoria.findByIdAndUpdate(id, {
            $inc: { cantidadArticulos: -1 }
        });

        return res.json({
            msg: "Articulo desvinculado correctamente",
            articulo
        });
    } catch (error) {
        return res.status(500).json({
            msg: "Error al desvincular el articulo",
            detalle: error.message
        });
    }
};

module.exports = {
    getCategorias,
    crearCategoria,
    editarCategoria,
    eliminarCategoria,
    desvincularArticulo
};
