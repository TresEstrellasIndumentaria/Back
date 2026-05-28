const Usuario = require('../models/persona');
const CryptoJS = require('crypto-js');

const normalizarTexto = (value) => String(value || '').trim();

const tieneTelefonoCliente = (telefono) => (
    Boolean(normalizarTexto(telefono?.area)) && Boolean(normalizarTexto(telefono?.numero))
);

// Crea usuario
const registrarse = async (req, res) => { console.log("data:", req.body)
    try {
        const {
            nombre,
            apellido,
            dni,
            email,
            password,
            foto,
            telefono,
            direccion,
            rol,
            rolAsignado
        } = req.body;

        const rolFinal = normalizarTexto(rol || rolAsignado || 'CLIENTE').toUpperCase();
        const esCliente = rolFinal === 'CLIENTE';
        const nombreTrim = normalizarTexto(nombre);
        const apellidoTrim = normalizarTexto(apellido);
        const dniTexto = normalizarTexto(dni);
        const emailLower = normalizarTexto(email).toLowerCase();

        if (!nombreTrim || !apellidoTrim || (esCliente && !tieneTelefonoCliente(telefono))) {
            return res.status(400).json({
                message: esCliente
                    ? 'Nombre, apellido, area y telefono son obligatorios'
                    : 'Faltan campos obligatorios'
            });
        }

        if (!esCliente && (!dniTexto || !emailLower || !normalizarTexto(password) || !tieneTelefonoCliente(telefono))) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        const nombreLower = nombreTrim.toLowerCase();
        const apellidoLower = apellidoTrim.toLowerCase();

        const existeNombreApellido = await Usuario.findOne({
            nombre: { $regex: new RegExp(`^${nombreLower}$`, 'i') },
            apellido: { $regex: new RegExp(`^${apellidoLower}$`, 'i') },
        });
        if (existeNombreApellido) {
            return res.status(400).json({
                message: `Ya existe un usuario con el nombre y apellido: ${nombreTrim} ${apellidoTrim}`
            });
        }

        if (emailLower) {
            const existeEmail = await Usuario.findOne({
                email: { $regex: new RegExp(`^${emailLower}$`, 'i') },
            });
            if (existeEmail) {
                return res.status(400).json({
                    message: `Ya existe un usuario con el email: ${email}`
                });
            }
        }

        if (dniTexto) {
            const existeDNI = await Usuario.findOne({ dni: Number(dniTexto) });
            if (existeDNI) {
                return res.status(400).json({
                    message: `Ya existe un usuario con el DNI: ${dni}`
                });
            }
        }

        const existeTel = await Usuario.findOne({ 'telefono.numero': telefono.numero });
        if (existeTel) {
            return res.status(400).json({
                message: `Ya existe un usuario con el telefono: ${telefono.numero}`
            });
        }

        if (password && !process.env.PASS_SEC) {
            console.error('Falta la variable PASS_SEC en el archivo .env');
            return res.status(500).json({
                message: 'Error en configuracion del servidor. Faltan variables de entorno.'
            });
        }

        const passwordEncript = password
            ? CryptoJS.AES.encrypt(password, process.env.PASS_SEC).toString()
            : undefined;

        const newUsuario = new Usuario({
            nombre: nombreTrim,
            apellido: apellidoTrim,
            dni: dniTexto ? Number(dniTexto) : undefined,
            email: emailLower || undefined,
            password: passwordEncript,
            foto: foto || '',
            telefono: {
                area: normalizarTexto(telefono?.area),
                numero: normalizarTexto(telefono?.numero)
            },
            direccion,
            rol: rolFinal,
            nombreApellido: `${nombreTrim} ${apellidoTrim}`,
        });

        await newUsuario.save();

        return res.status(201).json({
            message: 'Usuario creado correctamente',
            usuario: {
                id: newUsuario._id,
                nombre: newUsuario.nombre,
                apellido: newUsuario.apellido,
                email: newUsuario.email,
                rol: newUsuario.rol
            }
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = { registrarse };
