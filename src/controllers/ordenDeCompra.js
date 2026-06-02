const OrdenCompra = require('../models/ordenDeCompra');
const Articulo = require('../models/articulo');
const Secuencia = require('../models/secuencia');

// Flujo principal:
// DEUDOR -> PAGADA
const crearHttpError = (msg, status = 400) => {
    const error = new Error(msg);
    error.status = status;
    return error;
};

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
const obtenerTalleArticulo = (articulo, talle) => {
    const talleNormalizado = normalizarTalle(talle);
    return articulo.talles.find((item) => normalizarTalle(item.talle) === talleNormalizado) || null;
};

const asegurarTalleUnicoArticulo = (articulo) => {
    if (!Array.isArray(articulo.talles)) {
        articulo.talles = [];
    }

    let talleArticulo = obtenerTalleArticulo(articulo, '');
    if (!talleArticulo && articulo.talles.length === 0) {
        articulo.talles.push({
            talle: '',
            precio: 0,
            coste: Number(articulo.ultimoCostoCompra ?? articulo.coste ?? articulo.costo ?? 0),
            stock: Number(articulo.stock || 0)
        });
        talleArticulo = articulo.talles[articulo.talles.length - 1];
    }

    return talleArticulo;
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

        const articulo = await Articulo.findById(item.articulo).session(session);
        if (!articulo) continue;

        articulo.ultimoCostoCompra = ultimoCostoCompra;
        articulo.coste = ultimoCostoCompra;
        articulo.costo = ultimoCostoCompra;

        const talleArticulo = obtenerTalleArticulo(articulo, item.talle) || asegurarTalleUnicoArticulo(articulo);
        if (talleArticulo) {
            talleArticulo.coste = ultimoCostoCompra;
        }

        await guardarArticulo(articulo, session);
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
        const talleArticulo = asegurarTalleUnicoArticulo(articulo);
        if (talleArticulo && articulo.talles.length === 1) {
            talleArticulo.stock = nuevoStock;
        }
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

const incorporarStockItemsOrden = async (items = [], session = null) => {
    for (const item of items) {
        const cantidad = Number(item.cantidad || 0);
        if (cantidad <= 0) continue;

        await ajustarArticuloPorItem(item, session, { stockDelta: cantidad });
        item.cantidadStockAplicada = cantidad;
    }
};

const revertirStockIncorporadoItemsOrden = async (items = [], session = null) => {
    for (const item of items) {
        const cantidadStockAplicada = Number(item.cantidadStockAplicada ?? item.cantidadRecibida ?? 0);
        if (cantidadStockAplicada <= 0) continue;

        await ajustarArticuloPorItem(item, session, { stockDelta: -cantidadStockAplicada });
    }
};

const obtenerSiguienteNumeroOrden = async (session = null) => {
    const ordenes = await OrdenCompra.find()
        .select('numero')
        .session(session)
        .lean();
    const ultimoNumero = ordenes.reduce((maximo, orden) => {
        const numero = Number(orden.numero || 0);
        return Number.isFinite(numero) && numero > maximo ? numero : maximo;
    }, 0);

    await Secuencia.updateOne(
        { clave: 'ordenCompra' },
        { $max: { valor: ultimoNumero } },
        { upsert: true, session }
    );

    const secuencia = await Secuencia.findOneAndUpdate(
        { clave: 'ordenCompra' },
        { $inc: { valor: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
            session
        }
    );

    return secuencia.valor;
};

const procesarItemsOrden = async (items = [], session = null) => {
    let totalOrden = 0;

    const itemsProcesados = [];
    for (const item of items) {
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

            itemsProcesados.push({
                articulo: articulo._id,
                talle: '',
                stockActual,
                cantidad: item.cantidad,
                cantidadStockAplicada: 0,
                coste: costeItem,
                costoTotal
            });
            continue;
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

        itemsProcesados.push({
            articulo: articulo._id,
            talle: talleNormalizado,
            stockActual,
            cantidad: item.cantidad,
            cantidadStockAplicada: 0,
            coste: costeItem,
            costoTotal
        });
    }

    return { itemsProcesados, totalOrden };
};

const construirPayloadOrden = async (data = {}, session = null) => {
    const {
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
            proveedor,
            fechaOrden,
            anotaciones,
            estadoFinal,
            itemsProcesados,
            totalOrden
        } = await construirPayloadOrden(req.body, session);
        const numero = await obtenerSiguienteNumeroOrden(session);

        const orden = new OrdenCompra({
            numero,
            proveedor: proveedor || undefined,
            fechaOrden,
            anotaciones,
            estado: estadoFinal,
            items: itemsProcesados,
            totalOrden
        });

        await incorporarStockItemsOrden(itemsProcesados, session);
        await actualizarUltimosCostosCompra(itemsProcesados, session);
        orden.items = itemsProcesados;
        await orden.save({ session });

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

        const {
            proveedor,
            fechaOrden,
            anotaciones,
            estadoFinal,
            itemsProcesados,
            totalOrden
        } = await construirPayloadOrden(
            {
                ...req.body,
                estado: req.body?.estado || orden.estado
            },
            session
        );

        await revertirStockIncorporadoItemsOrden(orden.items, session);
        await incorporarStockItemsOrden(itemsProcesados, session);

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
            limit,
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

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Number(limit);
        const usaPaginacion = Number.isFinite(limitNumber) && limitNumber > 0;
        const ordenesQuery = OrdenCompra.find(filtros)
            .populate('proveedor', 'nombre apellido razonSocial numeroCliente numeroProveedor')
            .populate('items.articulo', 'nombre codigoArticulo')
            .sort({ createdAt: -1 });

        if (usaPaginacion) {
            ordenesQuery
                .skip((pageNumber - 1) * limitNumber)
                .limit(limitNumber);
        }

        const [total, ordenes] = await Promise.all([
            OrdenCompra.countDocuments(filtros),
            ordenesQuery
        ]);

        res.json({
            total,
            page: pageNumber,
            totalPages: usaPaginacion ? Math.ceil(total / limitNumber) : 1,
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
            const cantidadStockAplicada = Number(item.cantidadStockAplicada ?? item.cantidadRecibida ?? 0);
            if (cantidadStockAplicada > 0) {
                await ajustarArticuloPorItem(item, session, {
                    stockDelta: -cantidadStockAplicada
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
    actualizarEstadoOrdenCompra,
    cancelarOrdenCompra,
    eliminarOrdenCompra
};
