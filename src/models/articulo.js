const { Schema, model } = require('mongoose');

const ArticuloSchema = new Schema(
    {
        nombre: {
            type: String,
            required: true
        },

        codigoArticulo: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
            index: true
        },

        categoria: {
            type: Schema.Types.ObjectId,
            ref: 'Categoria'
        },

        descripcion: String,

        itemProveedor: {
            type: Boolean,
            default: false
        },

        stock: {
            type: Number,
            default: 0
        },

        ultimoCostoCompra: {
            type: Number,
            default: 0,
            min: 0
        },

        talles: [
            {
                talle: {
                    type: String,
                    trim: true,
                    default: ''
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
                        talle: {
                            type: String,
                            trim: true,
                            default: ''
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
                    default: 0
                }
            }
        ],
    },
    {
        timestamps: true
    }
);

module.exports = model('Articulo', ArticuloSchema);
