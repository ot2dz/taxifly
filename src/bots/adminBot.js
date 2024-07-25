const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');

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
      await bot.sendMessage(driver.telegramId, message);
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
      await bot.sendMessage(driver.telegramId, message);
      bot.sendMessage(chatId, 'تم إرسال الرسالة إلى السائق.');
    } else {
      bot.sendMessage(chatId, 'لم يتم العثور على السائق.');
    }
  } catch (error) {
    console.error('Error sending message to driver:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.');
  }
});

bot.onText(/\/sendToAllCustomers (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const message = match[1];
  
  try {
    const users = await User.find({});
    for (const user of users) {
      await bot.sendMessage(user.telegramId, message);
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
      await bot.sendMessage(user.telegramId, message);
      bot.sendMessage(chatId, 'تم إرسال الرسالة إلى الزبون.');
    } else {
      bot.sendMessage(chatId, 'لم يتم العثور على الزبون.');
    }
  } catch (error) {
    console.error('Error sending message to customer:', error);
    bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.');
  }
});

module.exports = bot;
