const mongoose = require('mongoose');
const Usuario = require('../models/persona');
const UsuarioAuth = require('../models/usuarioAuth');
const CryptoJS = require('crypto-js');


//trae usuarios 
const traerPersonas = async (req, res) => {
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

// trae por ROL
const traePersonasRol = async (req, res) => {
    try {
        const { rol } = req.params; // ← ahora sí es string

        if (!rol) {
            return res.status(400).json({
                msg: "Debe enviar un rol",
            });
        }

        const usuarios = await Usuario.find({
            rol: rol.toUpperCase(), // IMPORTANTE
        });

        if (!usuarios.length) {
            return res.status(404).json({
                msg: `No se encontraron usuarios con el rol: ${rol}`,
            });
        }

        res.json(usuarios);
    } catch (error) {
        console.error("Error al traer usuarios por rol:", error);
        res.status(500).json({
            msg: "Error al traer usuarios por rol",
        });
    }
};

//traer usuario por id
const traerPersona = async (req, res) => {
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
const traerPersonaPorDni = async (req, res) => {
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
const modificarPersona = async (req, res) => {
    try {
        const { id } = req.params;
        const { password, telefono, direccion, nota, } = req.body;

        const usuario = await Usuario.findById({ _id: id });
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Password
        if (password && password.trim() !== "") {
            if (!process.env.PASS_SEC) {
                return res.status(500).json({ message: "Error de configuración" });
            }
            usuario.password = CryptoJS.AES.encrypt(
                password,
                process.env.PASS_SEC
            ).toString();
        }

        // Campos permitidos
        if (telefono) usuario.telefono = telefono;
        if (direccion) usuario.direccion = direccion;
        if (nota) usuario.nota = nota;

        await usuario.save();

        return res.status(200).json({
            message: "Usuario modificado correctamente",
        });

    } catch (error) {
        console.error("Error al modificar usuario:", error);
        return res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// modificar proveedor/cliente (sin password)
const modificarProveedorCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            apellido,
            dni,
            email,
            telefono,
            direccion,
            nota
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: 'El ID proporcionado no es valido.' });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        if (!['CLIENTE', 'PROVEEDOR'].includes(usuario.rol)) {
            return res.status(400).json({
                msg: 'Este endpoint solo permite modificar CLIENTE o PROVEEDOR'
            });
        }

        if (req.body.password !== undefined) {
            return res.status(400).json({
                msg: 'No se permite modificar password en este endpoint'
            });
        }

        if (nombre !== undefined) usuario.nombre = nombre;
        if (apellido !== undefined) usuario.apellido = apellido;
        if (telefono !== undefined) usuario.telefono = telefono;
        if (direccion !== undefined) usuario.direccion = direccion;
        if (nota !== undefined) usuario.nota = nota;

        if (dni !== undefined) {
            const dniNum = Number(dni);
            if (!Number.isFinite(dniNum)) {
                return res.status(400).json({ msg: 'DNI invalido' });
            }
            usuario.dni = dniNum;
        }

        if (email !== undefined) {
            const emailNormalizado = String(email).trim().toLowerCase();
            if (!emailNormalizado) {
                return res.status(400).json({ msg: 'Email invalido' });
            }

            const emailExistente = await Usuario.findOne({
                email: emailNormalizado,
                _id: { $ne: usuario._id }
            });

            if (emailExistente) {
                return res.status(400).json({ msg: 'El email ya esta en uso' });
            }

            usuario.email = emailNormalizado;
        }

        await usuario.save();

        return res.status(200).json({
            msg: 'Proveedor/cliente modificado correctamente',
            usuario
        });
    } catch (error) {
        console.error('Error al modificar proveedor/cliente:', error);
        return res.status(500).json({
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

// eliminar usuario
const eliminarPersona = async (req, res) => {
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

//modificar datos personales - el usuario logueado PUEDE modif su pass y email
const modificarMisDatos = async (req, res) => {
    try {
        const { id } = req.user; // 👈 UsuarioAuth._id

        const { passwordActual, passwordNueva } = req.body;

        const usuario = await UsuarioAuth.findById(id);
        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        // PASSWORD
        if (passwordNueva) {
            if (!passwordActual) {
                return res.status(400).json({
                    msg: 'Debe ingresar la contraseña actual'
                });
            }

            const passwordDB = CryptoJS.AES.decrypt(
                usuario.password,
                process.env.PASS_SEC
            ).toString(CryptoJS.enc.Utf8);

            if (passwordDB !== passwordActual) {
                return res.status(400).json({
                    msg: 'Contraseña actual incorrecta'
                });
            }

            usuario.password = CryptoJS.AES.encrypt(
                passwordNueva,
                process.env.PASS_SEC
            ).toString();
        }

        await usuario.save();

        res.json({ msg: 'Datos actualizados correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};



module.exports = {
    traerPersonas,
    traePersonasRol,
    traerPersona,
    traerPersonaPorDni,
    modificarPersona,
    modificarProveedorCliente,
    eliminarPersona,
    modificarMisDatos
}



/* 

Próximo paso (vos elegís)

1️⃣ Agregar confirmación modal antes de guardar
2️⃣ Forzar logout si cambia el password
3️⃣ Validaciones fuertes (regex password)
4️⃣ Integrarlo con Redux


*/
