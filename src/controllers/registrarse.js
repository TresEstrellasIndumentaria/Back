const Usuario = require('../models/persona');
const CryptoJS = require('crypto-js');

// Crea usuario
const registrarse = async (req, res) => {
    try {
        const { nombre, apellido, dni, email, password, foto, telefono, direccion, rolAsignado } = req.body;
        //console.log("Data recibida:", req.body);

        // Validación de campos obligatorios
        if (
            !nombre?.trim() ||
            !apellido?.trim() ||
            !dni?.trim() ||
            !email?.trim() ||
            !password?.trim() ||
            !telefono?.area ||
            !telefono?.numero
        ) {
            return res.status(400).json({ message: "Faltan campos obligatorios" });
        }

        // Buscar duplicados (comparación sin mayúsculas/minúsculas)
        const nombreLower = nombre.trim().toLowerCase();
        const apellidoLower = apellido.trim().toLowerCase();
        const emailLower = email.trim().toLowerCase();

        const existeNombreApellido = await Usuario.findOne({
            nombre: { $regex: new RegExp(`^${nombreLower}$`, 'i') },
            apellido: { $regex: new RegExp(`^${apellidoLower}$`, 'i') },
        });
        if (existeNombreApellido) {
            return res.status(400).json({
                message: `Ya existe un usuario con el nombre y apellido: ${nombre} ${apellido}`
            });
        }

        const existeEmail = await Usuario.findOne({
            email: { $regex: new RegExp(`^${emailLower}$`, 'i') },
        });
        if (existeEmail) {
            return res.status(400).json({
                message: `Ya existe un usuario con el email: ${email}`
            });
        }

        const existeDNI = await Usuario.findOne({ dni });
        if (existeDNI) {
            return res.status(400).json({
                message: `Ya existe un usuario con el DNI: ${dni}`
            });
        }

        const existeTel = await Usuario.findOne({ "telefono.numero": telefono.numero });
        if (existeTel) {
            return res.status(400).json({
                message: `Ya existe un usuario con el teléfono: ${telefono.numero}`
            });
        }

        // Encriptar contraseña
        if (!process.env.PASS_SEC) {
            console.error("Falta la variable PASS_SEC en el archivo .env");
            return res.status(500).json({
                message: "Error en configuración del servidor. Faltan variables de entorno."
            });
        }

        const passwordEncript = CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString();

        // Crear nuevo usuario
        const newUsuario = new Usuario({
            nombre,
            apellido,
            dni,
            email: emailLower,
            password: passwordEncript,
            foto: foto || "",
            telefono,
            direccion,
            rolAsignado,
            nombreApellido: `${nombre} ${apellido}`,
        });

        await newUsuario.save();

        return res.status(201).json({
            message: "Usuario creado correctamente",
            usuario: {
                id: newUsuario._id,
                nombre: newUsuario.nombre,
                apellido: newUsuario.apellido,
                email: newUsuario.email,
                rolAsignado: newUsuario.rolAsignado
            }
        });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        return res.status(500).json({
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

module.exports = { registrarse };
