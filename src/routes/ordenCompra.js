const express = require('express');
const router = express.Router();

const {
    crearOrdenCompra,
    modificarOrdenCompra,
    obtenerOrdenesCompra,
    obtenerOrdenCompraPorId,
    obtenerOrdenesPorProveedor,
    enviarOrdenCompra,
    actualizarEstadoOrdenCompra,
    cancelarOrdenCompra,
    eliminarOrdenCompra
} = require('../controllers/ordenDeCompra');
const verifyToken = require("../middlewares/verifyToken");
const isAdmin = require("../middlewares/isAdmin");

// middlewares
router.use(verifyToken);
router.use(isAdmin);


// Crear orden (DEUDOR)
router.post('/', crearOrdenCompra);
router.put('/:id', modificarOrdenCompra);
router.patch('/:id', modificarOrdenCompra);

// Listado paginado + filtros
// /api/ordenes-compra?page=1&limit=10&estado=DEUDOR&desde=2026-01-01&hasta=2026-01-31
router.get('/', obtenerOrdenesCompra);

// Órdenes por proveedor (poner primero esta ruta, )
router.get('/proveedor/:proveedorId', obtenerOrdenesPorProveedor);

// Orden por ID (detalle)
router.get('/:id', obtenerOrdenCompraPorId);

// Enviar orden (DEUDOR)
router.put('/:id/enviar', enviarOrdenCompra);

router.put('/:id/estado', actualizarEstadoOrdenCompra);
router.patch('/:id/estado', actualizarEstadoOrdenCompra);

// Cancelar orden (DEUDOR)
router.put('/:id/cancelar', cancelarOrdenCompra);

// Eliminar orden
router.delete('/eliminar/:id', eliminarOrdenCompra);
router.delete('/:id', eliminarOrdenCompra);

module.exports = router;
