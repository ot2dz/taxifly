require('dotenv').config();

module.exports = {
  CUSTOMER_BOT_TOKEN: process.env.CUSTOMER_BOT_TOKEN,
  DRIVER_BOT_TOKEN: process.env.DRIVER_BOT_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI,
  ADMIN_BOT_TOKEN: process.env.ADMIN_BOT_TOKEN,
  PORT: process.env.PORT || 3000
};