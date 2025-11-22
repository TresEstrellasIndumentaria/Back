const Articulo = require('../models/articulo');

// ================================
// TRAER TODOS LOS ARTÍCULOS
// ================================
const traerArticulos = async (req, res) => {
    try {
        const articulos = await Articulo.find();
        res.json(articulos);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener los artículos', error: error.message });
    }
};

// ================================
// TRAER ARTÍCULO POR ID
// ================================
const traerArticulo = async (req, res) => {
    const { id } = req.params;

    try {
        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Artículo no encontrado' });
        }
        res.json(articulo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el artículo', error: error.message });
    }
};

// ================================
// CREAR ARTÍCULO
// ================================
const crearArticulo = async (req, res) => {
    const { nombre, categoria, descripcion, vendidoPor, precio, coste, composicion, artCompuesto } = req.body;

    try {
        // Validaciones básicas
        if (!nombre || nombre.trim() === "") {
            return res.status(400).json({ msg: 'El nombre es obligatorio' });
        }

        const nuevoArticulo = new Articulo({
            nombre,
            categoria,
            descripcion,
            composicion,            
            vendidoPor,
            precio,
            coste,
            artCompuesto,
        });

        await nuevoArticulo.save();

        res.status(201).json({
            msg: 'Artículo creado correctamente',
            articulo: nuevoArticulo
        });

    } catch (error) {
        res.status(500).json({ msg: 'Error al crear el artículo', error: error.message });
    }
};

// =================================
// MODIFICAR ARTÍCULO
// =================================
const modificarArticulo = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, composicion } = req.body;

    try {
        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Artículo no encontrado' });
        }

        articulo.nombre = nombre ?? articulo.nombre;
        articulo.descripcion = descripcion ?? articulo.descripcion;
        articulo.composicion = composicion ?? articulo.composicion;

        await articulo.save();

        res.json({
            msg: 'Artículo modificado correctamente',
            articulo
        });

    } catch (error) {
        res.status(500).json({ msg: 'Error al modificar el artículo', error: error.message });
    }
};

// =================================
// ELIMINAR ARTÍCULO
// =================================
const eliminarArticulo = async (req, res) => {
    const { id } = req.params;

    try {
        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Artículo no encontrado' });
        }

        await articulo.deleteOne();

        res.json({ msg: 'Artículo eliminado correctamente' });

    } catch (error) {
        res.status(500).json({ msg: 'Error al eliminar el artículo', error: error.message });
    }
};

module.exports = {
    traerArticulos,
    traerArticulo,
    crearArticulo,
    modificarArticulo,
    eliminarArticulo
};
