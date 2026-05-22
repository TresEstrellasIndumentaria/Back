const Remito = require('../models/remito');
const Secuencia = require('../models/secuencia');
const Articulo = require('../models/articulo');
const MovimientoInventario = require('../models/movimientoInventario');
const normalizar = require('../helpers/normalizaNombreArt');
const mongoose = require('mongoose');

const ESTADOS_VALIDOS = ['PENDIENTE', 'PAGADO'];

const limpiarTexto = (valor) => {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
};

const parsearImporte = (valor, campo) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0) {
        throw new Error(`${campo} invalido. Debe ser un numero mayor o igual a 0`);
    }
    return numero;
};

const normalizarEstado = (estado) => {
    const estadoNormalizado = limpiarTexto(estado).toUpperCase();
    return estadoNormalizado || 'PENDIENTE';
};

const claveTalle = (talle) => limpiarTexto(talle).toUpperCase();

const normalizarCodigoArticulo = (codigo) => limpiarTexto(codigo).toUpperCase();

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buscarIndiceTalle = (articulo, talle) => {
    const talleKey = claveTalle(talle);
    return articulo.talles.findIndex((item) => claveTalle(item.talle) === talleKey);
};

const validarEmail = (email) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validarPedido = (pedido) => {
    if (!Array.isArray(pedido)) {
        throw new Error('pedido debe ser un arreglo');
    }

    if (!pedido.length) {
        throw new Error('Debe enviar al menos un item en el pedido');
    }

    return pedido.map((item, index) => {
        const articulo = limpiarTexto(item?.articulo ?? item?.articuloId);
        const codigoArticulo = normalizarCodigoArticulo(item?.codigoArticulo ?? item?.codigo);
        const nombreCamiseta = limpiarTexto(item?.nombreCamiseta);
        const numero = limpiarTexto(item?.numero);
        const prenda = limpiarTexto(item?.prenda);
        const talle = limpiarTexto(item?.talle);
        const cantidad = item?.cantidad === undefined ? 1 : parsearImporte(item.cantidad, `cantidad del item ${index + 1}`);
        const precioUnitarioRaw = item?.precioUnitario ?? item?.importeUnitario;
        const precioUnitario = precioUnitarioRaw === undefined ? 0 : parsearImporte(precioUnitarioRaw, `precioUnitario del item ${index + 1}`);
        const observaciones = limpiarTexto(item?.observaciones);

        if (!prenda) {
            throw new Error(`El item ${index + 1} debe incluir prenda`);
        }

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error(`La cantidad del item ${index + 1} debe ser un entero mayor a 0`);
        }

        if (articulo && !mongoose.Types.ObjectId.isValid(articulo)) {
            throw new Error(`El articulo del item ${index + 1} no es valido`);
        }

        const subtotalRaw = item?.subtotal ?? item?.importeTotal;
        const subtotal = subtotalRaw === undefined
            ? cantidad * precioUnitario
            : parsearImporte(subtotalRaw, `subtotal del item ${index + 1}`);

        return {
            ...(articulo ? { articulo } : {}),
            codigoArticulo,
            nombreCamiseta,
            numero,
            prenda,
            talle,
            cantidad,
            precioUnitario,
            subtotal,
            observaciones
        };
    });
};

const buscarArticuloParaItem = async (item, cache) => {
    const articuloId = limpiarTexto(item?.articulo ?? item?.articuloId);
    const codigoArticulo = normalizarCodigoArticulo(item?.codigoArticulo ?? item?.codigo);
    const prenda = limpiarTexto(item?.prenda);
    const cacheKey = articuloId || codigoArticulo || normalizar(prenda);

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let articulo = null;

    if (articuloId && mongoose.Types.ObjectId.isValid(articuloId)) {
        articulo = await Articulo.findById(articuloId);
    }

    if (!articulo && codigoArticulo) {
        articulo = await Articulo.findOne({ codigoArticulo });
    }

    if (!articulo && prenda) {
        articulo = await Articulo.findOne({
            nombre: { $regex: `^${escaparRegex(prenda)}$`, $options: 'i' }
        });
    }

    if (!articulo && prenda) {
        const articulos = await Articulo.find();
        const prendaNormalizada = normalizar(prenda);
        articulo = articulos.find((itemArticulo) => normalizar(itemArticulo.nombre || '') === prendaNormalizada) || null;
    }

    cache.set(cacheKey, articulo);
    return articulo;
};

