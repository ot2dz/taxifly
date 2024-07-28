const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride'); // استيراد نموذج الرحلات
const customerBot = require('./customerBot').bot; // استيراد بوت الزبون
const driverBot = require('./driverBot').bot; // استيراد بوت السائق

const bot = new TelegramBot(config.ADMIN_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'مرحبًا بك في بوت الإدارة! استخدم الأوامر التالية:\n' +
    '/sendToAllDrivers [message]\n' +
    '/sendToDriver [driverId] [message]\n' +
    '/sendToAllCustomers [message]\n' +
    '/sendToCustomer [customerId] [message]\n' +
    '/getAllDrivers\n' +
    '/getAllCustomers\n' +
    '/getAllRides\n' +

    '/approve_[driverId] للموافقة على سائق\n' +

    '/reject_[driverId] لرفض سائق'
  );
});

bot.onText(/\/sendToAllDrivers (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const message = match[1];
  
  try {
    const drivers = await Driver.find({ registrationStatus: 'approved' });
    for (const driver of drivers) {
      try {
        await driverBot.sendMessage(driver.telegramId, message);
      } catch (error) {
        console.error(`Error sending message to driver ${driver.telegramId}:`, error);
      }
    }
    bot.sendMessage(chatId, 'تم إرسال الرسالة إلى جميع السائقين.');
  } catch (error) {
    console.error('Error sending message to all drivers:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.');
  }
});

bot.onText(/\/sendToDriver (\d+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const driverId = match[1];
  const message = match[2];
  
  try {
    const driver = await Driver.findOne({ telegramId: driverId, registrationStatus: 'approved' });
    if (driver) {
      try {
        await driverBot.sendMessage(driver.telegramId, message);
        bot.sendMessage(chatId, 'تم إرسال الرسالة إلى السائق.');
      } catch (error) {
        console.error(`Error sending message to driver ${driver.telegramId}:`, error);
        bot.sendMessage(chatId, `حدث خطأ أثناء إرسال الرسالة إلى السائق ${driver.telegramId}. تأكد من أن السائق قد بدأ محادثة مع البوت.`);
      }
    } else {
      bot.sendMessage(chatId, 'لم يتم العثور على السائق.');
    }
  } catch (error) {
    console.error('Error finding driver:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء البحث عن السائق.');
  }
});

bot.onText(/\/sendToAllCustomers (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const message = match[1];
  
  try {
    const users = await User.find({});
    for (const user of users) {
      try {
        await customerBot.sendMessage(user.telegramId, message);
      } catch (error) {
        console.error(`Error sending message to customer ${user.telegramId}:`, error);
      }
    }
    bot.sendMessage(chatId, 'تم إرسال الرسالة إلى جميع الزبائن.');
  } catch (error) {
    console.error('Error sending message to all customers:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.');
  }
});

bot.onText(/\/sendToCustomer (\d+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const customerId = match[1];
  const message = match[2];
  
  try {
    const user = await User.findOne({ telegramId: customerId });
    if (user) {
      try {
        await customerBot.sendMessage(user.telegramId, message);
        bot.sendMessage(chatId, 'تم إرسال الرسالة إلى الزبون.');
      } catch (error) {
        console.error(`Error sending message to customer ${user.telegramId}:`, error);
        bot.sendMessage(chatId, `حدث خطأ أثناء إرسال الرسالة إلى الزبون ${user.telegramId}. تأكد من أن الزبون قد بدأ محادثة مع البوت.`);
      }
    } else {
      bot.sendMessage(chatId, 'لم يتم العثور على الزبون.');
    }
  } catch (error) {
    console.error('Error finding customer:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء البحث عن الزبون.');
  }
});

// دالة لجلب جميع السائقين
bot.onText(/\/getAllDrivers/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const drivers = await Driver.find({});
    if (drivers.length > 0) {
      let response = 'قائمة السائقين:\n';
      response += '```\n';
      response += 'الاسم          | الهاتف        | السيارة     \n';
      response += '---------------|--------------|--------------\n';
      drivers.forEach(driver => {
        response += `${(driver.name || '-').padEnd(15)} | ${(driver.phoneNumber || '-').padEnd(12)} | ${(driver.carType || '-').padEnd(12)}\n`;
      });
      response += '```';
      bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'لا يوجد سائقين مسجلين.');
    }
  } catch (error) {
    console.error('Error fetching drivers:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة السائقين.');
  }
});

// دالة لجلب جميع الزبائن
bot.onText(/\/getAllCustomers/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const users = await User.find({});
    if (users.length > 0) {
      let response = 'قائمة الزبائن:\n';
      response += '```\n';
      response += 'الهاتف          | العنوان        \n';
      response += '---------------|----------------\n';
      users.forEach(user => {
        response += `${(user.phoneNumber || '-').padEnd(15)} | ${(user.address || 'غير محدد').padEnd(16)}\n`;
      });
      response += '```';
      bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'لا يوجد زبائن مسجلين.');
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة الزبائن.');
  }
});

// دالة لجلب جميع الرحلات
bot.onText(/\/getAllRides/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const rides = await Ride.find({});
    if (rides.length > 0) {
      let response = 'قائمة الرحلات:\n';
      response += '```\n';
      response += 'الزبون        | السائق       | العنوان      \n';
      response += '--------------|--------------|--------------\n';
      rides.forEach(ride => {
        response += `${(ride.userPhone || '-').padEnd(12)} | ${(ride.driverName || '-').padEnd(12)} | ${(ride.userAddress || '-').padEnd(12)}\n`;
      });
      response += '```';
      bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, 'لا يوجد رحلات مسجلة.');
    }
  } catch (error) {
    console.error('Error fetching rides:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة الرحلات.');
  }
});

bot.onText(/\/approve_(.+)/, async (msg, match) => {

    const chatId = msg.chat.id;
  
    const driverId = match[1];
  
    
  
    try {
  
      const driver = await Driver.findOne({ _id: driverId, registrationStatus: 'pending' });
  
      if (driver) {
  
        driver.registrationStatus = 'approved';
  
        await driver.save();
  
        await driverBot.sendMessage(driver.telegramId, 'تمت الموافقة على تسجيلك. يمكنك الآن استخدام البوت.');
  
        bot.sendMessage(chatId, 'تمت الموافقة على السائق.');
  
      } else {
  
        bot.sendMessage(chatId, 'لم يتم العثور على السائق أو أنه تم الموافقة عليه بالفعل.');
  
      }
  
    } catch (error) {
  
      console.error('Error approving driver:', error);
  
      bot.sendMessage(chatId, 'حدث خطأ أثناء الموافقة على السائق.');
  
    }
  
  });
  
  
  
  bot.onText(/\/reject_(.+)/, async (msg, match) => {
  
    const chatId = msg.chat.id;
  
    const driverId = match[1];
  
    
  
    try {
  
      const driver = await Driver.findOne({ _id: driverId, registrationStatus: 'pending' });
  
      if (driver) {
  
        await driver.remove();
  
        bot.sendMessage(chatId, 'تم رفض السائق وحذف طلب التسجيل.');
  
      } else {
  
        bot.sendMessage(chatId, 'لم يتم العثور على السائق أو أنه تم الموافقة عليه بالفعل.');
  
      }
  
    } catch (error) {
  
      console.error('Error rejecting driver:', error);
  
      bot.sendMessage(chatId, 'حدث خطأ أثناء رفض السائق.');
  
    }
  
  });

module.exports = bot;
