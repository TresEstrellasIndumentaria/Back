const Articulo = require('../models/articulo');
const Categoria = require('../models/categoriaArticulo');
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
    const { nombre, categoria, descripcion, precio, coste, composicion, artCompuesto } = req.body;

    try {
        if (!nombre || nombre.trim() === "") {
            return res.status(400).json({ msg: 'El nombre es obligatorio' });
        }

        // Verificar que la categoría exista
        const categoriaDB = await Categoria.findOne({ nombre: categoria });

        if (!categoriaDB) {
            return res.status(400).json({ msg: 'La categoría no existe' });
        }

        const nuevoArticulo = new Articulo({
            nombre,
            categoria,
            descripcion,
            composicion,
            precio,
            coste,
            artCompuesto,
        });

        await nuevoArticulo.save();

        // 🔼 Incrementar contador
        await Categoria.findByIdAndUpdate(
            categoriaDB._id,
            { $inc: { cantidadArticulos: 1 } }
        );

        res.status(201).json({
            msg: 'Artículo creado correctamente',
            articulo: nuevoArticulo
        });

    } catch (error) {
        res.status(500).json({
            msg: 'Error al crear el artículo',
            error: error.message
        });
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
    try {
        const { id } = req.params;

        // Primero obtener el artículo
        const articulo = await Articulo.findById(id);

        if (!articulo) {
            return res.status(404).json({
                message: 'Articulo no encontrado'
            });
        }

        // Buscar la categoría asociada
        const categoriaDB = await Categoria.findOne({ nombre: articulo.categoria });

        // Eliminar artículo
        await Articulo.findByIdAndDelete(id);

        // 🔽 Decrementar contador (sin ir a negativo)
        if (categoriaDB) {
            await Categoria.findByIdAndUpdate(
                categoriaDB._id,
                { $inc: { cantidadArticulos: -1 } }
            );
        }

        res.status(200).json({
            message: 'Articulo eliminado correctamente',
            idEliminado: id
        });

    } catch (error) {
        console.error('Error al eliminar articulo:', error);
        res.status(500).json({
            message: 'Error al eliminar el articulo',
            error: error.message
        });
    }
};


module.exports = {
    traerArticulos,
    traerArticulo,
    crearArticulo,
    modificarArticulo,
    eliminarArticulo
};
