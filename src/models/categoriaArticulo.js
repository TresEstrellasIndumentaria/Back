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
    }
});

module.exports = model('Categoria', CategoriaSchema);