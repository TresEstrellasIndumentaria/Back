const Categoria = require("../models/Categoria");

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
    const { nombre } = req.body;

    try {
        const existe = await Categoria.findOne({ nombre });
        if (existe) {
            return res.status(400).json({ msg: "La categoría ya existe" });
        }

        const nueva = await Categoria.create({ nombre });
        res.json({ msg: "Categoría creada", categoria: nueva });

    } catch (error) {
        res.status(500).json({ msg: "Error al crear categoría" });
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
