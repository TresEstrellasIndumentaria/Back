const express = require('express');
const {
    traerCuentaCorrienteCliente,
    traerCuentaCorrienteProveedor
} = require('../controllers/cuentaCorriente');

const router = express.Router();

router.get('/cliente/:numeroCliente', traerCuentaCorrienteCliente);
router.get('/proveedor/:proveedorId', traerCuentaCorrienteProveedor);

module.exports = router;
