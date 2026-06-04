const Recibo = require('../models/recibo');
const Secuencia = require('../models/secuencia');
const Remito = require('../models/remito');
const mongoose = require('mongoose');

const limpiarTexto = (valor) => {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
};

const parsearImporte = (importe) => {
    const importeNumerico = Number(importe);
    if (!Number.isFinite(importeNumerico) || importeNumerico < 0) {
        throw new Error('Importe invalido. Debe ser un numero mayor o igual a 0');
    }
    return importeNumerico;
};

const parsearFechaCobro = (fechaCobro) => {
    if (!fechaCobro) return new Date();

    const fecha = new Date(fechaCobro);
    if (Number.isNaN(fecha.getTime())) {
        throw new Error('fechaCobro invalida');
    }

    return fecha;
};

const validarObjectId = (valor, campo) => {
    const texto = limpiarTexto(valor);
    if (!texto) return null;
    if (!mongoose.Types.ObjectId.isValid(texto)) {
        throw new Error(`${campo} invalido`);
    }
    return texto;
};

const construirPayloadRecibo = (data, { parcial = false } = {}) => {
    const payload = {};

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

    if (!parcial || data.importe !== undefined) {
        payload.importe = parsearImporte(data.importe);
    }

    if (data.remito !== undefined || data.remitoId !== undefined || !parcial) {
        const remito = validarObjectId(data.remito ?? data.remitoId, 'remito');
        if (remito) payload.remito = remito;
    }

    if (data.razonSocial !== undefined || !parcial) {
        payload.razonSocial = limpiarTexto(data.razonSocial);
    }

    if (data.fechaCobro !== undefined || !parcial) {
        payload.fechaCobro = parsearFechaCobro(data.fechaCobro);
    }

    if (data.medioPago !== undefined || !parcial) {
        payload.medioPago = limpiarTexto(data.medioPago);
    }

    if (data.observaciones !== undefined || !parcial) {
        payload.observaciones = limpiarTexto(data.observaciones);
    }

    return payload;
};

const getRemitoId = (valor) => {
    if (!valor) return null;
    return String(valor?._id || valor);
};

const getPagoRemito = async (remitoId, { excluirReciboId = null } = {}) => {
    if (!remitoId) return { cantidad: 0, total: 0 };

    const filtro = { remito: remitoId };
    if (excluirReciboId) filtro._id = { $ne: excluirReciboId };

    const recibos = await Recibo.find(filtro).select('importe').lean();
    return {
        cantidad: recibos.length,
        total: recibos.reduce((acc, recibo) => acc + Number(recibo.importe || 0), 0)
    };
};

const actualizarEstadoRemitoPorPagos = async (remitoId) => {
    if (!remitoId) return;

    const remito = await Remito.findById(remitoId);
    if (!remito) return;

    const pago = await getPagoRemito(remito._id);
    const totalRemito = Number(remito.importeTotal || 0);
    remito.estado = totalRemito > 0 && pago.total >= totalRemito ? 'PAGADO' : 'PENDIENTE';
    await remito.save();
};

const validarRemitoDelRecibo = async (payload, { reciboActual = null } = {}) => {
    const remitoId = getRemitoId(payload.remito ?? reciboActual?.remito);
    if (!remitoId) return;

    const remito = await Remito.findById(remitoId).lean();
    if (!remito) {
        throw new Error('Remito no encontrado');
    }

    const numeroCliente = limpiarTexto(payload.numeroCliente ?? reciboActual?.numeroCliente);
    if (numeroCliente && limpiarTexto(remito.numeroCliente) !== numeroCliente) {
        throw new Error('El remito seleccionado no pertenece al cliente del recibo');
    }

    const pagoActual = await getPagoRemito(remitoId, { excluirReciboId: reciboActual?._id });
    if (pagoActual.cantidad >= 2) {
        throw new Error('El remito seleccionado ya tiene dos pagos registrados');
    }

    const importe = Number(payload.importe ?? reciboActual?.importe ?? 0);
    const totalRemito = Number(remito.importeTotal || 0);
    if (pagoActual.total + importe > totalRemito) {
        throw new Error('El importe supera el saldo pendiente del remito seleccionado');
    }
};

