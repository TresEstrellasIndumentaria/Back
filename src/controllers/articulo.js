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
const normalizarCodigoArticulo = (codigo) => String(codigo || '').trim().toUpperCase();

const totalStockArticulo = (articulo) => {
    const stockRaiz = Number(articulo?.stock || 0);
    const stockTalles = Array.isArray(articulo?.talles)
        ? articulo.talles.reduce((total, talle) => total + Number(talle?.stock || 0), 0)
        : 0;

    return Math.max(stockRaiz, stockTalles);
};

const buscarIndiceTalle = (articulo, talle) => {
    const talleKey = claveTalle(talle);
    return articulo.talles.findIndex((item) => claveTalle(item.talle) === talleKey);
};

const normalizarComposicionTalle = (composicion, composicionActual = []) => {
    if (composicion === undefined) {
        return Array.isArray(composicionActual) ? composicionActual : [];
    }

    if (!Array.isArray(composicion)) {
        throw new Error('La composicion del talle debe ser un arreglo');
    }

    return composicion.map((item) => {
        const articulo = item?.articulo ? String(item.articulo).trim() : '';
        const talle = item?.talle ? String(item.talle).trim() : '';
        const cantidad = Number(item?.cantidad ?? 1);
        const coste = parsearCoste(item?.coste ?? item?.costo ?? 0);

        if (!articulo) {
            throw new Error('Cada item de composicion debe incluir articulo');
        }

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error('Cada item de composicion debe incluir cantidad mayor a 0');
        }

        return { articulo, talle, cantidad, coste };
    });
};

const normalizarTalles = (talles, tallesActuales = [], opciones = {}) => {
    if (talles === undefined) {
        return undefined;
    }

    if (!Array.isArray(talles)) {
        throw new Error('El campo talles debe ser un arreglo');
    }

    const stockActualPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), Number(item.stock || 0)])
    );
    const artCompuestoPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), Boolean(item.artCompuesto)])
    );
    const composicionPorTalle = new Map(
        tallesActuales.map((item) => [String(item.talle || '').trim().toUpperCase(), item.composicion || []])
    );

    return talles.map((item) => {
        const talle = item?.talle?.toString().trim();
        const talleKey = claveTalle(talle);

        const costeRaw = item?.coste ?? item?.costo;

        if (costeRaw === undefined || costeRaw === '') {
            throw new Error(opciones.itemProveedor
                ? 'El costo es obligatorio para articulos de proveedor'
                : 'Cada fila de talle debe incluir precio y costo'
            );
        }

        if (!opciones.itemProveedor && item?.precio === undefined) {
            throw new Error('Cada fila de talle debe incluir precio y costo');
        }

        const precio = item?.precio === undefined || item?.precio === ''
            ? 0
            : parsearPrecio(item.precio);
        const coste = parsearCoste(costeRaw);
        if (!opciones.itemProveedor && coste > precio) {
            throw new Error(`El coste no puede ser mayor al precio en el talle ${talle || 'sin talle'}`);
        }
        const stock = item?.stock !== undefined
            ? parsearStock(item.stock)
            : (stockActualPorTalle.get(talleKey) ?? 0);
        const artCompuesto = item?.artCompuesto !== undefined
            ? Boolean(item.artCompuesto)
            : (artCompuestoPorTalle.get(talleKey) ?? false);
        const composicion = normalizarComposicionTalle(
            item?.composicion,
            composicionPorTalle.get(talleKey) ?? []
        );

        if (artCompuesto && !composicion.length) {
            throw new Error(`El talle ${talle || 'sin talle'} es compuesto y debe incluir composicion`);
        }

        return {
            talle,
            precio,
            coste,
            artCompuesto,
            composicion: artCompuesto ? composicion : [],
            stock
        };
    });
};

