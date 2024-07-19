const express = require('express');
const customerBot = require('./bots/customerBot');
const driverBot = require('./bots/driverBot');
const { connectDB } = require('./services/databaseService');
const config = require('./config');

// إنشاء تطبيق Express
const app = express();

// اتصال بقاعدة البيانات
connectDB();

// تشغيل البوتات
customerBot;
driverBot;

// إنشاء مسار بسيط للتأكد من أن التطبيق يعمل
app.get('/', (req, res) => {
  res.send('Taxi Service Bot is running!');
});

// تشغيل الخادم
const PORT = config.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// التعامل مع الأخطاء غير المتوقعة
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});