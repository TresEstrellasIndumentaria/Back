const express = require('express');
const {
    crearArticulo,
    traerArticulos,
    traerArticulo,
    modificarArticulo,
    eliminarArticulo,
    modificarStockArticulo,
    obtenerHistorialInventario
} = require('../controllers/articulo');
const verifyToken = require('../middlewares/verifyToken');
const isAdmin = require('../middlewares/isAdmin');

const router = express.Router();

// crea art
router.post("/", crearArticulo);

// historial
router.get('/historial-inventario', verifyToken, isAdmin, obtenerHistorialInventario);

// trae todos
router.get('/', traerArticulos);

// trae por id
router.get('/:id', traerArticulo);

// modificar
router.put('/modifica/:id', modificarArticulo);

// modificar stock
router.put('/:id/stock', modificarStockArticulo);
router.patch('/:id/stock', modificarStockArticulo);

// eliminar art
router.delete('/eliminar/:id', eliminarArticulo);

module.exports = router;
