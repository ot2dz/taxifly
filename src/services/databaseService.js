const mongoose = require('mongoose');
const config = require('../config');

const connectDB = async () => {
  const connectOptions = {
    serverSelectionTimeoutMS: 5000, // زيادة مهلة اختيار الخادم
    socketTimeoutMS: 45000, // زيادة مهلة العملية
    retryWrites: true,
    retryReads: true,
  };

  const connectWithRetry = async () => {
    try {
      await mongoose.connect(config.MONGODB_URI, connectOptions);
      console.log('MongoDB Connected successfully');
    } catch (err) {
      console.error('Failed to connect to MongoDB', err);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    }
  };

  await connectWithRetry();

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    connectWithRetry();
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
};

module.exports = { connectDB };