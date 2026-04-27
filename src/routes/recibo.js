const express = require('express');
const {
    crearRecibo,
    traerRecibos,
    traerRecibo,
    traerRecibosPorCliente,
    modificarRecibo,
    eliminarRecibo
} = require('../controllers/recibo');

const router = express.Router();

// crear
router.post('/', crearRecibo);

// traer todos
router.get('/', traerRecibos);

// traer por cliente
router.get('/cliente/:numeroCliente', traerRecibosPorCliente);

// traer por id
router.get('/:id', traerRecibo);

// modificar
router.put('/modifica/:id', modificarRecibo);

// eliminar
router.delete('/eliminar/:id', eliminarRecibo);

module.exports = router;
