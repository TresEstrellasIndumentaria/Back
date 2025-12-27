const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ message: "Token no enviado" });
        }

        const token = authHeader.split(" ")[1]; // Bearer token

        const decoded = jwt.verify(token, process.env.JWT_SEC);

        req.user = decoded; // { id, roles }

        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o expirado" });
    }
};

module.exports = verifyToken;
