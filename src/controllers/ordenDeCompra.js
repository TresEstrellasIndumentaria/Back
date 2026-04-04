const OrdenCompra = require('../models/ordenDeCompra');
const Articulo = require('../models/articulo');

// Flujo principal:
// BORRADOR -> ENVIADA -> PARCIALMENTE_RECIBIDA -> RECIBIDA
// BORRADOR -> CANCELADA
const crearHttpError = (msg, status = 400) => {
    const error = new Error(msg);
    error.status = status;
    return error;
};

const ESTADO_PARCIAL = 'PARCIALMENTE_RECIBIDA';
const ESTADOS_PARA_RECIBIR = ['ENVIADA', ESTADO_PARCIAL];
const normalizarTalle = (talle) => String(talle || '').trim().toUpperCase();
const claveItemOrden = (articulo, talle = '') => `${String(articulo)}::${normalizarTalle(talle)}`;

const pendienteItem = (item) => {
    const recibido = Number(item.cantidadRecibida || 0);
    return Math.max(0, Number(item.cantidad || 0) - recibido);
};

const obtenerTalleArticulo = (articulo, talle) => {
    const talleNormalizado = normalizarTalle(talle);
    return articulo.talles.find((item) => normalizarTalle(item.talle) === talleNormalizado) || null;
};

const obtenerCosteItem = (articulo, talleArticulo, item) => {
    if (item?.coste !== undefined && item?.coste !== null && item?.coste !== '') {
        return Number(item.coste);
    }

    if (talleArticulo) {
        return Number(talleArticulo.coste || 0);
    }

    return 0;
};

const guardarArticulo = async (articulo, session = null) => articulo.save({ session });

const ajustarArticuloPorItem = async (item, session, { stockDelta = 0, entrantesDelta = 0 } = {}) => {
    const articulo = await Articulo.findById(item.articulo).session(session);

    if (!articulo) {
        throw crearHttpError('Articulo no encontrado', 404);
    }

    const talleNormalizado = normalizarTalle(item.talle);
    const usaTalles = Array.isArray(articulo.talles) && articulo.talles.length > 0;

    if (!usaTalles) {
        throw crearHttpError('El articulo no tiene talles configurados');
    }

    if (!talleNormalizado) {
        throw crearHttpError('El articulo requiere talle en la orden');
    }

    const talleArticulo = obtenerTalleArticulo(articulo, talleNormalizado);
    if (!talleArticulo) {
        throw crearHttpError('El talle indicado no existe en el articulo');
    }

    const nuevoStock = Number(talleArticulo.stock || 0) + Number(stockDelta || 0);
    const nuevosEntrantes = Number(talleArticulo.entrantes || 0) + Number(entrantesDelta || 0);
    if (nuevoStock < 0 || nuevosEntrantes < 0) {
        throw crearHttpError('El ajuste deja stock o entrantes negativos para el talle');
    }

    talleArticulo.stock = nuevoStock;
    talleArticulo.entrantes = nuevosEntrantes;
    await guardarArticulo(articulo, session);
};

const construirMapaRecepcion = (recepciones = []) => {
    if (!recepciones?.length) return null;

    const mapa = new Map();
    for (const recepcion of recepciones) {
        const articulo = recepcion?.articulo;
        const cantidad = Number(recepcion?.cantidad);
        if (!articulo || !Number.isFinite(cantidad) || cantidad <= 0) {
            throw crearHttpError('Cada recepcion parcial debe tener articulo y cantidad > 0');
        }

        const key = claveItemOrden(articulo, recepcion?.talle);
        mapa.set(key, (mapa.get(key) || 0) + cantidad);
    }

    return mapa;
};

