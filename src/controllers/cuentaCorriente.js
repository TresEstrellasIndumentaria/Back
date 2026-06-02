const mongoose = require('mongoose');
const Remito = require('../models/remito');
const Recibo = require('../models/recibo');
const OrdenCompra = require('../models/ordenDeCompra');
const PagoProveedor = require('../models/pagoProveedor');

const limpiarTexto = (valor) => {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
};

const normalizarFecha = (fecha) => new Date(fecha).getTime();
const estadoCuentaPorSaldo = (saldo) => (Number(saldo || 0) > 0 ? 'DEUDOR' : 'PAGADA');
const numeroOrdenFormateado = (orden) => `OC-${String(orden.numero || 0).padStart(6, '0')}`;

const construirMovimientoRemito = (remito) => ({
    id: String(remito._id),
    tipo: 'REMITO',
    fecha: remito.createdAt,
    numero: remito.numeroRemitoFormateado || `R-${String(remito.numeroRemito).padStart(6, '0')}`,
    comprobante: remito.numeroRemitoFormateado || `R-${String(remito.numeroRemito).padStart(6, '0')}`,
    concepto: `Remito ${remito.estado === 'PAGADO' ? 'pagado' : 'pendiente'}`,
    estado: remito.estado,
    debe: remito.estado === 'PENDIENTE' ? Number(remito.importeTotal || 0) : 0,
    haber: 0,
    saldo: 0,
    detalle: {
        remitoId: remito._id,
        subtotal: Number(remito.subtotal || 0),
        descuento: Number(remito.descuento || 0),
        importeTotal: Number(remito.importeTotal || 0)
    }
});

const construirMovimientoRecibo = (recibo) => ({
    id: String(recibo._id),
    tipo: 'RECIBO',
    fecha: recibo.fechaCobro || recibo.createdAt,
    numero: recibo.numeroReciboFormateado || `RC-${String(recibo.numeroRecibo).padStart(6, '0')}`,
    comprobante: recibo.numeroReciboFormateado || `RC-${String(recibo.numeroRecibo).padStart(6, '0')}`,
    concepto: recibo.observaciones || 'Cobro recibido',
    estado: 'COBRADO',
    debe: 0,
    haber: Number(recibo.importe || 0),
    saldo: 0,
    detalle: {
        reciboId: recibo._id,
        importe: Number(recibo.importe || 0),
        medioPago: recibo.medioPago || ''
    }
});

const construirMovimientoOrdenCompra = (orden) => ({
    id: String(orden._id),
    tipo: 'ORDEN_COMPRA',
    fecha: orden.fechaOrden || orden.createdAt,
    numero: numeroOrdenFormateado(orden),
    comprobante: numeroOrdenFormateado(orden),
    concepto: `Orden de compra ${orden.estado}`,
    estado: orden.estado,
    debe: Number(orden.totalOrden || 0),
    haber: 0,
    saldo: 0,
    detalle: {
        ordenCompraId: orden._id,
        totalOrden: Number(orden.totalOrden || 0),
        cantidadItems: Array.isArray(orden.items) ? orden.items.length : 0
    }
});

const construirMovimientoPagoProveedor = (pago) => ({
    id: String(pago._id),
    tipo: 'PAGO_PROVEEDOR',
    fecha: pago.fechaPago || pago.createdAt,
    numero: pago.numeroPagoFormateado || `PP-${String(pago.numeroPago).padStart(6, '0')}`,
    comprobante: pago.numeroPagoFormateado || `PP-${String(pago.numeroPago).padStart(6, '0')}`,
    concepto: pago.observaciones || 'Pago realizado',
    estado: 'PAGADO',
    debe: 0,
    haber: Number(pago.importe || 0),
    saldo: 0,
    detalle: {
        pagoProveedorId: pago._id,
        importe: Number(pago.importe || 0),
        medioPago: pago.medioPago || ''
    }
});

