const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const User = require('../models/User');
const Driver = require('../models/Driver');
const { removeRideRequest } = require('./sharedRideFunctions');

const bot = new TelegramBot(config.CUSTOMER_BOT_TOKEN);

const userStates = new Map();

const CHAT_STATES = {
  IDLE: 'IDLE',
  AWAITING_NAME: 'AWAITING_NAME',  // الحالة الجديدة لانتظار الاسم الكامل
  AWAITING_PHONE: 'AWAITING_PHONE',
  AWAITING_ADDRESS: 'AWAITING_ADDRESS',
  WAITING_FOR_TAXI: 'WAITING_FOR_TAXI'
};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🚖 اريد طاكسي'],
      ['ℹ️ معلوماتي'],
      ['✏️ تعديل معلوماتي']
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = await User.findOne({ telegramId: chatId });

    if (user && user.isBanned) {
      await bot.sendMessage(chatId, 'أنت محظور من استخدام هذه الخدمة.');
      return;
    }

    if (user) {
      userStates.set(chatId, CHAT_STATES.IDLE);
      await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! لطلب طاكسي ارسل رقم 1 هنا', mainMenu);
    } else {
      userStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'مرحبًا بك في خدمة طلب الطاكسي! الرجاء إدخال اسمك الكامل:');
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
    default:
      await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! لطلب طاكسي ارسل رقم 1 هنا', mainMenu);
      break;
  }
});

async function handleNameInput(chatId, name) {
  if (!name || name.length < 3) {
    await bot.sendMessage(chatId, 'يرجى إدخال اسم كامل مكون من 3 أحرف على الأقل.');
    return;
  }

  userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
  await User.updateOne(
    { telegramId: chatId },
    { $set: { name } },
    { upsert: true }  // إذا لم يكن هناك سجل، يتم إنشاء سجل جديد
  );

  await bot.sendMessage(chatId, 'تم تسجيل اسمك بنجاح! الرجاء إدخال رقم هاتفك:');
}

async function handlePhoneInput(chatId, phone) {
  // التحقق من أن الرقم يحتوي فقط على أرقام، يتكون من 10 أرقام، ويبدأ بـ 06 أو 07 أو 05
  const phoneRegex = /^(06|07|05)\d{8}$/;

  if (!phoneRegex.test(phone)) {
    await bot.sendMessage(chatId, 'عذرًا، يجب أن يكون رقم الهاتف مكونًا من 10 أرقام ويبدأ بـ 06، 07، أو 05. الرجاء إدخال رقم هاتف صحيح.');
    return;
  }

  try {
    const user = await User.findOne({ telegramId: chatId });

    if (user) {
      // تحديث بيانات المستخدم الحالي
      user.phoneNumber = phone;
      await user.save();
    } else {
      // إنشاء مستخدم جديد
      await User.create({ telegramId: chatId, phoneNumber: phone });
    }

    userStates.set(chatId, CHAT_STATES.IDLE);
    await bot.sendMessage(chatId, 'تم تسجيل معلوماتك بنجاح لطلب طاكسي ارسل رقم 1 هنا!', mainMenu);
  } catch (error) {
    console.error('Error saving user info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء حفظ المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.');
    userStates.set(chatId, CHAT_STATES.IDLE);
  }
}

async function handleMainMenuInput(chatId, messageText) {
  const user = await User.findOne({ telegramId: chatId });

  if (!user) {
    userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
    await bot.sendMessage(chatId, 'الرجاء إدخال رقم هاتفك للتسجيل:');
    return;
  }

  switch (messageText) {
    case '🚖 اريد طاكسي':
    case '1':
      await requestTaxi(chatId);
      break;
    case 'ℹ️ معلوماتي':
      await showUserInfo(chatId);
      break;
    case '✏️ تعديل معلوماتي':
      userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
      await bot.sendMessage(chatId, 'الرجاء إدخال رقم هاتفك الجديد:');
      break;
    default:
      await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! لطلب طاكسي ارسل رقم 1 هنا', mainMenu);
      break;
  }
}

async function requestTaxi(chatId) {
  const user = await User.findOne({ telegramId: chatId });
  if (!user) {
    await bot.sendMessage(chatId, 'الرجاء إدخال رقم هاتفك للتسجيل:');
    userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
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

    user.address = address;  // تحديث عنوان المستخدم
    await user.save();

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
      userStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً. أدخل رقم هاتفك:');
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء استرجاع المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

async function handleDriverAcceptance(driverId, userId) {
  try {
    console.log(`handleDriverAcceptance: Fetching driver with telegramId: ${driverId} and user with telegramId: ${userId}`);
    const user = await User.findOne({ telegramId: userId });

    if (user) {
      console.log(`handleDriverAcceptance: Sending user phone number to driver ${driverId}`);
      await bot.sendMessage(driverId, `تم قبول طلبك! رقم هاتف الزبون: ${user.phoneNumber} , اتصل به الان `);

      removeRideRequest(userId);
      userStates.set(userId, CHAT_STATES.IDLE);
    }
  } catch (error) {
    console.error('Error in handleDriverAcceptance:', error);
  }
}

module.exports = { bot, handleDriverAcceptance };
