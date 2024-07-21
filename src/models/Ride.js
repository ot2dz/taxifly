const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  userId: {
    type: String, // تغيير النوع إلى String
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
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
