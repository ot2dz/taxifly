const mongoose = require('mongoose');

const rideRequests = new Map();

function removeRideRequest(telegramId) {
  for (const [key, value] of rideRequests.entries()) {
    if (value.userId === telegramId) {
      rideRequests.delete(key);
      break;
    }
  }
}

function addRideRequest(rideId, telegramId) {
  rideRequests.set(rideId, { userId: telegramId, status: 'pending' });
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
