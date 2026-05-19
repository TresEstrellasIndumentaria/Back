const mongoose = require('mongoose');

const pagoProveedorSchema = new mongoose.Schema(
    {
        numeroPago: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        proveedor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Persona',
            required: true,
            index: true
        },
        nombreProveedor: {
            type: String,
            required: true,
            trim: true
        },
        razonSocial: {
            type: String,
            trim: true,
            default: ''
        },
        importe: {
            type: Number,
            required: true,
            min: 0
        },
        fechaPago: {
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

pagoProveedorSchema.virtual('numeroPagoFormateado').get(function () {
    return `PP-${String(this.numeroPago || 0).padStart(6, '0')}`;
});

module.exports = mongoose.model('PagoProveedor', pagoProveedorSchema);
