const { Schema, model } = require('mongoose');

const ArticuloSchema = Schema({
    nombre: {
        type: String,
        required: true
    },
    categoria: {
        type: String,
        
    },
    descripcion: {
        type: String,
    },
    vendidoPor: {
        type: String, //unidad o peso/volumen
        
    },
    precio: {
        type: Number,
        required: true
    },
    coste: {
        type: Number,
        required: true
    },
    artCompuesto: {
        type: Boolean,
    },
    //composición va a traer, ejem: tela, sublimado, costura [todo en moneda PESOS] 
    composicion: {
        type: Array
    }
});

module.exports = model('Articulo', ArticuloSchema);