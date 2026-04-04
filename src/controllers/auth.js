const Persona = require("../models/persona");
const UsuarioAuth = require("../models/usuarioAuth");
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');


//login clásico
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await UsuarioAuth.findOne({ email })
            .populate("personaId");

        if (!user || !user.activo) {
            return res.status(401).json({
                message: "Email incorrecto"
            });
        }

        const hashedPassword = CryptoJS.AES.decrypt(
            user.password,
            process.env.PASS_SEC
        );

        const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);

        if (originalPassword !== password) {
            return res.status(401).json({
                message: "Contraseña incorrecta"
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                roles: user.roles,
            },
            process.env.JWT_SEC,
            //{ expiresIn: "8h" }
        );

        const persona = user.personaId;

        return res.status(200).json({
            message: "ok",
            user: {
                id: user._id,
                personaId: persona._id,
                email: user.email,
                nombre: persona.nombre,
                apellido: persona.apellido,
                telefono: persona.telefono,
                direccion: persona.direccion,
                roles: user.roles,
                token
            }
        });

    } catch (error) {
        console.error("Error login:", error);
        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
};


//registrar usuarios
const registrar = async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            dni,
            email,
            password,
            telefono,
            direccion,
            nota,
            rol = "CLIENTE" // default
        } = req.body;

        // Validaciones básicas
        if (!nombre || !apellido || !dni || !email) {
            return res.status(400).json({
                message: "Faltan campos obligatorios"
            });
        }

        const emailLower = email.trim().toLowerCase();
        const rolUpper = rol.toUpperCase();

        // Validar rol permitido
        const rolesPermitidos = ["ADMIN", "EMPLEADO", "CLIENTE", "PROVEEDOR"];
        if (!rolesPermitidos.includes(rolUpper)) {
            return res.status(400).json({
                message: "Rol inválido"
            });
        }

        // Verificar duplicados
        const existePersona = await Persona.findOne({
            $or: [{ dni }, { email: emailLower }]
        });

        if (existePersona) {
            return res.status(400).json({
                message: "Ya existe una persona con ese DNI o email"
            });
        }

        // Crear Persona
        const persona = await Persona.create({
            nombre,
            apellido,
            dni,
            email: emailLower,
            telefono,
            direccion,
            nota,
            rol: rolUpper,
            nombreApellido: `${nombre} ${apellido}`
        });

        // Crear UsuarioAuth SOLO si es usuario del sistema
        let usuarioAuth = null;
        const esUsuarioSistema = rolUpper === "ADMIN" || rolUpper === "EMPLEADO";

        if (esUsuarioSistema) {
            if (!password) {
                return res.status(400).json({
                    message: "Password obligatorio para usuarios del sistema"
                });
            }

            const passwordEncript = CryptoJS.AES.encrypt(
                password,
                process.env.PASS_SEC
            ).toString();

            usuarioAuth = await UsuarioAuth.create({
                personaId: persona._id,
                email: emailLower,
                password: passwordEncript,
                rol: rolUpper
            });
        }

        return res.status(201).json({
            message: "Registro exitoso",
            persona,
            usuarioAuth
        });

    } catch (error) {
        console.error("Error al registrar:", error);
        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
};


module.exports = {
    login,
    registrar
}