const obtenerSiguienteNumeroRecibo = async () => {
    const secuencia = await Secuencia.findOneAndUpdate(
        { clave: 'recibo' },
        { $inc: { valor: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return secuencia.valor;
};

const crearRecibo = async (req, res) => {
    try {
        const payload = construirPayloadRecibo(req.body);
        await validarRemitoDelRecibo(payload);
        const numeroRecibo = await obtenerSiguienteNumeroRecibo();

        const nuevoRecibo = new Recibo({
            ...payload,
            numeroRecibo
        });

        await nuevoRecibo.save();
        await actualizarEstadoRemitoPorPagos(nuevoRecibo.remito);

        return res.status(201).json({
            msg: 'Recibo creado correctamente',
            recibo: nuevoRecibo
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

const traerRecibos = async (req, res) => {
    try {
        const { page = 1, limit = 10, numeroCliente, nombreApellido, desde, hasta } = req.query;
        const filtros = {};

        if (numeroCliente) {
            filtros.numeroCliente = limpiarTexto(numeroCliente);
        }

        if (nombreApellido) {
            filtros.nombreApellido = { $regex: limpiarTexto(nombreApellido), $options: 'i' };
        }

        if (desde || hasta) {
            filtros.fechaCobro = {};
            if (desde) filtros.fechaCobro.$gte = new Date(desde);
            if (hasta) filtros.fechaCobro.$lte = new Date(hasta);
        }

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Math.max(1, Number(limit) || 10);
        const skip = (pageNumber - 1) * limitNumber;

        const [total, recibos] = await Promise.all([
            Recibo.countDocuments(filtros),
            Recibo.find(filtros)
                .populate('remito', 'numeroRemito numeroCliente importeTotal estado')
                .sort({ fechaCobro: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNumber)
        ]);

        return res.json({
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            recibos
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener recibos', error: error.message });
    }
};

const traerRecibo = async (req, res) => {
    const { id } = req.params;

    try {
        const recibo = await Recibo.findById(id)
            .populate('remito', 'numeroRemito numeroCliente importeTotal estado');
        if (!recibo) {
            return res.status(404).json({ msg: 'Recibo no encontrado' });
        }

        return res.json(recibo);
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener el recibo', error: error.message });
    }
};

const traerRecibosPorCliente = async (req, res) => {
    const { numeroCliente } = req.params;

    try {
        const numeroClienteLimpio = limpiarTexto(numeroCliente);
        if (!numeroClienteLimpio) {
            return res.status(400).json({ msg: 'El numeroCliente es obligatorio' });
        }

        const recibos = await Recibo.find({ numeroCliente: numeroClienteLimpio })
            .populate('remito', 'numeroRemito numeroCliente importeTotal estado')
            .sort({ fechaCobro: -1, createdAt: -1 });

        const totalCobrado = recibos.reduce((acumulado, recibo) => acumulado + Number(recibo.importe || 0), 0);

        return res.json({
            numeroCliente: numeroClienteLimpio,
            totalRecibos: recibos.length,
            totalCobrado,
            recibos
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener recibos del cliente', error: error.message });
    }
};

const modificarRecibo = async (req, res) => {
    const { id } = req.params;

    try {
        const recibo = await Recibo.findById(id);
        if (!recibo) {
            return res.status(404).json({ msg: 'Recibo no encontrado' });
        }

        const payload = construirPayloadRecibo(req.body, { parcial: true });
        const remitoAnterior = getRemitoId(recibo.remito);
        await validarRemitoDelRecibo(payload, { reciboActual: recibo });
        Object.assign(recibo, payload);

        await recibo.save();
        await Promise.all([
            actualizarEstadoRemitoPorPagos(remitoAnterior),
            actualizarEstadoRemitoPorPagos(recibo.remito)
        ]);

        return res.json({
            msg: 'Recibo modificado correctamente',
            recibo
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

const eliminarRecibo = async (req, res) => {
    const { id } = req.params;

    try {
        const recibo = await Recibo.findById(id);
        if (!recibo) {
            return res.status(404).json({ msg: 'Recibo no encontrado' });
        }

        const remitoId = getRemitoId(recibo.remito);
        await Recibo.findByIdAndDelete(id);
        await actualizarEstadoRemitoPorPagos(remitoId);

        return res.json({
            msg: 'Recibo eliminado correctamente',
            idEliminado: id
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al eliminar el recibo', error: error.message });
    }
};

module.exports = {
    crearRecibo,
    traerRecibos,
    traerRecibo,
    traerRecibosPorCliente,
    modificarRecibo,
    eliminarRecibo
};