const registrarMovimientoInventario = async ({
    articulo,
    talle,
    ajuste,
    stockFinal,
    coste,
    motivo,
    remito,
    colaborador,
    tienda
}) => {
    if (!ajuste) return;

    await MovimientoInventario.create({
        articulo: articulo._id,
        colaborador: colaborador || undefined,
        tienda: tienda || '',
        talle,
        motivo,
        anotaciones: remito
            ? `Remito ${remito.numeroRemitoFormateado || `R-${String(remito.numeroRemito).padStart(6, '0')}`}`
            : '',
        ajuste,
        stockFinal,
        coste: Number(coste || 0)
    });
};

const resolverIndiceTalleParaAjuste = (articulo, talle) => {
    if (!Array.isArray(articulo.talles) || !articulo.talles.length) {
        throw new Error(`El articulo ${articulo.nombre} no tiene talles configurados`);
    }

    if (limpiarTexto(talle)) {
        const indiceTalle = buscarIndiceTalle(articulo, talle);
        if (indiceTalle === -1) {
            throw new Error(`El talle ${talle} no existe en el articulo ${articulo.nombre}`);
        }

        return indiceTalle;
    }

    if (articulo.talles.length === 1) {
        return 0;
    }

    throw new Error(`Debe indicar talle para el articulo ${articulo.nombre}`);
};

const aplicarAjusteEnTalle = async ({
    articulo,
    indiceTalle,
    cantidad,
    motivo,
    remito,
    colaborador,
    tienda
}) => {
    const stockFinal = Number(articulo.talles[indiceTalle].stock || 0) + cantidad;
    if (stockFinal < 0) {
        throw new Error(`Stock insuficiente para el articulo ${articulo.nombre}`);
    }

    articulo.talles[indiceTalle].stock = stockFinal;
    await articulo.save();

    await registrarMovimientoInventario({
        articulo,
        talle: articulo.talles[indiceTalle].talle,
        ajuste: cantidad,
        stockFinal,
        coste: articulo.talles[indiceTalle].coste,
        motivo,
        remito,
        colaborador,
        tienda
    });
};

const aplicarAjusteEnStockRaiz = async ({
    articulo,
    cantidad,
    motivo,
    remito,
    colaborador,
    tienda
}) => {
    const stockFinal = Number(articulo.stock || 0) + cantidad;
    if (stockFinal < 0) {
        throw new Error(`Stock insuficiente para el articulo ${articulo.nombre}`);
    }

    articulo.stock = stockFinal;

    if (Array.isArray(articulo.talles) && articulo.talles.length === 1) {
        articulo.talles[0].stock = stockFinal;
    }

    await articulo.save();

    await registrarMovimientoInventario({
        articulo,
        talle: Array.isArray(articulo.talles) && articulo.talles.length === 1
            ? articulo.talles[0].talle
            : '',
        ajuste: cantidad,
        stockFinal,
        coste: Array.isArray(articulo.talles) && articulo.talles.length === 1
            ? articulo.talles[0].coste
            : 0,
        motivo,
        remito,
        colaborador,
        tienda
    });
};

