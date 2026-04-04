const { Schema, model } = require('mongoose');

const CategoriaSchema = Schema({
    nombre: {
        type: String,
        required: true
    },
    nombreNormalizado: {
        type: String,
        required: true,
        unique: true
    },
    cantidadArticulos: {
        type: Number,
        default: 0
    },
    esProveedor: {
        type: Boolean,
        default: false
    }
});

module.exports = model('Categoria', CategoriaSchema);
