const Articulo = require('../models/articulo');
const Categoria = require('../models/categoriaArticulo');
const normalizar = require('../helpers/normalizaNombreArt');
const MovimientoInventario = require('../models/movimientoInventario');
const UsuarioAuth = require('../models/usuarioAuth');

const parsearStock = (stock, mensaje = 'Stock invalido. Debe ser un numero mayor o igual a 0') => {
    const stockNumerico = Number(stock);

    if (!Number.isFinite(stockNumerico) || stockNumerico < 0) {
        throw new Error(mensaje);
    }

    return stockNumerico;
};

const parsearPrecio = (precio, mensaje = 'Precio invalido. Debe ser un numero mayor o igual a 0') => {
    const precioNumerico = Number(precio);

    if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
        throw new Error(mensaje);
    }

    return precioNumerico;
};

const parsearCoste = (coste, mensaje = 'Coste invalido. Debe ser un numero mayor o igual a 0') => {
    const costeNumerico = Number(coste);

    if (!Number.isFinite(costeNumerico) || costeNumerico < 0) {
        throw new Error(mensaje);
    }

    return costeNumerico;
};

const claveTalle = (talle) => String(talle || '').trim().toUpperCase();
const calcularStockTotal = (talles = []) => talles.reduce((total, item) => total + Number(item.stock || 0), 0);

const normalizarComposicionTalle = (composicion, composicionActual = []) => {
    if (composicion === undefined) {
        return Array.isArray(composicionActual) ? composicionActual : [];
    }

    if (!Array.isArray(composicion)) {
        throw new Error('La composicion del talle debe ser un arreglo');
    }

    return composicion.map((item) => {
        const articulo = item?.articulo ? String(item.articulo).trim() : '';
        const cantidad = Number(item?.cantidad ?? 1);
        const coste = parsearCoste(item?.coste ?? 0);

        if (!articulo) {
            throw new Error('Cada item de composicion debe incluir articulo');
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error('Cada item de composicion debe incluir cantidad mayor a 0');
        }

        return { articulo, cantidad, coste };
    });
};

const normalizarTalles = (talles, tallesActuales = []) => {
    if (talles === undefined) {
        return undefined;
    }

    if (!Array.isArray(talles)) {
        throw new Error('El campo talles debe ser un arreglo');
    }

    const stockActualPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), Number(item.stock || 0)])
    );
    const entrantesActualPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), Number(item.entrantes || 0)])
    );
    const artCompuestoPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), Boolean(item.artCompuesto)])
    );
    const composicionPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), item.composicion || []])
    );

    return talles.map((item) => {
        const talle = item?.talle?.toString().trim();
        const ancho = item?.ancho?.toString().trim();
        const alto = item?.alto?.toString().trim();
        const talleKey = claveTalle(talle);

        if (!talle || !ancho || !alto || item?.precio === undefined || item?.coste === undefined) {
            throw new Error('Cada talle debe incluir talle, ancho, alto, precio y coste');
        }

        const precio = parsearPrecio(item.precio);
        const coste = parsearCoste(item.coste);
        if (coste > precio) {
            throw new Error(`El coste no puede ser mayor al precio en el talle ${talle}`);
        }
        const stock = item?.stock !== undefined
            ? parsearStock(item.stock)
            : (stockActualPorTalle.get(talleKey) ?? 0);
        const entrantes = entrantesActualPorTalle.get(talleKey) ?? 0;
        const artCompuesto = item?.artCompuesto !== undefined
            ? Boolean(item.artCompuesto)
            : (artCompuestoPorTalle.get(talleKey) ?? false);
        const composicion = normalizarComposicionTalle(
            item?.composicion,
            composicionPorTalle.get(talleKey) ?? []
        );

        if (artCompuesto && !composicion.length) {
            throw new Error(`El talle ${talle} es compuesto y debe incluir composicion`);
        }

        return {
            talle,
            ancho,
            alto,
            precio,
            coste,
            artCompuesto,
            composicion: artCompuesto ? composicion : [],
            stock,
            entrantes
        };
    });
};

const validarTallesEliminados = (tallesActuales = [], tallesNuevos = []) => {
    const tallesNuevosMap = new Set(tallesNuevos.map((item) => claveTalle(item.talle)));

    for (const talleActual of tallesActuales) {
        const talleKey = claveTalle(talleActual.talle);
        const sigueExistiendo = tallesNuevosMap.has(talleKey);
        const tieneStock = Number(talleActual.stock || 0) > 0;
        const tieneEntrantes = Number(talleActual.entrantes || 0) > 0;

        if (!sigueExistiendo && (tieneStock || tieneEntrantes)) {
            throw new Error(
                `No se puede eliminar el talle ${talleActual.talle} porque tiene stock o entrantes pendientes`
            );
        }
    }
};