const traerCuentaCorrienteCliente = async (req, res) => {
    const { numeroCliente } = req.params;

    try {
        const numeroClienteLimpio = limpiarTexto(numeroCliente);
        if (!numeroClienteLimpio) {
            return res.status(400).json({ msg: 'El numeroCliente es obligatorio' });
        }

        const [remitos, recibos] = await Promise.all([
            Remito.find({ numeroCliente: numeroClienteLimpio }).sort({ createdAt: 1 }),
            Recibo.find({ numeroCliente: numeroClienteLimpio }).sort({ fechaCobro: 1, createdAt: 1 })
        ]);

        const clienteBase = remitos[0] || recibos[0] || null;

        const movimientos = [
            ...remitos.map(construirMovimientoRemito),
            ...recibos.map(construirMovimientoRecibo)
        ]
            .sort((a, b) => {
                const fechaDiff = normalizarFecha(a.fecha) - normalizarFecha(b.fecha);
                if (fechaDiff !== 0) return fechaDiff;
                if (a.tipo === b.tipo) return 0;
                return a.tipo === 'REMITO' ? -1 : 1;
            })
            .map((movimiento) => movimiento);

        let saldoAcumulado = 0;
        const movimientosConSaldo = movimientos.map((movimiento) => {
            saldoAcumulado += Number(movimiento.debe || 0) - Number(movimiento.haber || 0);
            return {
                ...movimiento,
                saldo: saldoAcumulado
            };
        });

        const totalDebe = movimientosConSaldo.reduce((acumulado, movimiento) => acumulado + Number(movimiento.debe || 0), 0);
        const totalHaber = movimientosConSaldo.reduce((acumulado, movimiento) => acumulado + Number(movimiento.haber || 0), 0);
        const saldo = totalDebe - totalHaber;

        return res.json({
            cliente: {
                numeroCliente: numeroClienteLimpio,
                razonSocial: clienteBase?.razonSocial || '',
                nombreApellido: clienteBase?.nombreApellido || ''
            },
            resumen: {
                totalDebe,
                totalHaber,
                saldo,
                estado: estadoCuentaPorSaldo(saldo),
                cantidadRemitos: remitos.length,
                cantidadRecibos: recibos.length
            },
            movimientos: movimientosConSaldo
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener la cuenta corriente del cliente', error: error.message });
    }
};

const traerCuentaCorrienteProveedor = async (req, res) => {
    const { proveedorId } = req.params;

    try {
        const proveedorLimpio = limpiarTexto(proveedorId);
        if (!proveedorLimpio) {
            return res.status(400).json({ msg: 'El proveedorId es obligatorio' });
        }

        if (!mongoose.Types.ObjectId.isValid(proveedorLimpio)) {
            return res.status(400).json({ msg: 'Proveedor invalido' });
        }

        const estadosCompraCuenta = ['ENVIADA', 'PARCIALMENTE_RECIBIDA', 'RECIBIDA'];
        const [ordenes, pagos] = await Promise.all([
            OrdenCompra.find({
                proveedor: proveedorLimpio,
                estado: { $in: estadosCompraCuenta }
            })
                .populate('proveedor', 'nombre apellido nombreApellido razonSocial')
                .sort({ fechaOrden: 1, createdAt: 1 }),
            PagoProveedor.find({ proveedor: proveedorLimpio })
                .populate('proveedor', 'nombre apellido nombreApellido razonSocial')
                .sort({ fechaPago: 1, createdAt: 1 })
        ]);

        const proveedorBase = ordenes[0]?.proveedor || pagos[0]?.proveedor || null;
        const nombreApellido = proveedorBase
            ? (proveedorBase.nombreApellido || `${proveedorBase.nombre || ''} ${proveedorBase.apellido || ''}`.trim())
            : '';

        const movimientos = [
            ...ordenes.map(construirMovimientoOrdenCompra),
            ...pagos.map(construirMovimientoPagoProveedor)
        ]
            .sort((a, b) => {
                const fechaDiff = normalizarFecha(a.fecha) - normalizarFecha(b.fecha);
                if (fechaDiff !== 0) return fechaDiff;
                if (a.tipo === b.tipo) return 0;
                return a.tipo === 'ORDEN_COMPRA' ? -1 : 1;
            })
            .map((movimiento) => movimiento);

        let saldoAcumulado = 0;
        const movimientosConSaldo = movimientos.map((movimiento) => {
            saldoAcumulado += Number(movimiento.debe || 0) - Number(movimiento.haber || 0);
            return {
                ...movimiento,
                saldo: saldoAcumulado
            };
        });

        const totalDebe = movimientosConSaldo.reduce((acumulado, movimiento) => acumulado + Number(movimiento.debe || 0), 0);
        const totalHaber = movimientosConSaldo.reduce((acumulado, movimiento) => acumulado + Number(movimiento.haber || 0), 0);
        const saldo = totalDebe - totalHaber;

        return res.json({
            proveedor: {
                id: proveedorLimpio,
                razonSocial: proveedorBase?.razonSocial || '',
                nombreApellido
            },
            resumen: {
                totalDebe,
                totalHaber,
                saldo,
                estado: estadoCuentaPorSaldo(saldo),
                cantidadOrdenes: ordenes.length,
                cantidadPagos: pagos.length
            },
            movimientos: movimientosConSaldo
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener la cuenta corriente del proveedor', error: error.message });
    }
};

module.exports = {
    traerCuentaCorrienteCliente,
    traerCuentaCorrienteProveedor
};
