const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');
const mongoose = require('mongoose');
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

    const newDriver = new Driver({
      telegramId: chatId,
      name: name,
      phoneNumber: phone,
      carType: carType,
      registrationStatus: 'pending'
    });

    await newDriver.save();

    driverStates.set(chatId, CHAT_STATES.IDLE);
    driverStates.delete(chatId + '_name');
    driverStates.delete(chatId + '_phone');
    await bot.sendMessage(chatId, 'تم إرسال طلبك للمراجعة. سيتم إعلامك عند الموافقة على طلبك.');

    if (adminChatId) {
      await adminBot.sendMessage(adminChatId, `طلب جديد لتسجيل السائق:\nالاسم: ${name}\nالهاتف: ${phone}\nنوع السيارة: ${carType}\nللموافقة أو الرفض، استخدم قائمة "الموافقة على السائقين" في القائمة الرئيسية.`);
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

async function notifyDrivers(user, address) {
  console.log('Starting notifyDrivers function');
  const drivers = await Driver.find({ registrationStatus: 'approved' });
  console.log(`Found ${drivers.length} drivers`);

  if (drivers.length === 0) {
    console.log('No drivers found');
    return;
  }

  const rideId = Date.now().toString();
  rideRequests.set(rideId, { userId: user.telegramId, status: 'pending' });

  for (const driver of drivers) {
    const message = `زبون جديد يحتاج إلى طاكسي!\nعنوان الزبون: ${address}\n اضغط على الزر في الاسفل لقبول الطلب`;
    const options = {
      reply_markup: {
        inline_keyboard: [[
          { text: 'قبول الطلب', callback_data: `accept_ride_${rideId}` }
        ]]
      }
    };
    try {
      console.log(`Sending notification to driver ${driver.telegramId}`);
      await bot.sendMessage(driver.telegramId, message, options);
      console.log(`Notification sent successfully to driver ${driver.telegramId}`);
    } catch (error) {
      console.error(`Failed to send notification to driver ${driver.telegramId}:`, error);
    }
  }
  console.log('Finished notifyDrivers function');
}

bot.on('callback_query', async (callbackQuery) => {
  const driverId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data.startsWith('accept_ride_')) {
    const rideId = data.split('_')[2];
    await handleAcceptRide(driverId, rideId);
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: driverId,
      message_id: callbackQuery.message.message_id
    });
  }
});

