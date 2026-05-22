const OrdenCompra = require('../models/ordenDeCompra');
const Articulo = require('../models/articulo');

// Flujo principal:
// DEUDOR -> PAGADA
const crearHttpError = (msg, status = 400) => {
    const error = new Error(msg);
    error.status = status;
    return error;
};

const ESTADOS_PARA_RECIBIR = ['DEUDOR'];
const normalizarTalle = (talle) => String(talle || '').trim().toUpperCase();
const parsearFechaOrden = (fechaOrden) => {
    if (!fechaOrden) return undefined;

    if (typeof fechaOrden === 'string') {
        const fechaLimpia = fechaOrden.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
            return new Date(`${fechaLimpia}T12:00:00.000Z`);
        }
    }

    const fecha = new Date(fechaOrden);
    if (Number.isNaN(fecha.getTime())) {
        throw crearHttpError('Fecha de orden invalida');
    }

    return fecha;
};
const articuloUsaTalles = (articulo) => (
    Array.isArray(articulo?.talles)
    && articulo.talles.some((item) => normalizarTalle(item?.talle))
);
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
    if (item?.costo !== undefined && item?.costo !== null && item?.costo !== '') {
        return Number(item.costo);
    }

    if (item?.coste !== undefined && item?.coste !== null && item?.coste !== '') {
        return Number(item.coste);
    }

    if (talleArticulo) {
        return Number(talleArticulo.coste || 0);
    }

    return 0;
};

const actualizarUltimosCostosCompra = async (items = [], session = null) => {
    for (const item of items) {
        const ultimoCostoCompra = Number(item.costo ?? item.coste ?? 0);

        if (!item.articulo || !Number.isFinite(ultimoCostoCompra) || ultimoCostoCompra < 0) {
            continue;
        }

        await Articulo.findByIdAndUpdate(
            item.articulo,
            { ultimoCostoCompra },
            { session }
        );
    }
};

const guardarArticulo = async (articulo, session = null) => articulo.save({ session });

const ajustarArticuloPorItem = async (item, session, { stockDelta = 0 } = {}) => {
    const articulo = await Articulo.findById(item.articulo).session(session);

    if (!articulo) {
        throw crearHttpError('Articulo no encontrado', 404);
    }

    const talleNormalizado = normalizarTalle(item.talle);
    const usaTalles = articuloUsaTalles(articulo);

    if (!usaTalles) {
        const nuevoStock = Number(articulo.stock || 0) + Number(stockDelta || 0);
        if (nuevoStock < 0) {
            throw crearHttpError('El ajuste deja stock negativo para el articulo');
        }

        articulo.stock = nuevoStock;
        await guardarArticulo(articulo, session);
        return;
    }

    if (!talleNormalizado) {
        throw crearHttpError('El articulo requiere talle en la orden');
    }

    const talleArticulo = obtenerTalleArticulo(articulo, talleNormalizado);
    if (!talleArticulo) {
        throw crearHttpError('El talle indicado no existe en el articulo');
    }

    const nuevoStock = Number(talleArticulo.stock || 0) + Number(stockDelta || 0);
    if (nuevoStock < 0) {
        throw crearHttpError('El ajuste deja stock negativo para el talle');
    }

    talleArticulo.stock = nuevoStock;
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
    if (orden.estado === 'PAGADA') {
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
    const itemsRecibidos = [];
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
            stockDelta: cantidadARecibir
        });

        item.cantidadRecibida = Number(item.cantidadRecibida || 0) + cantidadARecibir;
        totalRecibido += cantidadARecibir;
        itemsRecibidos.push(item);
    }

    if (totalRecibido === 0) {
        throw crearHttpError('No hay cantidades pendientes para recibir con los datos enviados');
    }

    const quedanPendientes = orden.items.some((item) => pendienteItem(item) > 0);
    orden.estado = quedanPendientes ? 'DEUDOR' : 'PAGADA';
    await actualizarUltimosCostosCompra(itemsRecibidos, session);
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
            const usaTalles = articuloUsaTalles(articulo);

            if (!usaTalles) {
                const stockActual = Number(articulo.stock || 0);
                const costeItem = obtenerCosteItem(articulo, null, item);
                if (!Number.isFinite(costeItem) || costeItem < 0) {
                    throw crearHttpError('Coste invalido para el item');
                }

                const costoTotal = item.cantidad * costeItem;
                totalOrden += costoTotal;

                return {
                    articulo: articulo._id,
                    talle: '',
                    stockActual,
                    cantidad: item.cantidad,
                    cantidadRecibida: 0,
                    coste: costeItem,
                    costoTotal
                };
            }

            if (!talleNormalizado) {
                throw crearHttpError('Debe indicar talle para articulos que manejan talles');
            }

            const talleArticulo = obtenerTalleArticulo(articulo, talleNormalizado);
            if (!talleArticulo) {
                throw crearHttpError('El talle indicado no existe en el articulo');
            }

            const stockActual = Number(talleArticulo.stock || 0);
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
                cantidad: item.cantidad,
                cantidadRecibida: 0,
                coste: costeItem,
                costoTotal
            };
        })
    );

    return { itemsProcesados, totalOrden };
};

