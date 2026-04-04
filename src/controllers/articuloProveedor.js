const ArticuloProveedor = require('../models/articuloProveedor');

const parsearPrecio = (precio) => {
    const precioNumerico = Number(precio);

    if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
        throw new Error('Precio invalido. Debe ser un numero mayor o igual a 0');
    }

    return precioNumerico;
};

const traerArticulosProveedor = async (_req, res) => {
    try {
        const articulos = await ArticuloProveedor.find().sort({ nombre: 1 });
        return res.json(articulos);
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener articulos de proveedor', error: error.message });
    }
};

const traerArticuloProveedor = async (req, res) => {
    const { id } = req.params;

    try {
        const articulo = await ArticuloProveedor.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo de proveedor no encontrado' });
        }

        return res.json(articulo);
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener el articulo de proveedor', error: error.message });
    }
};

const crearArticuloProveedor = async (req, res) => {
    const { nombre, categoria, descripcion, precio } = req.body;

    try {
        if (!nombre || !String(nombre).trim()) {
            return res.status(400).json({ msg: 'El nombre es obligatorio' });
        }

        if (!categoria || !String(categoria).trim()) {
            return res.status(400).json({ msg: 'La categoria es obligatoria' });
        }

        const nuevoArticulo = new ArticuloProveedor({
            nombre: String(nombre).trim(),
            categoria: String(categoria).trim(),
            descripcion: descripcion ? String(descripcion).trim() : '',
            precio: parsearPrecio(precio)
        });

        await nuevoArticulo.save();

        return res.status(201).json({
            msg: 'Articulo de proveedor creado correctamente',
            articulo: nuevoArticulo
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al crear articulo de proveedor', error: error.message });
    }
};

const modificarArticuloProveedor = async (req, res) => {
    const { id } = req.params;
    const { nombre, categoria, descripcion, precio } = req.body;

    try {
        const articulo = await ArticuloProveedor.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo de proveedor no encontrado' });
        }

        if (nombre !== undefined) {
            if (!String(nombre).trim()) {
                return res.status(400).json({ msg: 'El nombre no puede estar vacio' });
            }
            articulo.nombre = String(nombre).trim();
        }

        if (categoria !== undefined) {
            if (!String(categoria).trim()) {
                return res.status(400).json({ msg: 'La categoria no puede estar vacia' });
            }
            articulo.categoria = String(categoria).trim();
        }

        if (descripcion !== undefined) {
            articulo.descripcion = String(descripcion).trim();
        }

        if (precio !== undefined) {
            articulo.precio = parsearPrecio(precio);
        }

        await articulo.save();

        return res.json({
            msg: 'Articulo de proveedor modificado correctamente',
            articulo
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al modificar articulo de proveedor', error: error.message });
    }
};

const eliminarArticuloProveedor = async (req, res) => {
    const { id } = req.params;

    try {
        const articulo = await ArticuloProveedor.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo de proveedor no encontrado' });
        }

        await ArticuloProveedor.findByIdAndDelete(id);

        return res.json({
            msg: 'Articulo de proveedor eliminado correctamente',
            idEliminado: id
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al eliminar articulo de proveedor', error: error.message });
    }
};

module.exports = {
    traerArticulosProveedor,
    traerArticuloProveedor,
    crearArticuloProveedor,
    modificarArticuloProveedor,
    eliminarArticuloProveedor
};
