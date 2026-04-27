const Remito = require('../models/remito');
const Recibo = require('../models/recibo');

const limpiarTexto = (valor) => {
    if (valor === undefined || valor === null) return '';
    return String(valor).trim();
};

const normalizarFecha = (fecha) => new Date(fecha).getTime();

const construirMovimientoRemito = (remito) => ({
    id: String(remito._id),
    tipo: 'REMITO',
    fecha: remito.createdAt,
    numero: remito.numeroRemitoFormateado || `R-${String(remito.numeroRemito).padStart(6, '0')}`,
    comprobante: remito.numeroRemitoFormateado || `R-${String(remito.numeroRemito).padStart(6, '0')}`,
    concepto: `Remito ${remito.estado === 'CANCELADO' ? 'cancelado' : 'emitido'}`,
    estado: remito.estado,
    debe: remito.estado === 'CANCELADO' ? 0 : Number(remito.importeTotal || 0),
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

        return res.json({
            cliente: {
                numeroCliente: numeroClienteLimpio,
                razonSocial: clienteBase?.razonSocial || '',
                nombreApellido: clienteBase?.nombreApellido || ''
            },
            resumen: {
                totalDebe,
                totalHaber,
                saldo: totalDebe - totalHaber,
                cantidadRemitos: remitos.length,
                cantidadRecibos: recibos.length
            },
            movimientos: movimientosConSaldo
        });
    } catch (error) {
        return res.status(500).json({ msg: 'Error al obtener la cuenta corriente del cliente', error: error.message });
    }
};

module.exports = {
    traerCuentaCorrienteCliente
};
