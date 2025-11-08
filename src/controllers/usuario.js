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
        const { id } = req.params;

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
        const usuario = await Usuario.findOne({ dni });
        if (!usuario) {
            return res.status(404).json({ msg: 'El DNI no está registrado' });
        }
        res.json(usuario);
    } catch (error) {
        console.error('Error al traer el usuario:', error);
        res.status(500).json({
            msg: 'Error al traer el usuario'
        });
    }
}

//modificar usuario
const modificarUsuario = async (req, res) => {
    try {
        const { id } = req.params; 
        const { nombre, apellido, dni, email, password, telefono, direccion, isAdmin } = req.body;

        const usuario = await Usuario.findById(id); console.log("UserTraido: ", usuario)
        if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

        // Verificar duplicados (sin contar el mismo usuario)
        const emailLower = email?.trim().toLowerCase();
        const nombreLower = nombre?.trim().toLowerCase();
        const apellidoLower = apellido?.trim().toLowerCase();

        const existeEmail = await Usuario.findOne({
            _id: { $ne: id },
            email: { $regex: new RegExp(`^${emailLower}$`, 'i') },
        });
        if (existeEmail) return res.status(400).json({ message: `Ya existe otro usuario con el email: ${email}` });

        const existeDNI = await Usuario.findOne({ _id: { $ne: id }, dni });
        if (existeDNI) return res.status(400).json({ message: `Ya existe otro usuario con el DNI: ${dni}` });

        const existeTel = await Usuario.findOne({
            _id: { $ne: id },
            "telefono.numero": telefono?.numero
        });
        if (existeTel)
            return res.status(400).json({ message: `Ya existe otro usuario con el teléfono: ${telefono?.numero}` });

        // Si se envía password nueva, la encripta
        let passwordEncript = usuario.password;
        if (password && password.trim() !== "") {
            if (!process.env.PASS_SEC)
                return res.status(500).json({ message: "Error en configuración del servidor" });
            passwordEncript = CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString();
        }

        // Actualiza los campos
        usuario.nombre = nombre || usuario.nombre;
        usuario.apellido = apellido || usuario.apellido;
        usuario.dni = dni || usuario.dni;
        usuario.email = emailLower || usuario.email;
        usuario.password = passwordEncript;
        usuario.telefono = telefono || usuario.telefono;
        usuario.direccion = direccion || usuario.direccion;
        usuario.isAdmin = isAdmin ?? usuario.isAdmin;
        usuario.nombreApellido = `${usuario.nombre} ${usuario.apellido}`;

        await usuario.save();

        return res.status(200).json({
            message: "Usuario modificado correctamente",
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                isAdmin: usuario.isAdmin
            }
        });

    } catch (error) {
        console.error("Error al modificar usuario:", error);
        return res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
};

// eliminar usuario
const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await Usuario.findByIdAndDelete(id);

        if (!usuario) {
            return res.status(404).json({
                message: 'Usuario no encontrado'
            });
        }

        res.status(200).json({
            message: 'Usuario eliminado correctamente',
            idEliminado: id
        });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({
            message: 'Error al eliminar el usuario',
            error: error.message
        });
    }
};


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