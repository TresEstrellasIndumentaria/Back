const express = require('express');
const { 
    traerPersonas,
    traePersonasRol,
    traerPersona,
    traerPersonaPorDni,
    modificarPersona,
    eliminarPersona,
    modificarPassword
} = require('../controllers/persona');

const router = express.Router();


//trae usuarios
router.get('/', traerPersonas);

//trae usuario por id
router.get('/:id', traerPersona);

//trea por rol
router.get('/rol/:rol', traePersonasRol);

//trae usuario por dni
router.get('/dni/:dni', traerPersonaPorDni);

//modificar usuario
router.put('/modifica/:id', modificarPersona);

//modif pass
router.put('/modificaPass/:id', modificarPassword);

//eliminar usuario
router.delete('/eliminar/:id', eliminarPersona);



module.exports = router;