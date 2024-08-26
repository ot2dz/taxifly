const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  carType: {
    type: String,
    required: true
  },
  registrationStatus: {
    type: String,
    enum: ['pending', 'approved'],
    default: 'pending'
  },
  isAvailable: {
    type: Boolean,
    default: false
  },
  registrationDate: {  // إضافة حقل تاريخ التسجيل
    type: Date,
    default: Date.now // افتراضيًا، يقوم بتسجيل الوقت الحالي
  }
});

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