const aplicarRecepcionOrden = async (orden, session, recepciones = null) => {
    if (orden.estado === 'RECIBIDA') {
        return false;
    }

    if (!ESTADOS_PARA_RECIBIR.includes(orden.estado)) {
        throw crearHttpError('La orden no esta en estado recibible');
    }

    const recepcionMap = construirMapaRecepcion(recepciones);
    const pendientesPorArticulo = new Map();
    for (const item of orden.items) {
        const key = claveItemOrden(item.articulo, item.talle);
        pendientesPorArticulo.set(key, (pendientesPorArticulo.get(key) || 0) + pendienteItem(item));
    }

    if (recepcionMap) {
        for (const [itemKey, cantidad] of recepcionMap.entries()) {
            const pendiente = pendientesPorArticulo.get(itemKey) || 0;
            if (!pendiente) {
                throw crearHttpError('El articulo/talle indicado no tiene pendiente en la orden');
            }
            if (cantidad > pendiente) {
                throw crearHttpError('La cantidad a recibir no puede superar lo pendiente');
            }
        }
    }

    let totalRecibido = 0;
    for (const item of orden.items) {
        const pendiente = pendienteItem(item);
        if (pendiente <= 0) continue;

        let cantidadARecibir = pendiente;
        if (recepcionMap) {
            const key = claveItemOrden(item.articulo, item.talle);
            const restanteSolicitado = recepcionMap.get(key) || 0;
            if (restanteSolicitado <= 0) continue;
            cantidadARecibir = Math.min(pendiente, restanteSolicitado);
            recepcionMap.set(key, restanteSolicitado - cantidadARecibir);
        }

        if (cantidadARecibir <= 0) continue;

        await ajustarArticuloPorItem(item, session, {
            stockDelta: cantidadARecibir,
            entrantesDelta: -cantidadARecibir
        });

        item.cantidadRecibida = Number(item.cantidadRecibida || 0) + cantidadARecibir;
        totalRecibido += cantidadARecibir;
    }

    if (totalRecibido === 0) {
        throw crearHttpError('No hay cantidades pendientes para recibir con los datos enviados');
    }

    const quedanPendientes = orden.items.some((item) => pendienteItem(item) > 0);
    orden.estado = quedanPendientes ? ESTADO_PARCIAL : 'RECIBIDA';
    await orden.save({ session });
    return true;
};

const procesarItemsOrden = async (items = [], session = null) => {
    let totalOrden = 0;

    const itemsProcesados = await Promise.all(
        items.map(async (item) => {
            if (!item?.articulo || !item?.cantidad) {
                throw crearHttpError('Cada item debe tener articulo y cantidad');
            }

            const articuloQuery = Articulo.findById(item.articulo);
            const articulo = session ? await articuloQuery.session(session) : await articuloQuery;

            if (!articulo) {
                throw crearHttpError('Articulo no encontrado');
            }

            const talleNormalizado = normalizarTalle(item.talle);
            const usaTalles = Array.isArray(articulo.talles) && articulo.talles.length > 0;

            if (!usaTalles) {
                throw crearHttpError('El articulo no tiene talles configurados');
            }

            if (!talleNormalizado) {
                throw crearHttpError('Debe indicar talle para articulos que manejan talles');
            }

            const talleArticulo = obtenerTalleArticulo(articulo, talleNormalizado);
            if (!talleArticulo) {
                throw crearHttpError('El talle indicado no existe en el articulo');
            }

            const stockActual = Number(talleArticulo.stock || 0);
            const entrantes = Number(talleArticulo.entrantes || 0);

            const costeItem = obtenerCosteItem(articulo, talleArticulo, item);
            if (!Number.isFinite(costeItem) || costeItem < 0) {
                throw crearHttpError('Coste invalido para el item');
            }

            const costoTotal = item.cantidad * costeItem;
            totalOrden += costoTotal;

            return {
                articulo: articulo._id,
                talle: talleNormalizado,
                stockActual,
                entrantes,
                cantidad: item.cantidad,
                cantidadRecibida: 0,
                coste: costeItem,
                costoTotal
            };
        })
    );

    return { itemsProcesados, totalOrden };
};

// Crear orden (BORRADOR o ENVIADA)
const crearOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const {
            proveedor,
            esperadoPara,
            fechaEsperada,
            anotaciones,
            items = [],
            estado,
            guardarComoBorrador
        } = req.body;

        if (!Array.isArray(items)) {
            throw crearHttpError('items debe ser un arreglo');
        }

        let estadoFinal = 'BORRADOR';
        if (typeof guardarComoBorrador === 'boolean') {
            estadoFinal = guardarComoBorrador ? 'BORRADOR' : 'ENVIADA';
        } else if (estado) {
            estadoFinal = String(estado).toUpperCase();
        }

        if (!['BORRADOR', 'ENVIADA'].includes(estadoFinal)) {
            throw crearHttpError('Estado invalido. Use BORRADOR o ENVIADA');
        }

        if (estadoFinal === 'ENVIADA') {
            if (!proveedor) {
                throw crearHttpError('Para ENVIADA debe informar proveedor');
            }
            if (!items.length) {
                throw crearHttpError('Para ENVIADA debe informar al menos un item');
            }
        }

        const { itemsProcesados, totalOrden } = await procesarItemsOrden(items, session);

        const orden = new OrdenCompra({
            proveedor: proveedor || undefined,
            esperadoPara: esperadoPara || fechaEsperada,
            fechaEsperada: fechaEsperada || esperadoPara,
            anotaciones,
            estado: estadoFinal,
            items: itemsProcesados,
            totalOrden
        });

        await orden.save({ session });

        // Si se guarda directamente ENVIADA, impacta entrantes.
        if (estadoFinal === 'ENVIADA') {
            for (const item of itemsProcesados) {
                await ajustarArticuloPorItem(item, session, { entrantesDelta: item.cantidad });
            }
        }

        await session.commitTransaction();

        const ordenGuardada = await OrdenCompra.findById(orden._id)
            .populate('proveedor', 'nombre razonSocial')
            .populate('items.articulo', 'nombre talles');

        res.status(201).json(ordenGuardada);
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

