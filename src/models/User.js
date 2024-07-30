// User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
    },
  phoneNumber: {
    type: String,
    required: true
  },
  address: {  // إضافة حقل العنوان
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isBanned: { type: Boolean, default: false }  // إضافة هذا الحقل

});

const User = mongoose.model('User', userSchema);

module.exports = User;
