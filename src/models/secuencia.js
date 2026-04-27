const mongoose = require('mongoose');

const secuenciaSchema = new mongoose.Schema(
    {
        clave: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        valor: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Secuencia', secuenciaSchema);
