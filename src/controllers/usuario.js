const mongoose = require('mongoose');
const Usuario = require('../models/usuario');
const CryptoJS = require('crypto-js');

//trae usuarios 
const traerUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find();
        res.json(usuarios);
    } catch (error) {
        console.error('Error al traer los usuarios:', error);
        res.status(500).json({
            msg: 'Error al traer los usuarios'
        });        
    }
}

//traer usuario por id
const traerUsuario = async (req, res) => { 
    try {
        const { id } = req.params; console.log("id: ", id)

        // Verificar si el ID es válido
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'El ID proporcionado no es válido.' });
        }

        const usuario = await Usuario.findById(id);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.status(200).json(usuario);
    } catch (error) {
        console.error('Error al traer el usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

//trae usuario por DNI
const traerUsuarioPorDni = async (req, res) => {
    const { dni } = req.params;    
    try {
        const usuario = await Usuario.findOne({dni});
        if(!usuario){
            return res.status(404).json({msg: 'El DNI no está registrado'});
        }
        res.json(usuario); 
    }catch (error) {
        console.error('Error al traer el usuario:', error);
        res.status(500).json({
            msg: 'Error al traer el usuario'
        });        
    }
}

//modificar usuario
const modificarUsuario = async (req, res) => {
    const { id } = req.params; 
    const { 
        nombre, apellido, dni, 
        email, direccion, telefono, 
        comentarios, isAdmin 
    } = req.body; 
    
    try {
        //realizo la modif
        const usuario = await Usuario.findByIdAndUpdate(id, {
            nombre,
            apellido,
            dni,
            email,
            direccion,
            telefono,
            comentarios,
        });
        usuario.save();

        if (!usuario) {
            return res.status(404).json({
                msg: 'Usuario no encontrado'
            });
        }

        res.json({ msg: 'success' });
    } catch (error) {
        console.error('Error al modificar el usuario:', error);
        res.status(500).json({
            msg: 'Error al modificar el usuario'
        });
    }
}

//eliminar usuario
const eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    const usuario = await Usuario.findByIdAndDelete(id);

    if (!usuario) {
        return res.status(404).json({
            msg: 'Usuario no encontrado'
        });
    }

    res.json({ msg: 'Usuario eliminado' });
}

//modificar contraseña
const modificarPassword = async (req, res) => {
    const { id } = req.params;
    let { password } = req.body;

    // Verificar si password es válido
    if (!password || typeof password !== "string") {
        return res.status(400).json({ msg: "Contraseña inválida" });
    }

    // Verificar si la clave secreta está definida
    if (!process.env.PASS_SEC) {
        console.error("Error: SECRET_KEY no está definida en el archivo de entorno.");
        return res.status(500).json({ msg: "Error del servidor: Clave secreta no definida" });
    }

    try {
        // Encriptar la contraseña
        const passwordEncriptada = CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString();

        // Actualizar el usuario
        const usuario = await Usuario.findByIdAndUpdate(
            id,
            { password: passwordEncriptada },
            { new: true } // Devuelve el usuario actualizado
        );

        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        res.json({ msg: 'success' });
    } catch (error) {
        console.error('Error al modificar el usuario:', error);
        res.status(500).json({ msg: 'Contraseña incorrecta' });
    }
};


module.exports = {
    traerUsuarios,
    traerUsuario,
    traerUsuarioPorDni,
    modificarUsuario,
    eliminarUsuario,
    modificarPassword
}