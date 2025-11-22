const express = require('express');
const { 
    traerUsuarios, traerUsuario, traerUsuarioPorDni, modificarUsuario, 
    eliminarUsuario, modificarPassword,
    traeUsuariosRol
} = require('../controllers/usuario');

const router = express.Router();


//trae usuarios
router.get('/', traerUsuarios);

//trae usuario por id
router.get('/:id', traerUsuario);

//trea por rol
router.get('/rol/:rol', traeUsuariosRol);

//trae usuario por dni
router.get('/dni/:dni', traerUsuarioPorDni);

//modificar usuario
router.put('/modifica/:id', modificarUsuario);

//modif pass
router.put('/modificaPass/:id', modificarPassword);

//eliminar usuario
router.delete('/eliminar/:id', eliminarUsuario);



module.exports = router;