// Obtener todas - filtros por estado y fechas
const obtenerOrdenesCompra = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            estado,
            proveedor,
            desde,
            hasta
        } = req.query;

        const filtros = {};

        if (estado) filtros.estado = estado;
        if (proveedor) filtros.proveedor = proveedor;

        if (desde || hasta) {
            filtros.createdAt = {};
            if (desde) filtros.createdAt.$gte = new Date(desde);
            if (hasta) filtros.createdAt.$lte = new Date(hasta);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [total, ordenes] = await Promise.all([
            OrdenCompra.countDocuments(filtros),
            OrdenCompra.find(filtros)
                .populate('proveedor', 'nombre razonSocial')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
        ]);

        res.json({
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            ordenes
        });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Obtener por ID
const obtenerOrdenCompraPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const orden = await OrdenCompra.findById(id)
            .populate('proveedor')
            .populate('items.articulo', 'nombre talles');

        if (!orden) {
            return res.status(404).json({ msg: 'Orden no encontrada' });
        }

        res.json(orden);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Obtener por proveedor
const obtenerOrdenesPorProveedor = async (req, res) => {
    try {
        const { proveedorId } = req.params;

        const ordenes = await OrdenCompra.find({ proveedor: proveedorId })
            .populate('proveedor', 'nombre apellido')
            .sort({ createdAt: -1 });

        res.json(ordenes);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Enviar orden -> CAMBIAR ESTADO, SUMAR ENTRANTES
const enviarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const orden = await OrdenCompra.findById(id).session(session);
        if (!orden) throw crearHttpError('Orden no encontrada', 404);

        if (orden.estado !== 'BORRADOR') {
            throw crearHttpError('La orden no esta en BORRADOR');
        }

        if (!orden.proveedor || !orden.items?.length) {
            throw crearHttpError('No se puede enviar: faltan proveedor o items');
        }

        for (const item of orden.items) {
            await ajustarArticuloPorItem(item, session, { entrantesDelta: item.cantidad });
        }

        orden.estado = 'ENVIADA';
        await orden.save({ session });

        await session.commitTransaction();
        res.json({ msg: 'Orden enviada', orden });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

// Recibir total o parcial -> mueve entrantes a stock
const recibirOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const recepciones = Array.isArray(req.body?.items) ? req.body.items : null;

        const orden = await OrdenCompra.findById(id).session(session);
        if (!orden) throw crearHttpError('Orden no encontrada', 404);
        const cambioRealizado = await aplicarRecepcionOrden(orden, session, recepciones);

        await session.commitTransaction();
        res.json({
            msg: cambioRealizado ? `Recepcion registrada. Estado: ${orden.estado}` : 'La orden ya estaba recibida',
            orden
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

const actualizarEstadoOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const estadoObjetivo = String(req.body?.estado || '').toUpperCase();

        if (!estadoObjetivo) {
            throw crearHttpError('Debe enviar estado');
        }

        const orden = await OrdenCompra.findById(id).session(session);
        if (!orden) throw crearHttpError('Orden no encontrada', 404);

        if (estadoObjetivo === 'RECIBIDA') {
            const cambioRealizado = await aplicarRecepcionOrden(orden, session);
            await session.commitTransaction();
            return res.json({
                msg: cambioRealizado ? `Estado actualizado a ${orden.estado}` : 'La orden ya estaba recibida',
                orden
            });
        }

        throw crearHttpError('Estado no soportado en este endpoint');
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

// Cancelar orden -> rollback de entrantes si estaba ENVIADA
const cancelarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const orden = await OrdenCompra.findById(id).session(session);

        if (!orden) throw crearHttpError('Orden no encontrada', 404);
        if (orden.estado === 'RECIBIDA') {
            throw crearHttpError('No se puede cancelar una orden recibida');
        }

        if (orden.estado === 'ENVIADA' || orden.estado === ESTADO_PARCIAL) {
            for (const item of orden.items) {
                const pendiente = pendienteItem(item);
                if (pendiente <= 0) continue;
                await ajustarArticuloPorItem(item, session, { entrantesDelta: -pendiente });
            }
        }

        orden.estado = 'CANCELADA';
        await orden.save({ session });

        await session.commitTransaction();
        res.json({ msg: 'Orden cancelada', orden });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = {
    crearOrdenCompra,
    obtenerOrdenesCompra,
    obtenerOrdenCompraPorId,
    obtenerOrdenesPorProveedor,
    enviarOrdenCompra,
    recibirOrdenCompra,
    actualizarEstadoOrdenCompra,
    cancelarOrdenCompra
};