const prepararAjustesStockPedido = async (pedido = [], { factor = -1 } = {}) => {
    const cacheArticulos = new Map();
    const ajustes = [];

    for (const item of pedido) {
        const articulo = await buscarArticuloParaItem(item, cacheArticulos);
        if (!articulo) {
            throw new Error(`No se encontro el articulo del item ${item.prenda}`);
        }

        const cantidadItem = Number(item.cantidad || 0) * factor;
        const tieneTalles = Array.isArray(articulo.talles) && articulo.talles.length;

        if (articulo.itemProveedor || !tieneTalles) {
            ajustes.push({
                articulo,
                tipo: 'stockRaiz',
                cantidad: cantidadItem
            });
            continue;
        }

        const indiceTalleVenta = resolverIndiceTalleParaAjuste(articulo, item.talle);
        const talleVenta = articulo.talles[indiceTalleVenta];

        if (talleVenta.artCompuesto) {
            for (const componente of talleVenta.composicion || []) {
                const articuloComponente = await Articulo.findById(componente.articulo);
                if (!articuloComponente) {
                    throw new Error(`Articulo de composicion no encontrado para ${articulo.nombre}`);
                }

                ajustes.push({
                    articulo: articuloComponente,
                    indiceTalle: resolverIndiceTalleParaAjuste(articuloComponente, componente.talle),
                    tipo: 'talle',
                    cantidad: cantidadItem * Number(componente.cantidad || 0)
                });
            }
        } else {
            ajustes.push({
                articulo,
                indiceTalle: indiceTalleVenta,
                tipo: 'talle',
                cantidad: cantidadItem
            });
        }
    }

    return ajustes;
};

const getStockActualAjuste = (ajuste) => {
    if (ajuste.tipo === 'stockRaiz') {
        return Number(ajuste.articulo.stock || 0);
    }

    return Number(ajuste.articulo.talles?.[ajuste.indiceTalle]?.stock || 0);
};

const getClaveAjusteStock = (ajuste) => (
    ajuste.tipo === 'stockRaiz'
        ? `${ajuste.articulo._id}::stockRaiz`
        : `${ajuste.articulo._id}::talle::${ajuste.indiceTalle}`
);

const validarStockSuficiente = (ajustes = []) => {
    const stockProyectado = new Map();

    for (const ajuste of ajustes) {
        const clave = getClaveAjusteStock(ajuste);
        const stockActual = stockProyectado.has(clave)
            ? stockProyectado.get(clave)
            : getStockActualAjuste(ajuste);
        const stockFinal = stockActual + Number(ajuste.cantidad || 0);

        if (stockFinal < 0) {
            throw new Error(`Stock insuficiente para el articulo ${ajuste.articulo.nombre}`);
        }

        stockProyectado.set(clave, stockFinal);
    }
};

const aplicarAjustesStock = async (ajustes = [], {
    motivo = 'VENTA_REMITO',
    remito = null,
    colaborador = null,
    tienda = ''
} = {}) => {
    for (const ajuste of ajustes) {
        const aplicarAjuste = ajuste.tipo === 'stockRaiz'
            ? aplicarAjusteEnStockRaiz
            : aplicarAjusteEnTalle;

        await aplicarAjuste({
            ...ajuste,
            motivo,
            remito,
            colaborador,
            tienda
        });
    }
};

const resolverImportesRemito = (data, pedido, { parcial = false } = {}) => {
    const resultado = {};
    const subtotalCalculado = pedido ? pedido.reduce((acumulado, item) => acumulado + Number(item.subtotal || 0), 0) : null;
    const hayImporteEnItems = Array.isArray(data?.pedido)
        && data.pedido.some((item) => item?.precioUnitario !== undefined || item?.subtotal !== undefined);

    const subtotalEnBody = data.subtotal !== undefined;
    const descuentoEnBody = data.descuento !== undefined;
    const importeTotalEnBody = data.importeTotal !== undefined;

    if (!parcial || subtotalEnBody || descuentoEnBody || importeTotalEnBody || pedido) {
        if (!parcial && !subtotalEnBody && !importeTotalEnBody && !hayImporteEnItems) {
            throw new Error('Debe informar importeTotal o precios/subtotales por item');
        }

        const subtotal = subtotalEnBody
            ? parsearImporte(data.subtotal, 'subtotal')
            : subtotalCalculado;

        const descuento = descuentoEnBody
            ? parsearImporte(data.descuento, 'descuento')
            : 0;

        if (subtotal === null || subtotal === undefined) {
            throw new Error('Debe informar subtotal o precios por item');
        }

        if (descuento > subtotal) {
            throw new Error('El descuento no puede ser mayor al subtotal');
        }

        const importeTotal = importeTotalEnBody
            ? parsearImporte(data.importeTotal, 'importeTotal')
            : subtotal - descuento;

        if (importeTotal > subtotal) {
            throw new Error('El importeTotal no puede ser mayor al subtotal menos descuento');
        }

        resultado.subtotal = subtotal;
        resultado.descuento = descuento;
        resultado.importeTotal = importeTotal;
    }

    return resultado;
};

