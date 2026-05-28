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
        },
        email: {
            type: String,
            trim: true,
            set: (value) => {
                const texto = String(value || '').trim().toLowerCase();
                return texto || undefined;
            },
        },
        password: {
            type: String,
        },
        numeroCliente: {
            type: String,
            trim: true
        },
        numeroProveedor: {
            type: String,
            trim: true
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

PersonaSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: { email: { $type: 'string' } }
    }
);

module.exports = model('Persona', PersonaSchema);
