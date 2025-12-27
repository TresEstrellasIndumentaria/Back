const jwt = require("jsonwebtoken");
const UsuarioAuth = require("../models/usuarioAuth");

const auth = async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ message: "Token requerido" });
        }

        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await UsuarioAuth.findById(decoded.id);
        if (!user || !user.activo) {
            return res.status(401).json({ message: "Usuario no válido" });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido" });
    }
};

module.exports = auth;
