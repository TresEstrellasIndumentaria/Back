const express = require('express');
const { crearArticulo, traerArticulos, traerArticulo, modificarArticulo, eliminarArticulo } = require('../controllers/articulo');

const router = express.Router();

//crea art
router.post("/", crearArticulo);

//trae todos
router.get('/', traerArticulos);

//trae  por id
router.get('/:id', traerArticulo);

//modificar 
router.put('/modifica/:id', modificarArticulo);

//eliminar art
router.delete('/eliminar/:id', eliminarArticulo);

module.exports = router;