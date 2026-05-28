require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('Falta MONGODB_URI');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const collection = mongoose.connection.db.collection('personas');

    const unsetResult = await collection.updateMany(
        { $or: [{ email: null }, { email: '' }] },
        { $unset: { email: '' } }
    );

    const indexes = await collection.indexes();
    const emailIndex = indexes.find((index) => index.name === 'email_1');
    if (emailIndex) {
        await collection.dropIndex('email_1');
    }

    await collection.createIndex(
        { email: 1 },
        {
            name: 'email_1',
            unique: true,
            partialFilterExpression: { email: { $type: 'string' } }
        }
    );

    console.log(JSON.stringify({
        unsetNullEmails: unsetResult.modifiedCount,
        droppedEmailIndex: Boolean(emailIndex),
        createdEmailIndex: true
    }));
};

run()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
