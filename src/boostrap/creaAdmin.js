const Persona = require("../models/persona");
const UsuarioAuth = require("../models/usuarioAuth");
const CryptoJS = require("crypto-js");

const createAdminIfNotExists = async () => {
    try {
        const existeAdmin = await UsuarioAuth.findOne({
            roles: { $in: ["ADMIN"] },
        });

        if (existeAdmin) {
            console.log("✔ Admin ya existe");
            return;
        }

        console.log("⚠ No existe ADMIN, creando uno por defecto...");

        // 1️⃣ Crear Persona
        const persona = await Persona.create({
            nombre: "Marcos",
            apellido: "Forastiere",
            dni: 29979518,
            email: process.env.INIT_ADMIN_EMAIL,
            telefono: 123456,
            direccion: "asdad",
            roles: ["ADMIN"]
        });

        // 2️⃣ Encriptar password (ANTES de usarlo)
        const passwordEncript = CryptoJS.AES.encrypt(
            process.env.INIT_ADMIN_PASSWORD,
            process.env.PASS_SEC
        ).toString();

        // 3️⃣ Crear UsuarioAuth
        await UsuarioAuth.create({
            personaId: persona._id,
            email: process.env.INIT_ADMIN_EMAIL,
            password: passwordEncript,
            roles: ["ADMIN"],
        });

        console.log("✅ ADMIN creado correctamente");
    } catch (error) {
        console.error("❌ Error creando admin inicial:", error);
    }
};

module.exports = createAdminIfNotExists;
