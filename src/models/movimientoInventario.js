const { Schema, model } = require('mongoose');

const MovimientoInventarioSchema = new Schema(
    {
        fecha: { type: Date, default: Date.now },
        articulo: { type: Schema.Types.ObjectId, ref: 'Articulo', required: true },
        colaborador: { type: Schema.Types.ObjectId, ref: 'UsuarioAuth', required: false },
        tienda: { type: String, default: 'Liz' },
        talle: { type: String, default: '' },
        motivo: { type: String, default: '' },
        anotaciones: { type: String, default: '' },
        ajuste: { type: Number, required: true },      // delta (+/-)
        stockFinal: { type: Number, required: true },  // stock resultante
        coste: { type: Number, default: 0 }
    },
    { timestamps: true }
);

module.exports = model('MovimientoInventario', MovimientoInventarioSchema);
