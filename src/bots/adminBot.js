const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');
const customerBot = require('./customerBot').bot; // استيراد بوت الزبون
const driverBot = require('./driverBot').bot; // استيراد بوت السائق

const bot = new TelegramBot(config.ADMIN_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'مرحبًا بك في بوت الإدارة! استخدم الأوامر التالية لإرسال الرسائل:\n/sendToAllDrivers [message]\n/sendToDriver [driverId] [message]\n/sendToAllCustomers [message]\n/sendToCustomer [customerId] [message]');
});

bot.onText(/\/sendToAllDrivers (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const message = match[1];
  
  try {
    const drivers = await Driver.find({});
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
    const driver = await Driver.findOne({ telegramId: driverId });
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

module.exports = bot;