const construirPayloadOrden = async (data = {}, session = null) => {
    const {
        numero,
        proveedor,
        fechaOrden,
        anotaciones,
        items = [],
        estado,
        guardarComoBorrador
    } = data;

    if (!Array.isArray(items)) {
        throw crearHttpError('items debe ser un arreglo');
    }

    let estadoFinal = 'DEUDOR';
    if (typeof guardarComoBorrador === 'boolean') {
        estadoFinal = 'DEUDOR';
    } else if (estado) {
        estadoFinal = String(estado).toUpperCase();
    }

    if (!['DEUDOR', 'PAGADA'].includes(estadoFinal)) {
        throw crearHttpError('Estado invalido. Use DEUDOR o PAGADA');
    }

    if (!proveedor) {
        throw crearHttpError('Debe informar proveedor');
    }
    if (!items.length) {
        throw crearHttpError('Debe informar al menos un item');
    }

    const { itemsProcesados, totalOrden } = await procesarItemsOrden(items, session);

    return {
        numero,
        proveedor,
        fechaOrden: parsearFechaOrden(fechaOrden),
        anotaciones,
        estadoFinal,
        itemsProcesados,
        totalOrden
    };
};

// Crear orden
const crearOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const {
            numero,
            proveedor,
            fechaOrden,
            anotaciones,
            estadoFinal,
            itemsProcesados,
            totalOrden
        } = await construirPayloadOrden(req.body, session);

        const orden = new OrdenCompra({
            numero,
            proveedor: proveedor || undefined,
            fechaOrden,
            anotaciones,
            estado: estadoFinal,
            items: itemsProcesados,
            totalOrden
        });

        await orden.save({ session });
        await actualizarUltimosCostosCompra(itemsProcesados, session);

        await session.commitTransaction();

        const ordenGuardada = await OrdenCompra.findById(orden._id)
            .populate('proveedor', 'nombre apellido razonSocial numeroCliente numeroProveedor')
            .populate('items.articulo', 'nombre talles');

        res.status(201).json(ordenGuardada);
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

const modificarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const orden = await OrdenCompra.findById(id).session(session);

        if (!orden) throw crearHttpError('Orden no encontrada', 404);
        if (orden.estado === 'PAGADA') {
            throw crearHttpError('No se puede modificar una orden pagada');
        }

        const tieneRecepciones = (orden.items || []).some((item) => Number(item.cantidadRecibida || 0) > 0);
        if (tieneRecepciones) {
            throw crearHttpError('No se puede modificar una orden con articulos ya recibidos');
        }

        const {
            numero,
            proveedor,
            fechaOrden,
            anotaciones,
            estadoFinal,
            itemsProcesados,
            totalOrden
        } = await construirPayloadOrden(
            {
                ...req.body,
                numero: req.body?.numero || orden.numero,
                estado: req.body?.estado || orden.estado
            },
            session
        );

        orden.numero = numero;
        orden.proveedor = proveedor;
        if (fechaOrden) orden.fechaOrden = fechaOrden;
        orden.anotaciones = anotaciones;
        orden.estado = estadoFinal;
        orden.items = itemsProcesados;
        orden.totalOrden = totalOrden;

        await orden.save({ session });
        await actualizarUltimosCostosCompra(itemsProcesados, session);
        await session.commitTransaction();

        const ordenGuardada = await OrdenCompra.findById(orden._id)
            .populate('proveedor', 'nombre apellido razonSocial numeroCliente numeroProveedor')
            .populate('items.articulo', 'nombre talles codigoArticulo');

        res.json(ordenGuardada);
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
                .populate('proveedor', 'nombre apellido razonSocial numeroCliente numeroProveedor')
                .populate('items.articulo', 'nombre codigoArticulo')
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
            .populate('proveedor', 'nombre apellido razonSocial numeroCliente numeroProveedor')
            .populate('items.articulo', 'nombre codigoArticulo')
            .sort({ createdAt: -1 });

        res.json(ordenes);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Enviar orden -> CAMBIAR ESTADO
const enviarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const orden = await OrdenCompra.findById(id).session(session);
        if (!orden) throw crearHttpError('Orden no encontrada', 404);

        if (orden.estado === 'PAGADA') {
            throw crearHttpError('La orden ya esta pagada');
        }

        orden.estado = 'DEUDOR';
        await orden.save({ session });

        await session.commitTransaction();
        res.json({ msg: 'Orden deudora', orden });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

// Recibir total o parcial -> suma stock
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

        if (['DEUDOR', 'PAGADA'].includes(estadoObjetivo)) {
            orden.estado = estadoObjetivo;
            await orden.save({ session });
            await session.commitTransaction();
            return res.json({
                msg: `Estado actualizado a ${orden.estado}`,
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

// Cancelar orden
const cancelarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const orden = await OrdenCompra.findById(id).session(session);

        if (!orden) throw crearHttpError('Orden no encontrada', 404);
        orden.estado = 'DEUDOR';
        await orden.save({ session });

        await session.commitTransaction();
        res.json({ msg: 'Orden marcada como deudora', orden });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

const eliminarOrdenCompra = async (req, res) => {
    const session = await OrdenCompra.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const orden = await OrdenCompra.findById(id).session(session);

        if (!orden) throw crearHttpError('Orden no encontrada', 404);

        for (const item of orden.items || []) {
            const cantidadRecibida = Number(item.cantidadRecibida || 0);
            if (cantidadRecibida > 0) {
                await ajustarArticuloPorItem(item, session, {
                    stockDelta: -cantidadRecibida
                });
            }
        }

        await OrdenCompra.findByIdAndDelete(id).session(session);
        await session.commitTransaction();

        res.json({
            msg: 'Orden de compra eliminada correctamente',
            idEliminado: id
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(error.status || 500).json({ msg: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = {
    crearOrdenCompra,
    modificarOrdenCompra,
    obtenerOrdenesCompra,
    obtenerOrdenCompraPorId,
    obtenerOrdenesPorProveedor,
    enviarOrdenCompra,
    recibirOrdenCompra,
    actualizarEstadoOrdenCompra,
    cancelarOrdenCompra,
    eliminarOrdenCompra
};
