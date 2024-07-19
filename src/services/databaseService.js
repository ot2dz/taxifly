const mongoose = require('mongoose');
const config = require('../config');

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // زيادة المهلة إلى 30 ثانية
      socketTimeoutMS: 45000 // زيادة مهلة المقبس
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
};

mongoose.set('debug', true);

module.exports = { connectDB };
