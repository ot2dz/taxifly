const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const { addRideRequest, getRideRequest, removeRideRequest } = require('./sharedRideFunctions');
const User = require('../models/User');
const Ride = require('../models/Ride');
const mongoose = require('mongoose');
const { bot: customerBot } = require('./customerBot');
const adminBot = require('./adminBot');

const bot = new TelegramBot(config.DRIVER_BOT_TOKEN, { polling: true });
const adminChatId = config.ADMIN_CHAT_ID;

const driverStates = new Map();
const rideRequests = new Map();

const CHAT_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_CAR_TYPE: 'AWAITING_CAR_TYPE'
};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📝 تسجيل كسائق'],
      ['ℹ️ معلوماتي'],
      ['✏️ تعديل معلوماتي']
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const driver = await Driver.findOne({ telegramId: chatId });

    if (driver) {
      if (driver.registrationStatus === 'pending') {
        await bot.sendMessage(chatId, 'طلبك قيد المراجعة من قبل الإدارة.');
      } else if (driver.registrationStatus === 'approved') {
        driverStates.set(chatId, CHAT_STATES.IDLE);
        await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! كيف يمكنني مساعدتك اليوم؟', mainMenu);
      }
    } else {
      driverStates.set(chatId, CHAT_STATES.IDLE);
      await bot.sendMessage(chatId, 'مرحبًا بك في نظام السائقين! يمكنك التسجيل كسائق جديد أو عرض المعلومات المتاحة.', mainMenu);
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

  const currentState = driverStates.get(chatId) || CHAT_STATES.IDLE;

  switch (currentState) {
    case CHAT_STATES.AWAITING_NAME:
      await handleNameInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_PHONE:
      await handlePhoneInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_CAR_TYPE:
      await handleCarTypeInput(chatId, messageText);
      break;
    case CHAT_STATES.IDLE:
      await handleMainMenuInput(chatId, messageText);
      break;
  }
});

async function handleNameInput(chatId, name) {
  if (!name || name.trim().length === 0) {
    await bot.sendMessage(chatId, 'عذرًا، الاسم لا يمكن أن يكون فارغًا. الرجاء إدخال اسم صحيح.');
    return;
  }
  driverStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
  driverStates.set(chatId + '_name', name);
  await bot.sendMessage(chatId, `شكرًا ${name}، الرجاء إدخال رقم هاتفك الآن:`);
}

async function handlePhoneInput(chatId, phone) {
  if (!phone || phone.trim().length === 0) {
    await bot.sendMessage(chatId, 'عذرًا، رقم الهاتف لا يمكن أن يكون فارغًا. الرجاء إدخال رقم هاتف صحيح.');
    return;
  }
  driverStates.set(chatId, CHAT_STATES.AWAITING_CAR_TYPE);
  driverStates.set(chatId + '_phone', phone);
  await bot.sendMessage(chatId, 'الرجاء إدخال نوع سيارتك:');
}

async function handleCarTypeInput(chatId, carType) {
  try {
    const name = driverStates.get(chatId + '_name');
    const phone = driverStates.get(chatId + '_phone');

    if (!name || !phone || !carType) {
      throw new Error('Missing required information');
    }

    if (phone.trim().length === 0) {
      throw new Error('Phone number cannot be empty');
    }

    // إنشاء سائق جديد مع حالة التسجيل 'pending'
    const newDriver = new Driver({
      telegramId: chatId,
      name: name,
      phoneNumber: phone,
      carType: carType,
      registrationStatus: 'pending'
    });

    // حفظ السائق في قاعدة البيانات
    await newDriver.save();

    driverStates.set(chatId, CHAT_STATES.IDLE);
    driverStates.delete(chatId + '_name');
    driverStates.delete(chatId + '_phone');
    await bot.sendMessage(chatId, 'تم إرسال طلبك للمراجعة. سيتم إعلامك عند الموافقة على طلبك.');

    // إرسال إشعار إلى الإدارة للموافقة
    if (adminChatId) {
      await adminBot.sendMessage(adminChatId, `طلب جديد لتسجيل السائق:\nالاسم: ${name}\nالهاتف: ${phone}\nنوع السيارة: ${carType}\n/approve_${chatId} للموافقة\n/reject_${chatId} لرفض`);
    } else {
      console.error('ADMIN_CHAT_ID is not defined in config.');
    }
  } catch (error) {
    console.error('Error saving driver info:', error);
    if (error.message === 'Missing required information') {
      await bot.sendMessage(chatId, 'عذرًا، بعض المعلومات المطلوبة مفقودة. الرجاء بدء عملية التسجيل من جديد.');
    } else if (error.message === 'Phone number cannot be empty') {
      await bot.sendMessage(chatId, 'عذرًا، رقم الهاتف لا يمكن أن يكون فارغًا. الرجاء إدخال رقم هاتف صحيح.');
    } else {
      await bot.sendMessage(chatId, 'حدث خطأ أثناء حفظ المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
    driverStates.set(chatId, CHAT_STATES.IDLE);
    driverStates.delete(chatId + '_name');
    driverStates.delete(chatId + '_phone');
  }
}

async function handleMainMenuInput(chatId, messageText) {
  switch (messageText) {
    case '📝 تسجيل كسائق':
      await registerDriver(chatId);
      break;
    case 'ℹ️ معلوماتي':
      await showDriverInfo(chatId);
      break;
    case '✏️ تعديل معلوماتي':
      driverStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'الرجاء إدخال اسمك الجديد:');
      break;
    default:
      await bot.sendMessage(chatId, 'عذرًا، لم أفهم طلبك. الرجاء اختيار أحد الخيارات المتاحة.', mainMenu);
  }
}

async function registerDriver(chatId) {
  const existingDriver = await Driver.findOne({ telegramId: chatId });

  if (existingDriver) {
    if (existingDriver.registrationStatus === 'pending') {
      await bot.sendMessage(chatId, 'طلبك قيد المراجعة من قبل الإدارة.');
    } else {
      await bot.sendMessage(chatId, 'أنت مسجل بالفعل كسائق. هل ترغب في تعديل معلوماتك؟', mainMenu);
    }
  } else {
    driverStates.set(chatId, CHAT_STATES.AWAITING_NAME);
    await bot.sendMessage(chatId, 'لنبدأ عملية التسجيل. الرجاء إدخال اسمك:');
  }
}

async function showDriverInfo(chatId) {
  try {
    const driver = await Driver.findOne({ telegramId: chatId });

    if (driver) {
      const status = driver.isAvailable ? 'متاح' : 'غير متاح';
      await bot.sendMessage(chatId, `معلوماتك:\nالاسم: ${driver.name}\nرقم الهاتف: ${driver.phoneNumber}\nنوع السيارة: ${driver.carType}\nحالة التسجيل: ${driver.registrationStatus}`, mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً باستخدام زر "تسجيل كسائق".', mainMenu);
    }
  } catch (error) {
    console.error('Error fetching driver info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء استرجاع المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

// باقي الكود يبقى كما هو...

module.exports = {
  bot,
  notifyDrivers,
  rideRequests
};