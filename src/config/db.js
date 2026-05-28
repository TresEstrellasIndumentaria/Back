// config/db.js
const mongoose = require('mongoose');

const repararIndiceEmailPersonas = async () => {
    const collection = mongoose.connection.db.collection('personas');

    await collection.updateMany(
        { $or: [{ email: null }, { email: '' }] },
        { $unset: { email: '' } }
    );

    const indexes = await collection.indexes();
    const emailIndex = indexes.find((index) => index.name === 'email_1');
    const emailIndexCorrecto = Boolean(
        emailIndex?.unique
        && emailIndex?.partialFilterExpression?.email?.$type === 'string'
    );

    if (!emailIndexCorrecto && emailIndex) {
        await collection.dropIndex('email_1');
    }

    if (!emailIndexCorrecto) {
        await collection.createIndex(
            { email: 1 },
            {
                name: 'email_1',
                unique: true,
                partialFilterExpression: { email: { $type: 'string' } }
            }
        );
    }
};

const dbConnection = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await repararIndiceEmailPersonas();
        console.log('Conectado a la base de datos MongoDB');
    } catch (error) {
        console.error('Error al conectar a la base de datos', error);
        process.exit(1);
    }
};

module.exports = dbConnection;