const construirPayloadRemito = (data, { parcial = false } = {}) => {
    const payload = {};
    let pedidoProcesado = null;

    if (!parcial || data.numeroCliente !== undefined) {
        const numeroCliente = limpiarTexto(data.numeroCliente);
        if (!numeroCliente) {
            throw new Error('El numeroCliente es obligatorio');
        }
        payload.numeroCliente = numeroCliente;
    }

    if (!parcial || data.nombreApellido !== undefined) {
        const nombreApellido = limpiarTexto(data.nombreApellido);
        if (!nombreApellido) {
            throw new Error('El nombreApellido es obligatorio');
        }
        payload.nombreApellido = nombreApellido;
    }

    if (data.razonSocial !== undefined || !parcial) {
        payload.razonSocial = limpiarTexto(data.razonSocial);
    }

    if (data.email !== undefined || !parcial) {
        const email = limpiarTexto(data.email).toLowerCase();
        if (!validarEmail(email)) {
            throw new Error('Email invalido');
        }
        payload.email = email;
    }

    if (data.telefono !== undefined || !parcial) {
        payload.telefono = limpiarTexto(data.telefono);
    }

    if (data.cuit !== undefined || !parcial) {
        payload.cuit = limpiarTexto(data.cuit);
    }

    if (data.estado !== undefined || !parcial) {
        const estado = normalizarEstado(data.estado);
        if (!ESTADOS_VALIDOS.includes(estado)) {
            throw new Error(`Estado invalido. Use: ${ESTADOS_VALIDOS.join(', ')}`);
        }
        payload.estado = estado;
    }

    if (data.pedido !== undefined || !parcial) {
        pedidoProcesado = validarPedido(data.pedido);
        payload.pedido = pedidoProcesado;
    }

    Object.assign(payload, resolverImportesRemito(data, pedidoProcesado, { parcial }));

    return payload;
};

