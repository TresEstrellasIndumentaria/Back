const { Schema, model } = require('mongoose');

const ArticuloSchema = new Schema(
    {
        nombre: {
            type: String,
            required: true
        },

        categoria: {
            type: Schema.Types.ObjectId,
            ref: 'Categoria'
        },

        descripcion: String,

        talles: [
            {
                talle: {
                    type: String,
                    required: true,
                    trim: true
                },
                ancho: {
                    type: String,
                    required: true,
                    trim: true
                },
                alto: {
                    type: String,
                    required: true,
                    trim: true
                },
                precio: {
                    type: Number,
                    required: true,
                    min: 0
                },
                coste: {
                    type: Number,
                    required: true,
                    min: 0
                },
                artCompuesto: {
                    type: Boolean,
                    default: false
                },
                composicion: [
                    {
                        articulo: {
                            type: Schema.Types.ObjectId,
                            ref: 'Articulo'
                        },
                        cantidad: {
                            type: Number,
                            default: 1
                        },
                        coste: {
                            type: Number,
                            default: 0
                        }
                    }
                ],
                stock: {
                    type: Number,
                    default: 0,
                    min: 0
                },
                entrantes: {
                    type: Number,
                    default: 0,
                    min: 0
                }
            }
        ],
    },
    {
        timestamps: true
    }
);

module.exports = model('Articulo', ArticuloSchema);
