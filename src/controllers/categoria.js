const Categoria = require("../models/categoriaArticulo");
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
        const { nombre } = req.body;

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
            nombreNormalizado
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
    const { nombre } = req.body;

    try {
        const categoria = await Categoria.findByIdAndUpdate(
            id,
            { nombre },
            { new: true }
        );

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

module.exports = {
    getCategorias,
    crearCategoria,
    editarCategoria,
    eliminarCategoria
};
