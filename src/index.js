const express = require('express');
const bodyParser = require('body-parser');
const customerBot = require('./customerBot'); // تأكد من أن المسار صحيح
const driverBot = require('./driverBot'); // تأكد من أن المسار صحيح
const config = require('./config');
const { connectDB } = require('./databaseService'); // استيراد دالة الاتصال بقاعدة البيانات

const app = express();

app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// اتصال بقاعدة البيانات
connectDB(); // استدعاء دالة الاتصال بقاعدة البيانات

// إعداد Webhook للبوت الخاص بالعملاء
app.post(`/bot${config.CUSTOMER_BOT_TOKEN}`, (req, res) => {
  customerBot.bot.processUpdate(req.body);
  res.sendStatus(200);
});

// إعداد Webhook للبوت الخاص بالسائقين
app.post(`/bot${config.DRIVER_BOT_TOKEN}`, (req, res) => {
  driverBot.bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // ضبط Webhook للبوت الخاص بالعملاء
  const customerWebhookUrl = `https://taxibot-b548b9bb94ed.herokuapp.com/bot${config.CUSTOMER_BOT_TOKEN}`;
  customerBot.bot.setWebHook(customerWebhookUrl);
  
  // ضبط Webhook للبوت الخاص بالسائقين
  const driverWebhookUrl = `https://taxibot-b548b9bb94ed.herokuapp.com/bot${config.DRIVER_BOT_TOKEN}`;
  driverBot.bot.setWebHook(driverWebhookUrl);
});
