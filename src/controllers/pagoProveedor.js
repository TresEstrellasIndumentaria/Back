const mongoose = require('mongoose');
const PagoProveedor = require('../models/pagoProveedor');
const Persona = require('../models/persona');
const Secuencia = require('../models/secuencia');

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

const parsearFechaPago = (fechaPago) => {
    if (!fechaPago) return new Date();

    const fecha = new Date(fechaPago);
    if (Number.isNaN(fecha.getTime())) {
        throw new Error('fechaPago invalida');
    }

    return fecha;
};

const obtenerSiguienteNumeroPago = async () => {
    const ultimoPago = await PagoProveedor.findOne()
        .sort({ numeroPago: -1 })
        .select('numeroPago')
        .lean();

    await Secuencia.updateOne(
        { clave: 'pagoProveedor' },
        { $max: { valor: Number(ultimoPago?.numeroPago || 0) } },
        { upsert: true }
    );

    const secuencia = await Secuencia.findOneAndUpdate(
        { clave: 'pagoProveedor' },
        { $inc: { valor: 1 } },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return secuencia.valor;
};

const validarProveedor = async (proveedorId) => {
    if (!mongoose.Types.ObjectId.isValid(proveedorId)) {
        throw new Error('Proveedor invalido');
    }

    const proveedor = await Persona.findById(proveedorId);
    if (!proveedor) {
        throw new Error('Proveedor no encontrado');
    }

    if (proveedor.rol !== 'PROVEEDOR') {
        throw new Error('La persona indicada no tiene rol PROVEEDOR');
    }

    return proveedor;
};

const nombreProveedor = (proveedor) => {
    const nombreApellido = `${proveedor.nombre || ''} ${proveedor.apellido || ''}`.trim();
    return proveedor.nombreApellido || nombreApellido || proveedor.razonSocial || '';
};

const construirPayloadPago = async (data, { parcial = false } = {}) => {
    const payload = {};

    if (!parcial || data.proveedor !== undefined) {
        const proveedor = await validarProveedor(data.proveedor);
        payload.proveedor = proveedor._id;
        payload.nombreProveedor = nombreProveedor(proveedor);
        payload.razonSocial = limpiarTexto(proveedor.razonSocial);
    }

    if (!parcial || data.importe !== undefined) {
        payload.importe = parsearImporte(data.importe);
    }

    if (data.fechaPago !== undefined || !parcial) {
        payload.fechaPago = parsearFechaPago(data.fechaPago);
    }

    if (data.medioPago !== undefined || !parcial) {
        payload.medioPago = limpiarTexto(data.medioPago);
    }

    if (data.observaciones !== undefined || !parcial) {
        payload.observaciones = limpiarTexto(data.observaciones);
    }

    return payload;
};

const crearPagoProveedor = async (req, res) => {
    try {
        const payload = await construirPayloadPago(req.body);
        const numeroPago = await obtenerSiguienteNumeroPago();

        const nuevoPago = new PagoProveedor({
            ...payload,
            numeroPago
        });

        await nuevoPago.save();

        return res.status(201).json({
            msg: 'Pago a proveedor creado correctamente',
            pago: nuevoPago
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

const traerPagosProveedor = async (req, res) => {
    try {
        const { page = 1, limit = 10, proveedor, desde, hasta } = req.query;
        const filtros = {};

        if (proveedor) {
            if (!mongoose.Types.ObjectId.isValid(proveedor)) {
                return res.status(400).json({ msg: 'Proveedor invalido' });
            }
            filtros.proveedor = proveedor;
        }

        if (desde || hasta) {
            filtros.fechaPago = {};
            if (desde) filtros.fechaPago.$gte = new Date(desde);
            if (hasta) filtros.fechaPago.$lte = new Date(hasta);
        }

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Math.max(1, Number(limit) || 10);
        const skip = (pageNumber - 1) * limitNumber;

        const [total, pagos] = await Promise.all([
            PagoProveedor.countDocuments(filtros),
            PagoProveedor.find(filtros)
                .populate('proveedor', 'nombre apellido nombreApellido razonSocial')
                .sort({ fechaPago: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNumber)
        ]);

        return res.json({
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            pagos
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener pagos a proveedores', error: error.message });
    }
};

const traerPagoProveedor = async (req, res) => {
    try {
        const pago = await PagoProveedor.findById(req.params.id)
            .populate('proveedor', 'nombre apellido nombreApellido razonSocial');
        if (!pago) {
            return res.status(404).json({ msg: 'Pago a proveedor no encontrado' });
        }

        return res.json(pago);
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener el pago a proveedor', error: error.message });
    }
};

const traerPagosPorProveedor = async (req, res) => {
    try {
        const { proveedorId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(proveedorId)) {
            return res.status(400).json({ msg: 'Proveedor invalido' });
        }

        const pagos = await PagoProveedor.find({ proveedor: proveedorId })
            .sort({ fechaPago: -1, createdAt: -1 });

        const totalPagado = pagos.reduce((acumulado, pago) => acumulado + Number(pago.importe || 0), 0);

        return res.json({
            proveedor: proveedorId,
            totalPagos: pagos.length,
            totalPagado,
            pagos
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener pagos del proveedor', error: error.message });
    }
};

const modificarPagoProveedor = async (req, res) => {
    try {
        const pago = await PagoProveedor.findById(req.params.id);
        if (!pago) {
            return res.status(404).json({ msg: 'Pago a proveedor no encontrado' });
        }

        const payload = await construirPayloadPago(req.body, { parcial: true });
        Object.assign(pago, payload);

        await pago.save();

        return res.json({
            msg: 'Pago a proveedor modificado correctamente',
            pago
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
};

const eliminarPagoProveedor = async (req, res) => {
    try {
        const pago = await PagoProveedor.findById(req.params.id);
        if (!pago) {
            return res.status(404).json({ msg: 'Pago a proveedor no encontrado' });
        }

        await PagoProveedor.findByIdAndDelete(req.params.id);

        return res.json({
            msg: 'Pago a proveedor eliminado correctamente',
            idEliminado: req.params.id
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al eliminar el pago a proveedor', error: error.message });
    }
};

module.exports = {
    crearPagoProveedor,
    traerPagosProveedor,
    traerPagoProveedor,
    traerPagosPorProveedor,
    modificarPagoProveedor,
    eliminarPagoProveedor
};
