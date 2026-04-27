const mongoose = require('mongoose');

const reciboSchema = new mongoose.Schema(
    {
        numeroRecibo: {
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
        importe: {
            type: Number,
            required: true,
            min: 0
        },
        fechaCobro: {
            type: Date,
            default: Date.now
        },
        medioPago: {
            type: String,
            trim: true,
            default: ''
        },
        observaciones: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

reciboSchema.virtual('numeroReciboFormateado').get(function () {
    return `RC-${String(this.numeroRecibo || 0).padStart(6, '0')}`;
});

module.exports = mongoose.model('Recibo', reciboSchema);
