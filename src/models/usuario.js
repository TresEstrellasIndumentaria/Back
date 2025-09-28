const { Schema, model } = require('mongoose');

const UsuarioSchema = Schema({
    nombre: {
        type: String,
        required: true
    },
    apellido: {
        type: String,
    },
    dni: { 
        type: Number,
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    foto: {
        type: String,
    },
    telefono: {
        type: Object,
    },
    direccion: {
        type: Object,
    },
    favoritos: {
        type: Array,
        default: []
    },
    rol: {
        type: String,
    },
});

module.exports = model('Usuario', UsuarioSchema);