const validarTallesDuplicados = (talles = []) => {
    const tallesVistos = new Set();

    for (const item of talles) {
        const talleKey = claveTalle(item.talle);
        if (tallesVistos.has(talleKey)) {
            throw new Error(`El talle ${item.talle} esta repetido`);
        }

        tallesVistos.add(talleKey);
    }
};


// ================================
// TRAER TODOS LOS ARTICULOS
// ================================
const traerArticulos = async (req, res) => {
    try {
        const articulos = await Articulo.find().populate('categoria', 'nombre');
        res.json(articulos);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener los articulos', error: error.message });
    }
};

// ================================
// TRAER ARTICULO POR ID
// ================================
const traerArticulo = async (req, res) => {
    const { id } = req.params;

    try {
        const articulo = await Articulo.findById(id).populate('categoria', 'nombre');
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo no encontrado' });
        }
        res.json(articulo);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el articulo', error: error.message });
    }
};

// ================================
// CREAR ARTICULO
// ================================
const crearArticulo = async (req, res) => {
    const { nombre, categoria, descripcion, talles } = req.body;

    try {
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ msg: 'El nombre es obligatorio' });
        }

        if (!categoria) {
            return res.status(400).json({ msg: 'La categoria es obligatoria' });
        }

        let categoriaDB = null;
        const categoriaTexto = String(categoria).trim();

        if (categoriaTexto.match(/^[0-9a-fA-F]{24}$/)) {
            categoriaDB = await Categoria.findById(categoriaTexto);
        }

        if (!categoriaDB) {
            const nombreNormalizado = normalizar(categoriaTexto);
            categoriaDB = await Categoria.findOne({ nombreNormalizado });
        }

        if (!categoriaDB) {
            return res.status(400).json({ msg: 'La categoria no existe' });
        }

        const tallesNormalizados = normalizarTalles(talles) ?? [];
        validarTallesDuplicados(tallesNormalizados);

        if (!tallesNormalizados.length) {
            return res.status(400).json({ msg: 'Debe informar al menos un talle' });
        }

        const nuevoArticulo = new Articulo({
            nombre,
            categoria: categoriaDB._id,
            descripcion,
            talles: tallesNormalizados
        });

        await nuevoArticulo.save();

        // Incrementar contador
        await Categoria.findByIdAndUpdate(categoriaDB._id, { $inc: { cantidadArticulos: 1 } });

        res.status(201).json({
            msg: 'Articulo creado correctamente',
            articulo: await nuevoArticulo.populate('categoria', 'nombre')
        });
    } catch (error) {
        res.status(500).json({
            msg: 'Error al crear el articulo',
            error: error.message
        });
    }
};

// =================================
// MODIFICAR ARTICULO
// =================================
const modificarArticulo = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, categoria, talles } = req.body; console.log("DataModif:", req.body)

    try {
        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo no encontrado' });
        }

        articulo.nombre = nombre ?? articulo.nombre;
        articulo.descripcion = descripcion ?? articulo.descripcion;

        if (talles !== undefined) {
            const tallesNormalizados = normalizarTalles(talles, articulo.talles);
            validarTallesDuplicados(tallesNormalizados);
            validarTallesEliminados(articulo.talles, tallesNormalizados);
            articulo.talles = tallesNormalizados;
        }

        if (categoria !== undefined) {
            const categoriaTexto = String(categoria).trim();
            let categoriaDB = null;

            if (!categoriaTexto) {
                return res.status(400).json({ msg: 'La categoria no puede estar vacia' });
            }

            if (categoriaTexto.match(/^[0-9a-fA-F]{24}$/)) {
                categoriaDB = await Categoria.findById(categoriaTexto);
            }

            if (!categoriaDB) {
                const nombreNormalizado = normalizar(categoriaTexto);
                categoriaDB = await Categoria.findOne({ nombreNormalizado });
            }

            if (!categoriaDB) {
                return res.status(400).json({ msg: 'La categoria no existe' });
            }

            const categoriaAnterior = articulo.categoria ? String(articulo.categoria) : null;
            const categoriaNueva = String(categoriaDB._id);

            if (categoriaAnterior !== categoriaNueva) {
                articulo.categoria = categoriaDB._id;

                if (categoriaAnterior) {
                    await Categoria.findByIdAndUpdate(categoriaAnterior, { $inc: { cantidadArticulos: -1 } });
                }
                await Categoria.findByIdAndUpdate(categoriaNueva, { $inc: { cantidadArticulos: 1 } });
            }
        }

        await articulo.save();

        res.json({
            msg: 'Articulo modificado correctamente',
            articulo: await articulo.populate('categoria', 'nombre')
        });
    } catch (error) {
        res.status(500).json({ msg: 'Error al modificar el articulo', error: error.message });
    }
};

