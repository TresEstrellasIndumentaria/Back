const express = require('express');
const {
    crearPagoProveedor,
    traerPagosProveedor,
    traerPagoProveedor,
    traerPagosPorProveedor,
    modificarPagoProveedor,
    eliminarPagoProveedor
} = require('../controllers/pagoProveedor');

const router = express.Router();

router.post('/', crearPagoProveedor);
router.get('/', traerPagosProveedor);
router.get('/proveedor/:proveedorId', traerPagosPorProveedor);
router.get('/:id', traerPagoProveedor);
router.put('/modifica/:id', modificarPagoProveedor);
router.delete('/eliminar/:id', eliminarPagoProveedor);

module.exports = router;
