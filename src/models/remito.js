const mongoose = require('mongoose');

const pedidoItemSchema = new mongoose.Schema(
    {
        nombreCamiseta: {
            type: String,
            trim: true,
            default: ''
        },
        numero: {
            type: String,
            trim: true,
            default: ''
        },
        prenda: {
            type: String,
            required: true,
            trim: true
        },
        talle: {
            type: String,
            required: true,
            trim: true
        },
        cantidad: {
            type: Number,
            min: 1,
            default: 1
        },
        precioUnitario: {
            type: Number,
            min: 0,
            default: 0
        },
        subtotal: {
            type: Number,
            min: 0,
            default: 0
        },
        observaciones: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { _id: false }
);

const remitoSchema = new mongoose.Schema(
    {
        numeroRemito: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        numeroCliente: {
            type: String,
            required: true,
            trim: true
        },
        razonSocial: {
            type: String,
            trim: true,
            default: ''
        },
        nombreApellido: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: ''
        },
        telefono: {
            type: String,
            trim: true,
            default: ''
        },
        cuit: {
            type: String,
            trim: true,
            default: ''
        },
        estado: {
            type: String,
            enum: ['PENDIENTE', 'DEUDOR', 'PAGADO', 'CANCELADO'],
            default: 'PENDIENTE'
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        descuento: {
            type: Number,
            min: 0,
            default: 0
        },
        importeTotal: {
            type: Number,
            required: true,
            min: 0
        },
        pedido: {
            type: [pedidoItemSchema],
            validate: {
                validator: Array.isArray,
                message: 'pedido debe ser un arreglo'
            },
            default: []
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

remitoSchema.virtual('numeroRemitoFormateado').get(function () {
    return `R-${String(this.numeroRemito || 0).padStart(6, '0')}`;
});

module.exports = mongoose.model('Remito', remitoSchema);
