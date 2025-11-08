const { Schema, model } = require('mongoose');

const UsuarioSchema = Schema({
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
    nombreApellido: {type: String,},
    rol:{type: String}
});

module.exports = model('Usuario', UsuarioSchema);