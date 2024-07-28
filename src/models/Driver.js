const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  carType: { type: String, required: true },
  registrationStatus: { type: String, default: 'pending' } // حالة التسجيل
});

module.exports = mongoose.model('Driver', driverSchema);
