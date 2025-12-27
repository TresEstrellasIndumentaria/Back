const { Schema, model } = require('mongoose');

const PersonaSchema = Schema({
    nombre: {
        type: String,
        required: true
    },
    apellido: {
        type: String,
        required: true
    },
    dni: {
        type: Number,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    telefono: {
        type: Object,
    },
    direccion: {
        type: Object,
    },
    nota: { type: String, },
    nombreApellido: { type: String, },
    roles: {
        type: [String],
        enum: ["ADMIN", "EMPLEADO", "CLIENTE", "PROVEEDOR"],
        default: ["CLIENTE"],
    },
},
    { timestamps: true }
);

module.exports = model('Persona', PersonaSchema);