const validarTallesEliminados = (tallesActuales = [], tallesNuevos = []) => {
    const tallesNuevosMap = new Set(tallesNuevos.map((item) => claveTalle(item.talle)));

    for (const talleActual of tallesActuales) {
        const talleKey = claveTalle(talleActual.talle);
        const sigueExistiendo = tallesNuevosMap.has(talleKey);
        const tieneStock = Number(talleActual.stock || 0) > 0;

        if (!sigueExistiendo && tieneStock) {
            throw new Error(
                `No se puede eliminar el talle ${talleActual.talle} porque tiene stock`
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

const validarItemProveedorDuplicadoConStock = async ({ codigoArticulo, nombre, idExcluir = null }) => {
    const condiciones = [];

    if (codigoArticulo) {
        condiciones.push({ codigoArticulo });
    }

    if (nombre && nombre.trim()) {
        condiciones.push({ nombre: new RegExp(`^${nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }

    if (!condiciones.length) return;

    const filtro = {
        itemProveedor: true,
        $or: condiciones
    };

    if (idExcluir) {
        filtro._id = { $ne: idExcluir };
    }

    const existentes = await Articulo.find(filtro);
    const duplicadoConStock = existentes.find((articulo) => totalStockArticulo(articulo) > 0);

    if (duplicadoConStock) {
        throw new Error('Ya existe un articulo de proveedor con ese codigo o nombre y stock cargado');
    }
};

const descontarStockComponentes = async (talles = []) => {
    const descuentos = new Map();

    for (const talle of talles) {
        if (!talle.artCompuesto) continue;

        const stockCompuesto = Number(talle.stock || 0);
        if (stockCompuesto <= 0) continue;

        for (const componente of talle.composicion || []) {
            const cantidadADescontar = stockCompuesto * Number(componente.cantidad || 0);
            if (cantidadADescontar <= 0) continue;

            const articuloId = String(componente.articulo);
            if (!descuentos.has(articuloId)) {
                descuentos.set(articuloId, new Map());
            }

            const descuentosPorTalle = descuentos.get(articuloId);
            const talleComponente = claveTalle(componente.talle);
            descuentosPorTalle.set(
                talleComponente,
                (descuentosPorTalle.get(talleComponente) || 0) + cantidadADescontar
            );
        }
    }

    const componentesAActualizar = [];

    for (const [articuloId, descuentosPorTalle] of descuentos.entries()) {
        const componente = await Articulo.findById(articuloId);
        if (!componente) {
            throw new Error('Articulo de composicion no encontrado');
        }

        if (!Array.isArray(componente.talles) || !componente.talles.length) {
            throw new Error(`El articulo ${componente.nombre} no tiene talles configurados`);
        }

        for (const [talleKey, cantidadADescontar] of descuentosPorTalle.entries()) {
            let indiceTalle = -1;

            if (talleKey) {
                indiceTalle = buscarIndiceTalle(componente, talleKey);
                if (indiceTalle === -1) {
                    throw new Error(`El talle ${talleKey} no existe en el articulo ${componente.nombre}`);
                }
            } else if (componente.talles.length === 1) {
                indiceTalle = 0;
            } else {
                throw new Error(`Debe indicar talle para el componente ${componente.nombre}`);
            }

            const stockActual = Number(componente.talles[indiceTalle].stock || 0);
            const stockFinal = stockActual - cantidadADescontar;
            if (stockFinal < 0) {
                throw new Error(`Stock insuficiente para el componente ${componente.nombre}`);
            }

            componente.talles[indiceTalle].stock = stockFinal;
        }

        componentesAActualizar.push(componente);
    }

    for (const componente of componentesAActualizar) {
        await componente.save();
    }
};

const obtenerDescuentosPorAumentoStockCompuesto = (tallesActuales = [], tallesNuevos = []) => {
    const actualesPorTalle = new Map(
        tallesActuales.map((item) => [claveTalle(item.talle), item])
    );

    return tallesNuevos
        .map((talleNuevo) => {
            if (!talleNuevo.artCompuesto) return null;

            const talleActual = actualesPorTalle.get(claveTalle(talleNuevo.talle));
            const stockActual = Number(talleActual?.stock || 0);
            const stockNuevo = Number(talleNuevo.stock || 0);
            const aumentoStock = stockNuevo - stockActual;

            if (aumentoStock <= 0) return null;

            return {
                ...talleNuevo,
                stock: aumentoStock
            };
        })
        .filter(Boolean);
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
    const { nombre, categoria, descripcion, talles, itemProveedor } = req.body;
    const codigoArticulo = normalizarCodigoArticulo(req.body.codigoArticulo ?? req.body.codigo);

    try {
        const ultimoCostoCompra = req.body.ultimoCostoCompra !== undefined
            ? parsearCoste(req.body.ultimoCostoCompra, 'Ultimo costo de compra invalido')
            : 0;

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ msg: 'El nombre es obligatorio' });
        }

        if (!codigoArticulo) {
            return res.status(400).json({ msg: 'El codigoArticulo es obligatorio' });
        }

        const esItemProveedor = Boolean(itemProveedor);

        if (esItemProveedor) {
            await validarItemProveedorDuplicadoConStock({ codigoArticulo, nombre });
        }

        const articuloExistente = await Articulo.findOne({ codigoArticulo });
        if (articuloExistente) {
            return res.status(400).json({ msg: 'Ya existe un articulo con ese codigoArticulo' });
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

        const tallesNormalizados = normalizarTalles(talles, [], { itemProveedor: esItemProveedor }) ?? [];
        validarTallesDuplicados(tallesNormalizados);
        const stockProveedor = esItemProveedor
            ? Number(tallesNormalizados[0]?.stock || req.body.stock || 0)
            : 0;

        const nuevoArticulo = new Articulo({
            nombre,
            codigoArticulo,
            categoria: categoriaDB._id,
            descripcion,
            itemProveedor: esItemProveedor,
            stock: stockProveedor,
            ultimoCostoCompra,
            talles: tallesNormalizados
        });

        await descontarStockComponentes(tallesNormalizados);
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
    const { nombre, descripcion, categoria, talles, itemProveedor } = req.body;

    try {
        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo no encontrado' });
        }

        const esItemProveedor = itemProveedor !== undefined
            ? Boolean(itemProveedor)
            : Boolean(articulo.itemProveedor);
        const nombreFinal = nombre ?? articulo.nombre;

        articulo.nombre = nombreFinal;
        articulo.descripcion = descripcion ?? articulo.descripcion;
        if (itemProveedor !== undefined) {
            articulo.itemProveedor = esItemProveedor;
        }

        if (req.body.ultimoCostoCompra !== undefined) {
            articulo.ultimoCostoCompra = parsearCoste(
                req.body.ultimoCostoCompra,
                'Ultimo costo de compra invalido'
            );
        }

        if (req.body.codigoArticulo !== undefined || req.body.codigo !== undefined) {
            const codigoArticulo = normalizarCodigoArticulo(req.body.codigoArticulo ?? req.body.codigo);
            if (!codigoArticulo) {
                return res.status(400).json({ msg: 'El codigoArticulo no puede estar vacio' });
            }

            if (esItemProveedor) {
                await validarItemProveedorDuplicadoConStock({
                    codigoArticulo,
                    nombre: nombreFinal,
                    idExcluir: articulo._id
                });
            }

            const articuloExistente = await Articulo.findOne({
                codigoArticulo,
                _id: { $ne: articulo._id }
            });

            if (articuloExistente) {
                return res.status(400).json({ msg: 'Ya existe un articulo con ese codigoArticulo' });
            }

            articulo.codigoArticulo = codigoArticulo;
        }

        if (esItemProveedor && !(req.body.codigoArticulo !== undefined || req.body.codigo !== undefined)) {
            await validarItemProveedorDuplicadoConStock({
                codigoArticulo: articulo.codigoArticulo,
                nombre: nombreFinal,
                idExcluir: articulo._id
            });
        }

        if (talles !== undefined) {
            const tallesNormalizados = normalizarTalles(talles, articulo.talles, { itemProveedor: esItemProveedor });
            validarTallesDuplicados(tallesNormalizados);
            validarTallesEliminados(articulo.talles, tallesNormalizados);
            const descuentosComponentes = obtenerDescuentosPorAumentoStockCompuesto(articulo.talles, tallesNormalizados);
            await descontarStockComponentes(descuentosComponentes);
            articulo.talles = tallesNormalizados;

            if (esItemProveedor) {
                articulo.stock = Number(tallesNormalizados[0]?.stock || 0);
            }
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
    const { stock, talle, anotaciones, coste, tienda, colaborador } = req.body;

    try {
        if (stock === undefined) {
            return res.status(400).json({ msg: 'Debe enviar el campo stock' });
        }

        const nuevoStock = parsearStock(stock);

        const articulo = await Articulo.findById(id);
        if (!articulo) {
            return res.status(404).json({ msg: 'Articulo no encontrado' });
        }

        const tieneTalles = Array.isArray(articulo.talles) && articulo.talles.length;
        if (!tieneTalles && !articulo.itemProveedor) {
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

            if (articulo.talles[indiceTalle].artCompuesto && ajuste > 0) {
                await descontarStockComponentes([
                    {
                        ...articulo.talles[indiceTalle].toObject(),
                        stock: ajuste
                    }
                ]);
            }
        } else if (articulo.itemProveedor || !tieneTalles || articulo.talles.length === 1) {
            const stockAnterior = Number(articulo.stock || articulo.talles?.[0]?.stock || 0);
            articulo.stock = nuevoStock;

            if (tieneTalles && articulo.talles.length === 1) {
                articulo.talles[0].stock = nuevoStock;
                talleMovimiento = articulo.talles[0].talle || '';
            }

            ajuste = nuevoStock - stockAnterior;
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
        const { desde, hasta, colaborador, limit = 500 } = req.query;

        const filtros = {};
        if (desde || hasta) {
            filtros.fecha = {};
            if (desde) filtros.fecha.$gte = new Date(`${desde}T00:00:00`);
            if (hasta) filtros.fecha.$lte = new Date(`${hasta}T23:59:59`);
        }

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
            motivo: m.motivo || '',
            ajuste: m.ajuste,
            stockFinal: m.stockFinal,
            anotaciones: m.anotaciones || ''
        }));

        return res.status(200).json({ movimientos: data });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener historial de inventario', error: error.message });
    }
};

const getCosteTalle = (talle) => {
    const coste = Number(talle?.coste ?? talle?.costo ?? 0);
    return Number.isFinite(coste) && coste >= 0 ? coste : 0;
};

const getPrecioTalle = (talle) => {
    const precio = Number(talle?.precio);
    return Number.isFinite(precio) && precio >= 0 ? precio : null;
};

const obtenerValoracionInventario = async (req, res) => {
    try {
        const fechaCorte = req.query.fecha
            ? new Date(`${String(req.query.fecha).slice(0, 10)}T23:59:59`)
            : new Date();

        if (Number.isNaN(fechaCorte.getTime())) {
            return res.status(400).json({ msg: 'Fecha de valoracion invalida' });
        }

        const articulos = await Articulo.find().populate('categoria', 'nombre').lean();
        const movimientos = await MovimientoInventario.find({ fecha: { $lte: fechaCorte } })
            .sort({ fecha: 1, createdAt: 1 })
            .lean();

        const ultimoMovimientoPorArticuloTalle = new Map();
        movimientos.forEach((movimiento) => {
            const articuloId = String(movimiento.articulo || '');
            const talleKey = claveTalle(movimiento.talle);
            if (!articuloId) return;
            ultimoMovimientoPorArticuloTalle.set(`${articuloId}::${talleKey}`, movimiento);
        });

        let fallbackStockActual = 0;

        const rows = articulos.map((articulo) => {
            const talles = Array.isArray(articulo.talles) && articulo.talles.length
                ? articulo.talles
                : [{
                    talle: '',
                    stock: articulo.stock || 0,
                    coste: articulo.coste ?? articulo.costo ?? 0,
                    precio: articulo.precio
                }];

            let stock = 0;
            let valorInventario = 0;
            let valorVenta = 0;
            let unidadesConFallback = 0;

            talles.forEach((talle) => {
                const talleKey = claveTalle(talle.talle);
                const movimiento = ultimoMovimientoPorArticuloTalle.get(`${articulo._id}::${talleKey}`);
                const stockHistorico = movimiento
                    ? Number(movimiento.stockFinal || 0)
                    : Number(talle.stock ?? articulo.stock ?? 0);

                if (!movimiento) {
                    unidadesConFallback += Math.max(0, stockHistorico);
                }

                const stockValorizable = Math.max(0, stockHistorico);
                const coste = getCosteTalle(talle);
                const precio = getPrecioTalle(talle);

                stock += stockHistorico;
                valorInventario += stockValorizable * coste;
                if (precio !== null) {
                    valorVenta += stockValorizable * precio;
                }
            });

            fallbackStockActual += unidadesConFallback;

            const costePromedio = stock > 0 ? valorInventario / stock : 0;
            const precioPromedio = stock > 0 && valorVenta > 0 ? valorVenta / stock : null;
            const beneficioPotencial = valorVenta > 0 ? valorVenta - valorInventario : 0;
            const margen = valorVenta > 0 ? (beneficioPotencial / valorVenta) * 100 : null;

            return {
                id: articulo._id,
                nombre: articulo.nombre || 'Sin nombre',
                categoria: articulo.categoria?.nombre || 'Sin categoria',
                itemProveedor: Boolean(articulo.itemProveedor),
                stock,
                coste: costePromedio,
                precio: precioPromedio,
                valorInventario,
                valorVenta,
                beneficioPotencial,
                margen,
                usaStockActualFallback: unidadesConFallback > 0
            };
        }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

        const resumen = rows.reduce((acc, row) => {
            acc.valorInventarioTotal += Number(row.valorInventario || 0);
            acc.valorVentaTotal += Number(row.valorVenta || 0);
            acc.beneficioPotencial += Number(row.beneficioPotencial || 0);
            acc.stockTotal += Number(row.stock || 0);
            if (row.usaStockActualFallback) acc.articulosConFallback += 1;
            return acc;
        }, {
            valorInventarioTotal: 0,
            valorVentaTotal: 0,
            beneficioPotencial: 0,
            stockTotal: 0,
            articulosConFallback: 0
        });

        return res.status(200).json({
            fecha: fechaCorte,
            rows,
            resumen: {
                ...resumen,
                margenTotal: resumen.valorVentaTotal > 0
                    ? (resumen.beneficioPotencial / resumen.valorVentaTotal) * 100
                    : 0,
                fallbackStockActual
            }
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener valoracion de inventario', error: error.message });
    }
};


module.exports = {
    traerArticulos,
    traerArticulo,
    crearArticulo,
    modificarArticulo,
    eliminarArticulo,
    modificarStockArticulo,
    obtenerHistorialInventario,
    obtenerValoracionInventario
};
