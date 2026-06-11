const Recibo = require('../models/recibo');
const PagoProveedor = require('../models/pagoProveedor');
const Remito = require('../models/remito');
const OrdenCompra = require('../models/ordenDeCompra');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TIMEZONE = 'America/Argentina/Buenos_Aires';

const getYear = (value) => {
    const parsed = Number(value);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > currentYear + 1) {
        return currentYear;
    }
    return parsed;
};

const getRangoAnual = (year) => ({
    desde: new Date(`${year}-01-01T00:00:00.000-03:00`),
    hasta: new Date(`${year + 1}-01-01T00:00:00.000-03:00`)
});

const agregarPorMes = async ({ model, campoFecha, camposSumar, desde, hasta }) => {
    const projectSums = Object.entries(camposSumar).reduce((acc, [alias, campo]) => ({
        ...acc,
        [alias]: { $ifNull: [`$${campo}`, 0] }
    }), {});

    return model.aggregate([
        {
            $match: {
                [campoFecha]: {
                    $gte: desde,
                    $lt: hasta
                }
            }
        },
        {
            $project: {
                mes: {
                    $toInt: {
                        $dateToString: {
                            format: '%m',
                            date: `$${campoFecha}`,
                            timezone: TIMEZONE
                        }
                    }
                },
                ...projectSums
            }
        },
        {
            $group: {
                _id: '$mes',
                cantidad: { $sum: 1 },
                ...Object.keys(camposSumar).reduce((acc, alias) => ({
                    ...acc,
                    [alias]: { $sum: `$${alias}` }
                }), {})
            }
        }
    ]);
};

const indexarPorMes = (rows = []) => rows.reduce((acc, row) => {
    acc[Number(row._id)] = row;
    return acc;
}, {});

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const obtenerInformeFinanciero = async (req, res) => {
    try {
        const year = getYear(req.query.year);
        const { desde, hasta } = getRangoAnual(year);

        const [ingresosRows, egresosRows, ventasRows, comprasRows] = await Promise.all([
            agregarPorMes({
                model: Recibo,
                campoFecha: 'fechaCobro',
                camposSumar: { ingresos: 'importe' },
                desde,
                hasta
            }),
            agregarPorMes({
                model: PagoProveedor,
                campoFecha: 'fechaPago',
                camposSumar: { egresos: 'importe' },
                desde,
                hasta
            }),
            agregarPorMes({
                model: Remito,
                campoFecha: 'createdAt',
                camposSumar: {
                    ventasFacturadas: 'importeTotal',
                    costoVentas: 'totalCosto',
                    rentabilidadBruta: 'rentabilidad'
                },
                desde,
                hasta
            }),
            agregarPorMes({
                model: OrdenCompra,
                campoFecha: 'fechaOrden',
                camposSumar: { comprasGeneradas: 'totalOrden' },
                desde,
                hasta
            })
        ]);

        const ingresosPorMes = indexarPorMes(ingresosRows);
        const egresosPorMes = indexarPorMes(egresosRows);
        const ventasPorMes = indexarPorMes(ventasRows);
        const comprasPorMes = indexarPorMes(comprasRows);

        const meses = MESES.map((label, index) => {
            const mes = index + 1;
            const ingresos = roundMoney(ingresosPorMes[mes]?.ingresos);
            const egresos = roundMoney(egresosPorMes[mes]?.egresos);
            const ventasFacturadas = roundMoney(ventasPorMes[mes]?.ventasFacturadas);
            const costoVentas = roundMoney(ventasPorMes[mes]?.costoVentas);
            const rentabilidadBruta = roundMoney(
                ventasPorMes[mes]?.rentabilidadBruta ?? (ventasFacturadas - costoVentas)
            );
            const comprasGeneradas = roundMoney(comprasPorMes[mes]?.comprasGeneradas);

            return {
                mes,
                label,
                ingresos,
                egresos,
                neto: roundMoney(ingresos - egresos),
                ventasFacturadas,
                costoVentas,
                rentabilidadBruta,
                comprasGeneradas,
                cantidadCobros: Number(ingresosPorMes[mes]?.cantidad || 0),
                cantidadPagos: Number(egresosPorMes[mes]?.cantidad || 0),
                cantidadVentas: Number(ventasPorMes[mes]?.cantidad || 0),
                cantidadCompras: Number(comprasPorMes[mes]?.cantidad || 0)
            };
        });

        const resumen = meses.reduce((acc, item) => ({
            ingresos: acc.ingresos + item.ingresos,
            egresos: acc.egresos + item.egresos,
            neto: acc.neto + item.neto,
            ventasFacturadas: acc.ventasFacturadas + item.ventasFacturadas,
            costoVentas: acc.costoVentas + item.costoVentas,
            rentabilidadBruta: acc.rentabilidadBruta + item.rentabilidadBruta,
            comprasGeneradas: acc.comprasGeneradas + item.comprasGeneradas,
            cantidadCobros: acc.cantidadCobros + item.cantidadCobros,
            cantidadPagos: acc.cantidadPagos + item.cantidadPagos,
            cantidadVentas: acc.cantidadVentas + item.cantidadVentas,
            cantidadCompras: acc.cantidadCompras + item.cantidadCompras
        }), {
            ingresos: 0,
            egresos: 0,
            neto: 0,
            ventasFacturadas: 0,
            costoVentas: 0,
            rentabilidadBruta: 0,
            comprasGeneradas: 0,
            cantidadCobros: 0,
            cantidadPagos: 0,
            cantidadVentas: 0,
            cantidadCompras: 0
        });

        const margenBruto = resumen.ventasFacturadas > 0
            ? (resumen.rentabilidadBruta / resumen.ventasFacturadas) * 100
            : 0;

        return res.json({
            year,
            meses,
            resumen: {
                ...Object.fromEntries(Object.entries(resumen).map(([key, value]) => [key, roundMoney(value)])),
                cantidadCobros: resumen.cantidadCobros,
                cantidadPagos: resumen.cantidadPagos,
                cantidadVentas: resumen.cantidadVentas,
                cantidadCompras: resumen.cantidadCompras,
                margenBruto: roundMoney(margenBruto)
            }
        });
    } catch (error) {
        return res.status(500).json({
            msg: 'Error al obtener informe financiero',
            error: error.message
        });
    }
};

module.exports = {
    obtenerInformeFinanciero
};
