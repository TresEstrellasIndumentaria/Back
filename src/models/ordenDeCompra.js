const mongoose = require('mongoose');
//¿Los items de la orden tienen su propio modelo?
//No, en este caso NO tienen su propio modelo ni colección. define un subdocumento embebido, no un modelo independiente.
//Solo existe el modelo OrdenCompra.NO existe una colección itemOrden en MongoDB
//¿Entonces dónde se guardan los items? Se guardan dentro del documento de la orden de compra, en el array items.
//Por defecto MongoDB le pone un _id a cada item del array.Vos lo desactivaste acá:

const itemOrdenSchema = new mongoose.Schema(
    {
        articulo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Articulo',
            required: true
        },

        talle: {
            type: String,
            trim: true,
            default: ''
        },

        stockActual: {
            type: Number,
            required: true
        },

        entrantes: {
            type: Number,
            default: 0
        },

        cantidad: {
            type: Number,
            required: true,
            min: 1
        },

        cantidadRecibida: {
            type: Number,
            default: 0,
            min: 0
        },

        coste: {
            type: Number,
            required: true
        },

        costoTotal: {
            type: Number,
            required: true
        }
    },
    { _id: false }
);

const ordenCompraSchema = new mongoose.Schema(
    {
        proveedor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Persona',
            required: function () {
                return this.estado !== 'BORRADOR';
            }
        },

        fechaOrden: {
            type: Date,
            default: Date.now
        },

        fechaEsperada: {
            type: Date
        },

        anotaciones: {
            type: String,
            trim: true
        },

        estado: {
            type: String,
            enum: ['BORRADOR', 'ENVIADA', 'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CANCELADA'],
            default: 'BORRADOR'
        },

        items: [itemOrdenSchema],

        totalOrden: {
            type: Number,
            required: function () {
                return this.estado !== 'BORRADOR';
            },
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('OrdenCompra', ordenCompraSchema);

/* 
ejem de una ORDEN

{
  "_id": "65a1f3...",
  "proveedor": "64ff9c...",
  "fechaOrden": "2026-01-10T12:30:00.000Z",
  "estado": "ENVIADA",
  "items": [
    {
      "articulo": "64ab12...",
      "stockActual": 10,
      "entrantes": 0,
      "cantidad": 5,
      "costoCompra": 1200,
      "costoTotal": 6000
    },
    {
      "articulo": "64ab34...",
      "stockActual": 3,
      "entrantes": 0,
      "cantidad": 10,
      "costoCompra": 800,
      "costoTotal": 8000
    }
  ],
  "totalOrden": 14000,
  "createdAt": "...",
  "updatedAt": "..."
}









*/
