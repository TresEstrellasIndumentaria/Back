const { Schema, model } = require('mongoose');

const ArticuloProveedorSchema = new Schema(
    {
        nombre: {
            type: String,
            required: true,
            trim: true
        },
        categoria: {
            type: String,
            required: true,
            trim: true
        },
        descripcion: {
            type: String,
            default: '',
            trim: true
        },
        precio: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = model('ArticuloProveedor', ArticuloProveedorSchema);
