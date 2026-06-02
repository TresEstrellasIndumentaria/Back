require('dotenv').config();
const mongoose = require('mongoose');
const OrdenCompra = require('../src/models/ordenDeCompra');
const Secuencia = require('../src/models/secuencia');

const ejecutar = async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ordenes = await OrdenCompra.find()
        .sort({ createdAt: 1, _id: 1 })
        .select('_id')
        .lean();

    if (!ordenes.length) {
        await Secuencia.findOneAndUpdate(
            { clave: 'ordenCompra' },
            { $set: { valor: 0 } },
            { upsert: true }
        );
        console.log('No hay ordenes de compra para renumerar.');
        return;
    }

    await OrdenCompra.bulkWrite(
        ordenes.map((orden, index) => ({
            updateOne: {
                filter: { _id: orden._id },
                update: { $set: { numero: -(index + 1) } }
            }
        }))
    );

    await OrdenCompra.bulkWrite(
        ordenes.map((orden, index) => ({
            updateOne: {
                filter: { _id: orden._id },
                update: { $set: { numero: index + 1 } }
            }
        }))
    );

    await Secuencia.findOneAndUpdate(
        { clave: 'ordenCompra' },
        { $set: { valor: ordenes.length } },
        { upsert: true }
    );

    console.log(`${ordenes.length} ordenes de compra renumeradas.`);
};

ejecutar()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
