const Remito = require('../models/remito');
const Secuencia = require('../models/secuencia');

const ESTADOS_VALIDOS = ['PENDIENTE', 'DEUDOR', 'PAGADO', 'CANCELADO'];

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
        const nombreCamiseta = limpiarTexto(item?.nombreCamiseta);
        const numero = limpiarTexto(item?.numero);
        const prenda = limpiarTexto(item?.prenda);
        const talle = limpiarTexto(item?.talle);
        const cantidad = item?.cantidad === undefined ? 1 : parsearImporte(item.cantidad, `cantidad del item ${index + 1}`);
        const precioUnitario = item?.precioUnitario === undefined ? 0 : parsearImporte(item.precioUnitario, `precioUnitario del item ${index + 1}`);
        const observaciones = limpiarTexto(item?.observaciones);

        if (!prenda) {
            throw new Error(`El item ${index + 1} debe incluir prenda`);
        }

        if (!talle) {
            throw new Error(`El item ${index + 1} debe incluir talle`);
        }

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error(`La cantidad del item ${index + 1} debe ser un entero mayor a 0`);
        }

        const subtotal = item?.subtotal === undefined
            ? cantidad * precioUnitario
            : parsearImporte(item.subtotal, `subtotal del item ${index + 1}`);

        return {
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
        const numeroRemito = await obtenerSiguienteNumeroRemito();
        const nuevoRemito = new Remito({
            ...payload,
            numeroRemito
        });

        await nuevoRemito.save();

        return res.status(201).json({
            msg: 'Remito creado correctamente',
            remito: nuevoRemito
        });
    } catch (error) {
        return res.status(400).json({ msg: error.message });
    }
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
            numeroRemitoFormateado
        } = req.query;
        const filtros = {};

        if (estado) {
            const estadoNormalizado = normalizarEstado(estado);
            if (!ESTADOS_VALIDOS.includes(estadoNormalizado)) {
                return res.status(400).json({ msg: `Estado invalido. Use: ${ESTADOS_VALIDOS.join(', ')}` });
            }
            filtros.estado = estadoNormalizado;
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

        const pageNumber = Math.max(1, Number(page) || 1);
        const limitNumber = Math.max(1, Number(limit) || 10);
        const skip = (pageNumber - 1) * limitNumber;

        const [total, remitos] = await Promise.all([
            Remito.countDocuments(filtros),
            Remito.find(filtros)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNumber)
        ]);

        return res.json({
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / limitNumber),
            remitos
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
            .filter((remito) => remito.estado !== 'CANCELADO')
            .reduce((acumulado, remito) => acumulado + Number(remito.importeTotal || 0), 0);

        return res.json({
            numeroCliente: numeroClienteLimpio,
            totalRemitos: remitos.length,
            totalPendientes: remitos.filter((remito) => remito.estado === 'PENDIENTE').length,
            totalDeudores: remitos.filter((remito) => remito.estado === 'DEUDOR').length,
            totalPagados: remitos.filter((remito) => remito.estado === 'PAGADO').length,
            totalCancelados: remitos.filter((remito) => remito.estado === 'CANCELADO').length,
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
        Object.assign(remito, payload);

        await remito.save();

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
