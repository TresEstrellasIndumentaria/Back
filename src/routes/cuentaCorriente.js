const express = require('express');
const { traerCuentaCorrienteCliente } = require('../controllers/cuentaCorriente');

const router = express.Router();

router.get('/cliente/:numeroCliente', traerCuentaCorrienteCliente);

module.exports = router;