async function handleAcceptRide(driverId, rideId) {
  try {
    const rideRequest = rideRequests.get(rideId);
    if (!rideRequest) {
      await bot.sendMessage(driverId, 'عذرًا، هذا الطلب لم يعد متاحًا.');
      return;
    }

    if (rideRequest.status === 'accepted') {
      await bot.sendMessage(driverId, 'عذرًا، هذا الطلب تم قبوله بالفعل.');
      return;
    }

    const driver = await Driver.findOne({ telegramId: driverId });
    const user = await User.findOne({ telegramId: rideRequest.userId });
    if (driver && user) {
      rideRequest.status = 'accepted';

      const newRide = new Ride({
        userId: rideRequest.userId,
        userPhone: user.phoneNumber,
        userAddress: user.address,
        driverId: driver._id,
        driverName: driver.name,
        driverPhone: driver.phoneNumber,
        status: 'accepted'
      });

      await newRide.save();

      await handleDriverAcceptance(driverId, rideRequest.userId);
    } else {
      await bot.sendMessage(driverId, 'عذرًا، لا يمكنك قبول هذا الطلب حاليًا. تأكد من أنك مسجل كسائق.');
    }
  } catch (error) {
    console.error('Error in handleAcceptRide:', error);
    await bot.sendMessage(driverId, 'حدث خطأ أثناء قبول الطلب. الرجاء المحاولة مرة أخرى لاحقًا.');
  }
}
async function handleDriverAcceptance(driverId, userId) {
  try {
    const user = await User.findOne({ telegramId: userId });

    if (user) {
      const userPhoneNumber = user.phoneNumber;
      await bot.sendMessage(driverId, 'تم قبول طلبك! الزبون في انتظارك قم بالاتصال به الان :');
      await bot.sendMessage(driverId, `${userPhoneNumber}`);
      await bot.sendMessage(driverId, 'أسعار الخدمة:\n- وسط عين صالح: 15 ألف\n- البركة: 25 ألف\n- الساهلتين: 55 ألف');

      // إعلام الزبون بأن طلبه قد تم قبوله
      const customerBot = require('./customerBot').bot;
      await customerBot.sendMessage(userId, 'شكرا , لقد تم قبول طلبك , سيتم الاتصال بك من طرف السائق الان.\n\nأسعار الخدمة:\n- وسط عين صالح: 15 ألف\n- البركة: 25 ألف\n- الساهلتين: 55 ألف\n - لطلب طاكسي دائما ارسل رقم 1 فقط هنا');
      
      // حذف طلب الرحلة من القائمة
      for (let [rideId, request] of rideRequests.entries()) {
        if (request.userId === userId) {
          rideRequests.delete(rideId);
          break;
        }
      }

      // إعادة تعيين حالة السائق إلى IDLE
      driverStates.set(driverId, CHAT_STATES.IDLE);
    } else {
      console.error(`User not found for userId: ${userId}`);
      await bot.sendMessage(driverId, 'حدث خطأ أثناء معالجة الطلب. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
  } catch (error) {
    console.error('Error in handleDriverAcceptance:', error);
    await bot.sendMessage(driverId, 'حدث خطأ أثناء معالجة الطلب. الرجاء المحاولة مرة أخرى لاحقًا.');
  }
}

// دالة لتحديث معلومات السائق
async function updateDriverInfo(chatId, field, value) {
  try {
    const driver = await Driver.findOne({ telegramId: chatId });
    if (driver) {
      driver[field] = value;
      await driver.save();
      await bot.sendMessage(chatId, `تم تحديث ${field} بنجاح.`, mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً.', mainMenu);
    }
  } catch (error) {
    console.error('Error updating driver info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء تحديث المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

// تعديل دالة handleMainMenuInput لتشمل خيار تحديث المعلومات
async function handleMainMenuInput(chatId, messageText) {
  switch (messageText) {
    case '📝 تسجيل كسائق':
      await registerDriver(chatId);
      break;
    case 'ℹ️ معلوماتي':
      await showDriverInfo(chatId);
      break;
    case '✏️ تعديل معلوماتي':
      await bot.sendMessage(chatId, 'ما الذي تريد تعديله؟', {
        reply_markup: {
          keyboard: [
            ['الاسم', 'رقم الهاتف', 'نوع السيارة'],
            ['رجوع للقائمة الرئيسية']
          ],
          resize_keyboard: true
        }
      });
      break;
    case 'الاسم':
      driverStates.set(chatId, CHAT_STATES.AWAITING_NAME);
      await bot.sendMessage(chatId, 'الرجاء إدخال اسمك الجديد:');
      break;
    case 'رقم الهاتف':
      driverStates.set(chatId, CHAT_STATES.AWAITING_PHONE);
      await bot.sendMessage(chatId, 'الرجاء إدخال رقم هاتفك الجديد:');
      break;
    case 'نوع السيارة':
      driverStates.set(chatId, CHAT_STATES.AWAITING_CAR_TYPE);
      await bot.sendMessage(chatId, 'الرجاء إدخال نوع سيارتك الجديد:');
      break;
    case 'رجوع للقائمة الرئيسية':
      driverStates.set(chatId, CHAT_STATES.IDLE);
      await bot.sendMessage(chatId, 'تم العودة للقائمة الرئيسية', mainMenu);
      break;
    default:
      await bot.sendMessage(chatId, 'عذرًا، لم أفهم طلبك. الرجاء اختيار أحد الخيارات المتاحة.', mainMenu);
  }
}

// تصدير الدوال والمتغيرات اللازمة
module.exports = {
  bot,
  notifyDrivers,
  rideRequests,
  CHAT_STATES
};

