// sharedRideFunctions.js
const mongoose = require('mongoose');

const rideRequests = new Map();

function removeRideRequest(userId) {
  for (const [key, value] of rideRequests.entries()) {
    if (value.userId.equals(userId)) {
      rideRequests.delete(key);
      break;
    }
  }
}

function addRideRequest(rideId, userId) {
  rideRequests.set(rideId, { userId: mongoose.Types.ObjectId(userId), status: 'pending' });
}

function getRideRequest(rideId) {
  return rideRequests.get(rideId);
}

module.exports = {
  removeRideRequest,
  addRideRequest,
  getRideRequest,
  rideRequests
};
