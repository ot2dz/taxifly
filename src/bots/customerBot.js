const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { removeRideRequest } = require('./sharedRideFunctions');

const bot = new TelegramBot(config.CUSTOMER_BOT_TOKEN, { polling: true });

const userStates = new Map();

const CHAT_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_ADDRESS: 'AWAITING_ADDRESS',
  WAITING_FOR_TAXI: 'WAITING_FOR_TAXI'
};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['اريد طاكسي'],
      ['معلوماتي'],
      ['تعديل معلوماتي']
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await User.findOne({ telegramId: chatId });

    if (user) {
      userStates.set(chatId, CHAT_STATES.IDLE);
      await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! كيف يمكنني مساعدتك اليوم؟', mainMenu);
    } else {
      userStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'مرحبًا بك في خدمة طلب الطاكسي! الرجاء إدخال اسمك:');
    }
  } catch (error) {
    console.error('Error in /start command:', error);
    await bot.sendMessage(chatId, 'عذرًا، حدث خطأ. الرجاء المحاولة مرة أخرى لاحقًا.');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === '/start') return;

  const currentState = userStates.get(chatId) || CHAT_STATES.IDLE;

  switch (currentState) {
    case CHAT_STATES.AWAITING_NAME:
      await handleNameInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_PHONE:
      await handlePhoneInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_ADDRESS:
      await handleAddressInput(chatId, messageText);
      break;
    case CHAT_STATES.IDLE:
      await handleMainMenuInput(chatId, messageText);
      break;
  }
});

async function handleNameInput(chatId, name) {
  userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
  userStates.set(chatId + '_name', name);
  await bot.sendMessage(chatId, `شكرًا ${name}، الرجاء إدخال رقم هاتفك الآن:`);
}

async function handlePhoneInput(chatId, phone) {
  try {
    const name = userStates.get(chatId + '_name');
    const user = await User.findOne({ telegramId: chatId });

    if (user) {
      // تحديث بيانات المستخدم الحالي
      user.name = name;
      user.phoneNumber = phone;
      await user.save();
    } else {
      // إنشاء مستخدم جديد
      await User.create({ telegramId: chatId, name: name, phoneNumber: phone });
    }

    userStates.set(chatId, CHAT_STATES.IDLE);
    userStates.delete(chatId + '_name');
    await bot.sendMessage(chatId, 'تم تسجيل معلوماتك بنجاح!', mainMenu);
  } catch (error) {
    console.error('Error saving user info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء حفظ المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.');
    userStates.set(chatId, CHAT_STATES.IDLE);
    userStates.delete(chatId + '_name');
  }
}

async function handleMainMenuInput(chatId, messageText) {
  switch (messageText) {
    case 'اريد طاكسي':
      await requestTaxi(chatId);
      break;
    case 'معلوماتي':
      await showUserInfo(chatId);
      break;
    case 'تعديل معلوماتي':
      userStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'الرجاء إدخال اسمك الجديد:');
      break;
    default:
      await bot.sendMessage(chatId, 'عذرًا، لم أفهم طلبك. الرجاء اختيار أحد الخيارات المتاحة.', mainMenu);
  }
}

async function requestTaxi(chatId) {
  const user = await User.findOne({ telegramId: chatId });
  if (!user) {
    await bot.sendMessage(chatId, 'يجب عليك التسجيل أولاً قبل طلب طاكسي. الرجاء اختيار "تعديل معلوماتي" للتسجيل.', mainMenu);
    return;
  }
  userStates.set(chatId, CHAT_STATES.AWAITING_ADDRESS);
  await bot.sendMessage(chatId, 'الرجاء إدخال عنوانك الحالي:');
}

async function handleAddressInput(chatId, address) {
  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) {
      await bot.sendMessage(chatId, 'عذرًا، يجب عليك التسجيل أولاً قبل طلب طاكسي.', mainMenu);
      userStates.set(chatId, CHAT_STATES.IDLE);
      return;
    }

    userStates.set(chatId, CHAT_STATES.WAITING_FOR_TAXI);
    await bot.sendMessage(chatId, 'تم استلام طلبك. جاري البحث عن سائق...');

    const driverBot = require('./driverBot');
    await driverBot.notifyDrivers(user, address);

    // إعادة ضبط حالة المستخدم بعد إشعار السائقين
    userStates.set(chatId, CHAT_STATES.IDLE);
  } catch (error) {
    console.error('Error in handleAddressInput:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء معالجة طلبك. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
    userStates.set(chatId, CHAT_STATES.IDLE);
  }
}

async function showUserInfo(chatId) {
  try {
    const user = await User.findOne({ telegramId: chatId });
    if (user) {
      await bot.sendMessage(chatId, `معلوماتك:\nالاسم: ${user.name}\nرقم الهاتف: ${user.phoneNumber}`, mainMenu);
    } else {
      userStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً. أدخل اسمك:');
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء استرجاع المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

async function handleDriverAcceptance(driverId, userId) {
  try {
    const driver = await Driver.findOne({ telegramId: driverId });
    const user = await User.findOne({ telegramId: userId });

    if (driver && user) {
      await bot.sendMessage(userId, `تم قبول طلبك! معلومات السائق:\nالاسم: ${driver.name}\nنوع السيارة: ${driver.carType}\nرقم الهاتف: ${driver.phoneNumber}`, mainMenu);
      
      removeRideRequest(userId);
      userStates.set(userId, CHAT_STATES.IDLE);
    }
  } catch (error) {
    console.error('Error in handleDriverAcceptance:', error);
  }
}

module.exports = { bot, handleDriverAcceptance };
