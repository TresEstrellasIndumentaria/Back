const { Schema, model } = require('mongoose');

const PersonaSchema = new Schema(
    {
        nombre: {
            type: String,
            required: true,
        },
        apellido: {
            type: String,
            required: true,
        },
        dni: {
            type: Number,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
        },
        numeroCliente: {
            type: Number
        },
        numeroProveedor: {
            type: Number
        },
        razonSocial: {
            type: String,
        },
        telefono: {
            type: Object,
        },
        direccion: {
            type: Object,
        },
        nota: {
            type: String,
        },
        nombreApellido: {
            type: String,
        },
        rol: {
            type: String,
            enum: ["ADMIN", "EMPLEADO", "CLIENTE", "PROVEEDOR"],
            required: true,
        },
        permisos: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports = model('Persona', PersonaSchema);
