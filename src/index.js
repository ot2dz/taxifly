const express = require('express');
const bodyParser = require('body-parser');
const customerBot = require('./bots/customerBot');
const driverBot = require('./bots/driverBot');
const adminBot = require('./bots/adminBot');
const config = require('./config');
const { connectDB } = require('./services/databaseService');

const app = express();

app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// اتصال بقاعدة البيانات
connectDB();

// إعداد Webhook للبوتات
const setupWebhook = async (bot, token) => {
  const webhookUrl = `${APP_URL}/bot${token}`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log(`Webhook set for bot ${token}`);
  } catch (error) {
    console.error(`Failed to set webhook for bot ${token}:`, error);
  }
};

// معالجة التحديثات للبوتات
app.post(`/bot${config.CUSTOMER_BOT_TOKEN}`, (req, res) => {
  customerBot.bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.post(`/bot${config.DRIVER_BOT_TOKEN}`, (req, res) => {
  driverBot.bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.post(`/bot${config.ADMIN_BOT_TOKEN}`, (req, res) => {
  adminBot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  if (process.env.NODE_ENV === 'production') {
    await setupWebhook(customerBot.bot, config.CUSTOMER_BOT_TOKEN);
    await setupWebhook(driverBot.bot, config.DRIVER_BOT_TOKEN);
    await setupWebhook(adminBot, config.ADMIN_BOT_TOKEN);
  } else {
    console.log('Running in development mode. Using long polling for bots.');
    customerBot.bot.startPolling();
    driverBot.bot.startPolling();
    adminBot.startPolling();
  }
});