// =================================
// ELIMINAR ARTICULO
// =================================
const eliminarArticulo = async (req, res) => {
    try {
        const { id } = req.params;

        // Primero obtener el articulo
        const articulo = await Articulo.findById(id);

        if (!articulo) {
            return res.status(404).json({
                message: 'Articulo no encontrado'
            });
        }

        const categoriaId = articulo.categoria;

        // Eliminar articulo
        await Articulo.findByIdAndDelete(id);

        // Decrementar contador
        if (categoriaId) {
            await Categoria.findByIdAndUpdate(categoriaId, { $inc: { cantidadArticulos: -1 } });
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

// =================================
// MODIFICAR STOCK ARTICULO
// =================================
const modificarStockArticulo = async (req, res) => {
    const { id } = req.params;
    const { stock, talle, motivo, anotaciones, coste, tienda, colaborador } = req.body;

    try {
        if (stock === undefined) {
            return res.status(400).json({ msg: 'Debe enviar el campo stock' });
        }

        const nuevoStock = parsearStock(stock);

        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo no encontrado' });
        }

        if (!Array.isArray(articulo.talles) || !articulo.talles.length) {
            return res.status(400).json({ msg: 'El articulo no tiene talles configurados' });
        }

        let ajuste = 0;
        let talleMovimiento = '';
        let stockFinal = 0;

        if (talle !== undefined && talle !== null && String(talle).trim() !== '') {
            const talleBuscado = String(talle).trim().toUpperCase();
            const indiceTalle = articulo.talles.findIndex(
                (item) => String(item.talle || '').trim().toUpperCase() === talleBuscado
            );

            if (indiceTalle === -1) {
                return res.status(404).json({ msg: 'Talle no encontrado en el articulo' });
            }

            const stockAnteriorTalle = Number(articulo.talles[indiceTalle].stock || 0);
            articulo.talles[indiceTalle].stock = nuevoStock;

            ajuste = nuevoStock - stockAnteriorTalle;
            talleMovimiento = articulo.talles[indiceTalle].talle;
            stockFinal = nuevoStock;
        } else {
            return res.status(400).json({
                msg: 'Este articulo maneja stock por talle. Envie tambien el campo talle'
            });
        }

        await articulo.save();

        if (ajuste !== 0) {
            const talleActual = articulo.talles.find(
                (item) => claveTalle(item.talle) === claveTalle(talleMovimiento)
            );
            const costeMovimiento = Number(coste ?? talleActual?.coste ?? 0);

            await MovimientoInventario.create({
                articulo: articulo._id,
                colaborador: req.user?.id || colaborador || undefined,
                tienda: tienda || '',
                talle: talleMovimiento,
                motivo: motivo || '',
                anotaciones: anotaciones || '',
                ajuste,
                stockFinal,
                coste: costeMovimiento
            });
        }

        return res.json({
            msg: 'Stock actualizado correctamente',
            articulo
        });
    } catch (error) {
        console.log('ERROR modificarStockArticulo:', error);
        return res.status(500).json({
            msg: 'Error al actualizar stock del articulo',
            error: error.message
        });
    }
};

// =================================
// OBT HISTORIAL
// =================================
const obtenerHistorialInventario = async (req, res) => {
    try {
        const { desde, hasta, colaborador, motivo, limit = 500 } = req.query;

        const filtros = {};
        if (desde || hasta) {
            filtros.fecha = {};
            if (desde) filtros.fecha.$gte = new Date(`${desde}T00:00:00`);
            if (hasta) filtros.fecha.$lte = new Date(`${hasta}T23:59:59`);
        }

        if (motivo && motivo !== 'TODOS') filtros.motivo = motivo;

        if (colaborador && colaborador !== 'TODOS') {
            const users = await UsuarioAuth.find()
                .populate('personaId', 'nombre apellido')
                .lean();

            const ids = users
                .filter((u) => {
                    const nombre = `${u?.personaId?.nombre || ''} ${u?.personaId?.apellido || ''}`.trim();
                    return nombre === colaborador;
                })
                .map((u) => u._id);

            filtros.colaborador = { $in: ids.length ? ids : [] };
        }

        const movimientos = await MovimientoInventario.find(filtros)
            .sort({ fecha: -1 })
            .limit(Number(limit))
            .populate('articulo', 'nombre')
            .populate({ path: 'colaborador', populate: { path: 'personaId', select: 'nombre apellido' } });

        const data = movimientos.map((m) => ({
            _id: m._id,
            fecha: m.fecha,
            articulo: m.articulo?._id,
            articuloNombre: m.articulo?.nombre || '-',
            talle: m.talle || '',
            tienda: m.tienda || 'Liz',
            empleadoNombre: `${m.colaborador?.personaId?.nombre || ''} ${m.colaborador?.personaId?.apellido || ''}`.trim() || '-',
            motivo: m.motivo,
            ajuste: m.ajuste,
            stockFinal: m.stockFinal,
            anotaciones: m.anotaciones || ''
        }));

        return res.status(200).json({ movimientos: data });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener historial de inventario', error: error.message });
    }
};


module.exports = {
    traerArticulos,
    traerArticulo,
    crearArticulo,
    modificarArticulo,
    eliminarArticulo,
    modificarStockArticulo,
    obtenerHistorialInventario
};
