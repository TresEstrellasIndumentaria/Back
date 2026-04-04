const express = require('express');
const {
    traerArticulosProveedor,
    traerArticuloProveedor,
    crearArticuloProveedor,
    modificarArticuloProveedor,
    eliminarArticuloProveedor
} = require('../controllers/articuloProveedor');

const router = express.Router();

router.post('/', crearArticuloProveedor);
router.get('/', traerArticulosProveedor);
router.get('/:id', traerArticuloProveedor);
router.put('/modifica/:id', modificarArticuloProveedor);
router.delete('/eliminar/:id', eliminarArticuloProveedor);

module.exports = router;
