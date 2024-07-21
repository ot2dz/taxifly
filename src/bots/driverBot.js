const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const { addRideRequest, getRideRequest, removeRideRequest } = require('./sharedRideFunctions');
const { handleDriverAcceptance } = require('./customerBot');
const Ride = require('../models/Ride');


const bot = new TelegramBot(config.DRIVER_BOT_TOKEN);

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
      driverStates.set(chatId, CHAT_STATES.IDLE);
      await bot.sendMessage(chatId, 'مرحبًا بك مجددًا! كيف يمكنني مساعدتك اليوم؟', mainMenu);
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

    // البحث عن السائق باستخدام telegramId
    let driver = await Driver.findOne({ telegramId: chatId });

    if (driver) {
      // تحديث معلومات السائق الموجود
      driver.name = name;
      driver.phoneNumber = phone;
      driver.carType = carType;
    } else {
      // إنشاء سائق جديد
      driver = new Driver({ 
        telegramId: chatId, 
        name: name, 
        phoneNumber: phone, 
        carType: carType,
        isAvailable: true
      });
    }

    await driver.save();

    driverStates.set(chatId, CHAT_STATES.IDLE);
    driverStates.delete(chatId + '_name');
    driverStates.delete(chatId + '_phone');
    await bot.sendMessage(chatId, 'تم تسجيل معلوماتك بنجاح! أنت الآن متاح لاستقبال الطلبات.', mainMenu);
  } catch (error) {
    console.error('Error saving driver info:', error);
    if (error.code === 11000) {
      // حدث خطأ بسبب تكرار المفتاح
      await bot.sendMessage(chatId, 'عذرًا، يبدو أنك مسجل بالفعل. إذا كنت ترغب في تحديث معلوماتك، يرجى استخدام خيار "تعديل معلوماتي".');
    } else if (error.message === 'Missing required information') {
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
    await bot.sendMessage(chatId, 'أنت مسجل بالفعل كسائق. هل ترغب في تعديل معلوماتك؟', mainMenu);
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
      await bot.sendMessage(chatId, `معلوماتك:\nالاسم: ${driver.name}\nرقم الهاتف: ${driver.phoneNumber}\nنوع السيارة: ${driver.carType}\nالحالة: ${status}`, mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً باستخدام زر "تسجيل كسائق".', mainMenu);
    }
  } catch (error) {
    console.error('Error fetching driver info:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء استرجاع المعلومات. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

async function toggleAvailability(chatId) {
  try {
    const driver = await Driver.findOne({ telegramId: chatId });
    if (driver) {
      driver.isAvailable = !driver.isAvailable;
      await driver.save();
      const status = driver.isAvailable ? 'متاح' : 'غير متاح';
      await bot.sendMessage(chatId, `تم تغيير حالتك إلى: ${status}`, mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على معلوماتك. الرجاء التسجيل أولاً باستخدام زر "تسجيل كسائق".', mainMenu);
    }
  } catch (error) {
    console.error('Error toggling availability:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء تغيير الحالة. الرجاء المحاولة مرة أخرى لاحقًا.', mainMenu);
  }
}

bot.on('callback_query', async (callbackQuery) => {
    const driverId = callbackQuery.from.id;
    const data = callbackQuery.data;
  
    if (data.startsWith('accept_ride_')) {
      const rideId = data.split('_')[2];
      await handleAcceptRide(driverId, rideId);
      // إزالة الزر بعد الضغط عليه
      await bot.answerCallbackQuery(callbackQuery.id);
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: driverId,
        message_id: callbackQuery.message.message_id
      });
    }
  });

  async function handleAcceptRide(driverId, rideId) {
    try {
      const rideRequest = getRideRequest(rideId);
      if (!rideRequest) {
        await bot.sendMessage(driverId, 'عذرًا، هذا الطلب لم يعد متاحًا.');
        return;
      }
  
      if (rideRequest.status === 'accepted') {
        await bot.sendMessage(driverId, 'عذرًا، هذا الطلب لم يعد متاحًا.');
        return;
      }
  
      const driver = await Driver.findOne({ telegramId: driverId });
      if (driver) {
        rideRequest.status = 'accepted';
  
        const newRide = new Ride({
          userId: mongoose.Types.ObjectId(rideRequest.userId),
          driverId: driver._id,
          status: 'accepted'
        });
  
        await newRide.save(); // تسجيل الرحلة المقبولة في قاعدة البيانات
  
        await bot.sendMessage(driverId, 'لقد قبلت الطلب. سيتم إرسال معلوماتك للزبون.');
  
        await handleDriverAcceptance(driverId, rideRequest.userId);
      } else {
        await bot.sendMessage(driverId, 'عذرًا، لا يمكنك قبول هذا الطلب حاليًا. تأكد من أنك مسجل كسائق.');
      }
    } catch (error) {
      console.error('Error in handleAcceptRide:', error);
      await bot.sendMessage(driverId, 'حدث خطأ أثناء قبول الطلب. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
  }
  

  async function notifyDrivers(user, address) {
    console.log('Starting notifyDrivers function');
    const drivers = await Driver.find({});
    console.log(`Found ${drivers.length} drivers`);
  
    if (drivers.length === 0) {
      console.log('No drivers found');
      // يمكنك هنا إضافة منطق لإخبار الزبون أنه لا يوجد سائقين متاحين حاليًا
      return;
    }

    const rideId = Date.now().toString();
    addRideRequest(rideId, user.telegramId);

    for (const driver of drivers) {
      const message = `زبون جديد يحتاج إلى طاكسي!\nالاسم: ${user.name}\nالعنوان: ${address}`;
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
/*
  async function cancelRideForOtherDrivers(acceptedDriverId, rideId) {
    const drivers = await Driver.find({ telegramId: { $ne: acceptedDriverId } });
    for (const driver of drivers) {
      try {
        await bot.sendMessage(driver.telegramId, 'عذرًا، تم قبول الطلب من قبل سائق آخر.');
      } catch (error) {
        console.error(`Failed to send cancellation to driver ${driver.telegramId}:`, error);
      }
    }
    // إزالة الطلب من القائمة بعد الانتهاء
    rideRequests.delete(rideId);
  }
*/

  
  // في نهاية الملف
  module.exports = { 
    bot, 
    notifyDrivers, 
    rideRequests // تصدير rideRequests
  };