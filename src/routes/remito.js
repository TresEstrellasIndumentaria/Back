const express = require('express');
const {
    crearRemito,
    traerRemitos,
    traerRemito,
    traerRemitoPorNumero,
    traerRemitosPorCliente,
    modificarRemito,
    actualizarEstadoRemito,
    eliminarRemito
} = require('../controllers/remito');

const router = express.Router();

router.post('/', crearRemito);
router.get('/', traerRemitos);
router.get('/cliente/:numeroCliente', traerRemitosPorCliente);
router.get('/numero/:numeroRemito', traerRemitoPorNumero);
router.get('/:id', traerRemito);
router.put('/modifica/:id', modificarRemito);
router.patch('/:id/estado', actualizarEstadoRemito);
router.put('/:id/estado', actualizarEstadoRemito);
router.delete('/eliminar/:id', eliminarRemito);

module.exports = router;
