// تحميل الحزم الأساسية
const express = require('express');
const bodyParser = require('body-parser');
const customerBot = require('./bots/customerBot');
const driverBot = require('./bots/driverBot');
const adminBot = require('./bots/adminBot');
const config = require('./config');
const { connectDB } = require('./services/databaseService');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());

// ضبط المنفذ وURL الخاص بالتطبيق بناءً على متغيرات البيئة
const PORT = process.env.PORT || 3000;  // المنفذ الافتراضي 3000
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// الاتصال بقاعدة البيانات
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

// بدء تشغيل الخادم
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // ضبط Webhook للبوتات في كل الحالات
  if (!config.CUSTOMER_BOT_TOKEN || !config.DRIVER_BOT_TOKEN || !config.ADMIN_BOT_TOKEN) {
    console.error('One or more bot tokens are missing!');
    process.exit(1);
  }
  
  await setupWebhook(customerBot.bot, config.CUSTOMER_BOT_TOKEN);
  await setupWebhook(driverBot.bot, config.DRIVER_BOT_TOKEN);
  await setupWebhook(adminBot, config.ADMIN_BOT_TOKEN);
  
});

