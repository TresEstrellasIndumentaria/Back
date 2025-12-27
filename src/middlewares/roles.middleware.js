const allowRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        const tieneRol = req.user.roles.some((rol) =>
            rolesPermitidos.includes(rol)
        );

        if (!tieneRol) {
            return res.status(403).json({ message: "Acceso denegado" });
        }

        next();
    };
};

module.exports = allowRoles;