const obtenerSiguienteNumeroRemito = async () => {
    const secuencia = await Secuencia.findOneAndUpdate(
        { clave: 'remito' },
        { $inc: { valor: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return secuencia.valor;
};

const parsearNumeroRemito = (valor) => {
    const texto = limpiarTexto(valor).toUpperCase();
    if (!texto) return null;

    const soloNumero = texto.startsWith('R-') ? texto.slice(2) : texto;
    if (!/^\d+$/.test(soloNumero)) {
        throw new Error('numeroRemito invalido. Use por ejemplo 15 o R-000015');
    }

    return Number(soloNumero);
};

const buscarRemitoPorNumero = async (valor) => {
    const numeroRemito = parsearNumeroRemito(valor);
    return Remito.findOne({ numeroRemito });
};

const crearRemito = async (req, res) => {
    try {
        const payload = construirPayloadRemito(req.body);
        const ajustesStock = await prepararAjustesStockPedido(payload.pedido, { factor: -1 });
        validarStockSuficiente(ajustesStock);
        const numeroRemito = await obtenerSiguienteNumeroRemito();
        const nuevoRemito = new Remito({
            ...payload,
            numeroRemito
        });

        await nuevoRemito.save();
        await aplicarAjustesStock(ajustesStock, {
            motivo: 'VENTA_REMITO',
            remito: nuevoRemito,
            colaborador: req.user?.id || req.body?.colaborador,
            tienda: req.body?.tienda
        });

        return res.status(201).json({
            msg: 'Remito creado correctamente',
            remito: nuevoRemito
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

//trae remitos
const getProyeccionMes = (totalFacturado, fechaHasta) => {
    const fechaBase = fechaHasta ? new Date(`${fechaHasta}T12:00:00`) : new Date();

    const year = fechaBase.getFullYear();
    const month = fechaBase.getMonth();

    const hoy = new Date();
    const esMesActual = hoy.getFullYear() === year && hoy.getMonth() === month;

    const diasTranscurridos = esMesActual
        ? hoy.getDate()
        : new Date(year, month + 1, 0).getDate();

    const diasTotalesMes = new Date(year, month + 1, 0).getDate();

    return (Number(totalFacturado || 0) / Math.max(1, diasTranscurridos)) * diasTotalesMes;
};

const traerRemitos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            estado,
            numeroCliente,
            nombreApellido,
            numeroRemito,
            numeroRemitoFormateado,
            fechaDesde,
            fechaHasta,
            query
        } = req.query;

        const filtros = {};

        if (estado) {
            const estadoNormalizado = normalizarEstado(estado);
            if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
                return res.status(400).json({ msg: `Estado invalido. Use: ${ESTADOS_VALIDOS.join(', ')}` });
            }
            filtros.estado = estadoNormalizado;
        }

        if (fechaDesde || fechaHasta) {
            filtros.createdAt = {};
            if (fechaDesde) filtros.createdAt.$gte = new Date(`${fechaDesde}T00:00:00`);
            if (fechaHasta) filtros.createdAt.$lte = new Date(`${fechaHasta}T23:59:59`);
        }

        if (numeroCliente) {
            filtros.numeroCliente = { $regex: limpiarTexto(numeroCliente), $options: 'i' };
        }

        if (nombreApellido) {
            filtros.nombreApellido = { $regex: limpiarTexto(nombreApellido), $options: 'i' };
        }

        const numeroRemitoBuscado = numeroRemito ?? numeroRemitoFormateado;
        if (numeroRemitoBuscado) {
            filtros.numeroRemito = parsearNumeroRemito(numeroRemitoBuscado);
        }

        if (query) {
            const q = limpiarTexto(query);
            filtros.$or = [
                { nombreApellido: { $regex: q, $options: 'i' } },
                { razonSocial: { $regex: q, $options: 'i' } },
                { numeroCliente: { $regex: q, $options: 'i' } },
                { estado: { $regex: q, $options: 'i' } }
            ];

            const posibleNumero = Number(q.replace(/\D/g, ''));
            if (Number.isFinite(posibleNumero) && posibleNumero > 0) {
                filtros.$or.push({ numeroRemito: posibleNumero });
            }
        }

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Math.max(1, Number(limit) || 10);
        const skip = (pageNumber - 1) * limitNumber;

        const [total, remitos, resumenAgg] = await Promise.all([
            Remito.countDocuments(filtros),
            Remito.find(filtros)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNumber),
            Remito.aggregate([
                { $match: filtros },
                {
                    $group: {
                        _id: null,
                        totalFacturado: { $sum: { $ifNull: ['$importeTotal', 0] } },
                        cantidad: { $sum: 1 },
                        pagadas: {
                            $sum: { $cond: [{ $eq: ['$estado', 'PAGADO'] }, 1, 0] }
                        },
                        pendientes: {
                            $sum: { $cond: [{ $eq: ['$estado', 'PENDIENTE'] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        const resumenBase = resumenAgg[0] || {
            totalFacturado: 0,
            cantidad: 0,
            pagadas: 0,
            pendientes: 0
        };

        return res.json({
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            remitos,
            resumen: {
                ...resumenBase,
                proyeccion: getProyeccionMes(resumenBase.totalFacturado, fechaHasta)
            }
        });
    } catch (error) {
        const status = error.message.includes('numeroRemito invalido') ? 400 : 500;
        return res.status(status).json({ msg: 'Error al obtener remitos', error: error.message });
    }
};


const traerRemito = async (req, res) => {
    const { id } = req.params;

    try {
        const remito = await Remito.findById(id);
        if (!remito) {
            return res.status(404).json({ msg: 'Remito no encontrado' });
        }

        return res.json(remito);
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener el remito', error: error.message });
    }
};

const traerRemitoPorNumero = async (req, res) => {
    const { numeroRemito } = req.params;

    try {
        const remito = await buscarRemitoPorNumero(numeroRemito);
        if (!remito) {
            return res.status(404).json({ msg: 'Remito no encontrado' });
        }

        return res.json(remito);
    } catch (error) {
        const status = error.message.includes('numeroRemito invalido') ? 400 : 500;
        return res.status(status).json({ msg: 'Error al obtener el remito', error: error.message });
    }
};

const traerRemitosPorCliente = async (req, res) => {
    const { numeroCliente } = req.params;

    try {
        const numeroClienteLimpio = limpiarTexto(numeroCliente);
        if (!numeroClienteLimpio) {
            return res.status(400).json({ msg: 'El numeroCliente es obligatorio' });
        }

        const remitos = await Remito.find({ numeroCliente: numeroClienteLimpio })
            .sort({ createdAt: -1 });

        const totalDebe = remitos
            .filter((remito) => remito.estado === 'PENDIENTE')
            .reduce((acumulado, remito) => acumulado + Number(remito.importeTotal || 0), 0);

        return res.json({
            numeroCliente: numeroClienteLimpio,
            totalRemitos: remitos.length,
            totalPendientes: remitos.filter((remito) => remito.estado === 'PENDIENTE').length,
            totalPagados: remitos.filter((remito) => remito.estado === 'PAGADO').length,
            totalDebe,
            remitos
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener remitos del cliente', error: error.message });
    }
};

const modificarRemito = async (req, res) => {
    const { id } = req.params;

    try {
        const remito = await Remito.findById(id);
        if (!remito) {
            return res.status(404).json({ msg: 'Remito no encontrado' });
        }

        const payload = construirPayloadRemito(req.body, { parcial: true });
        const debeAjustarPedido = payload.pedido !== undefined;
        const ajustesRestaurar = debeAjustarPedido
            ? await prepararAjustesStockPedido(remito.pedido, { factor: 1 })
            : [];
        const ajustesNuevos = debeAjustarPedido
            ? await prepararAjustesStockPedido(payload.pedido, { factor: -1 })
            : [];
        validarStockSuficiente([...ajustesRestaurar, ...ajustesNuevos]);

        Object.assign(remito, payload);

        await remito.save();

        if (debeAjustarPedido) {
            await aplicarAjustesStock(ajustesRestaurar, {
                motivo: 'AJUSTE_REMITO',
                remito,
                colaborador: req.user?.id || req.body?.colaborador,
                tienda: req.body?.tienda
            });
            await aplicarAjustesStock(ajustesNuevos, {
                motivo: 'VENTA_REMITO',
                remito,
                colaborador: req.user?.id || req.body?.colaborador,
                tienda: req.body?.tienda
            });
        }

        return res.json({
            msg: 'Remito modificado correctamente',
            remito
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

const actualizarEstadoRemito = async (req, res) => {
    const { id } = req.params;

    try {
        const estado = normalizarEstado(req.body?.estado);
        if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ msg: `Estado invalido. Use: ${ESTADOS_VALIDOS.join(', ')}` });
        }

        const remito = await Remito.findById(id);
        if (!remito) {
            return res.status(404).json({ msg: 'Remito no encontrado' });
        }

        remito.estado = estado;
        await remito.save();

        return res.json({
            msg: 'Estado del remito actualizado correctamente',
            remito
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al actualizar el estado del remito', error: error.message });
    }
};

const eliminarRemito = async (req, res) => {
    const { id } = req.params;

    try {
        const remito = await Remito.findById(id);
        if (!remito) {
            return res.status(404).json({ msg: 'Remito no encontrado' });
        }

        const ajustesStock = await prepararAjustesStockPedido(remito.pedido, { factor: 1 });
        await aplicarAjustesStock(ajustesStock, {
            motivo: 'ELIMINACION_REMITO',
            remito,
            colaborador: req.user?.id || req.body?.colaborador,
            tienda: req.body?.tienda
        });
        await Remito.findByIdAndDelete(id);

        return res.json({
            msg: 'Remito eliminado correctamente',
            idEliminado: id
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al eliminar el remito', error: error.message });
    }
};

module.exports = {
    crearRemito,
    traerRemitos,
    traerRemito,
    traerRemitoPorNumero,
    traerRemitosPorCliente,
    modificarRemito,
    actualizarEstadoRemito,
    eliminarRemito
};
