const express = require('express');
const router = express.Router();

const {
    crearOrdenCompra,
    obtenerOrdenesCompra,
    obtenerOrdenCompraPorId,
    obtenerOrdenesPorProveedor,
    enviarOrdenCompra,
    recibirOrdenCompra,
    actualizarEstadoOrdenCompra,
    cancelarOrdenCompra
} = require('../controllers/ordenDeCompra');
const verifyToken = require("../middlewares/verifyToken");
const isAdmin = require("../middlewares/isAdmin");

// middlewares
router.use(verifyToken);
router.use(isAdmin);


// Crear orden (BORRADOR)
router.post('/', crearOrdenCompra);

// Listado paginado + filtros
// /api/ordenes-compra?page=1&limit=10&estado=ENVIADA&desde=2026-01-01&hasta=2026-01-31
router.get('/', obtenerOrdenesCompra);

// Órdenes por proveedor (poner primero esta ruta, )
router.get('/proveedor/:proveedorId', obtenerOrdenesPorProveedor);

// Orden por ID (detalle)
router.get('/:id', obtenerOrdenCompraPorId);

// Enviar orden (BORRADOR → ENVIADA)
router.put('/:id/enviar', enviarOrdenCompra);

// Recibir orden (ENVIADA → RECIBIDA)
router.put('/:id/recibir', recibirOrdenCompra);
router.patch('/:id/recibir', recibirOrdenCompra);
router.put('/:id/estado', actualizarEstadoOrdenCompra);
router.patch('/:id/estado', actualizarEstadoOrdenCompra);

// Cancelar orden (BORRADOR / ENVIADA → CANCELADA)
router.put('/:id/cancelar', cancelarOrdenCompra);

module.exports = router;


/* 
opcion de permisos

const express = require('express');
const router = express.Router();

const {
  crearOrdenCompra,
  obtenerOrdenesCompra,
  obtenerOrdenCompraPorId,
  obtenerOrdenesPorProveedor,
  enviarOrdenCompra,
  recibirOrdenCompra,
  cancelarOrdenCompra
} = require('../controllers/ordenCompra.controller');

const verifyToken = require("../middlewares/verifyToken");
const isAdmin = require("../middlewares/isAdmin");

// autenticación global
router.use(verifyToken);

// lectura
router.get('/', obtenerOrdenesCompra);
router.get('/proveedor/:proveedorId', obtenerOrdenesPorProveedor);
router.get('/:id', obtenerOrdenCompraPorId);

// administración
router.post('/', isAdmin, crearOrdenCompra);
router.put('/:id/enviar', isAdmin, enviarOrdenCompra);
router.put('/:id/recibir', isAdmin, recibirOrdenCompra);
router.put('/:id/cancelar', isAdmin, cancelarOrdenCompra);

module.exports = router;



*/
