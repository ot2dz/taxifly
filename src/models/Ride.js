const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  userId: {
    type: String, // `telegramId` الخاص بالمستخدم
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userPhone: {
    type: String,
    required: true
  },
  userAddress: {
    type: String,
    required: true
  },
  driverId: {
    type: String,
    ref: 'Driver',
    required: true
  },
  driverName: {
    type: String,
    required: true
  },
  driverPhone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;
