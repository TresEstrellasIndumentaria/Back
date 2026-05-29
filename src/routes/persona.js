const express = require('express');
const {
    traerPersonas,
    traePersonasRol,
    traerPersona,
    traerPersonaPorDni,
    modificarPersona,
    modificarProveedorCliente,
    actualizarPermisosEmpleado,
    resetPasswordEmpleado,
    eliminarPersona,
    modificarMisDatos
} = require('../controllers/persona');
const verifyToken = require("../middlewares/verifyToken");
const isAdmin = require("../middlewares/isAdmin");

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
router.put(
    '/modifica/:id',
    verifyToken,
    isAdmin,
    modificarPersona
);

// modificar proveedor/cliente sin password
router.put(
    '/modifica-cliente-proveedor/:id',
    verifyToken,
    isAdmin,
    modificarProveedorCliente
);

router.put(
    '/:id/permisos',
    verifyToken,
    isAdmin,
    actualizarPermisosEmpleado
);

router.put(
    '/:id/reset-password',
    verifyToken,
    isAdmin,
    resetPasswordEmpleado
);

//eliminar usuario
router.delete('/eliminar/:id', verifyToken, isAdmin, eliminarPersona);

//modif datos personales, solo pass usuario logueado
router.put('/mis-datos', verifyToken, modificarMisDatos);

module.exports = router;
