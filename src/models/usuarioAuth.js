const mongoose = require("mongoose");

const UsuarioAuthSchema = new mongoose.Schema(
    {
        personaId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Persona",
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        roles: {
            type: [String],
            enum: ["ADMIN", "EMPLEADO"],
            required: true,
        },
        activo: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("UsuarioAuth", UsuarioAuthSchema);
