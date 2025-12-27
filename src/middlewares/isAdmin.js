const isAdmin = (req, res, next) => {
    try {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ message: "Acceso denegado" });
        }

        if (!req.user.roles.includes("ADMIN")) {
            return res
                .status(403)
                .json({ message: "Solo un ADMIN puede realizar esta acción" });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Error en validación de rol" });
    }
};

module.exports = isAdmin;
