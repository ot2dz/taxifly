const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { bot: customerBot } = require('./customerBot');



const bot = new TelegramBot(config.ADMIN_BOT_TOKEN, { polling: true });

const adminStates = new Map();

const CHAT_STATES = {
  IDLE: 'IDLE',
  AWAITING_MESSAGE_ALL_DRIVERS: 'AWAITING_MESSAGE_ALL_DRIVERS',
  AWAITING_DRIVER_ID: 'AWAITING_DRIVER_ID',
  AWAITING_DRIVER_MESSAGE: 'AWAITING_DRIVER_MESSAGE',
  AWAITING_MESSAGE_ALL_CUSTOMERS: 'AWAITING_MESSAGE_ALL_CUSTOMERS',
  AWAITING_CUSTOMER_ID: 'AWAITING_CUSTOMER_ID',
  AWAITING_CUSTOMER_MESSAGE: 'AWAITING_CUSTOMER_MESSAGE',
  AWAITING_DRIVER_APPROVAL: 'AWAITING_DRIVER_APPROVAL',
  AWAITING_DRIVER_ID_FOR_MESSAGE: 'AWAITING_DRIVER_ID_FOR_MESSAGE',
  AWAITING_CUSTOMER_ID_FOR_MESSAGE: 'AWAITING_CUSTOMER_ID_FOR_MESSAGE',
  AWAITING_MESSAGE_FOR_SPECIFIC_DRIVER: 'AWAITING_MESSAGE_FOR_SPECIFIC_DRIVER',
  AWAITING_CUSTOMER_ID_FOR_BAN: 'AWAITING_CUSTOMER_ID_FOR_BAN',
  AWAITING_CUSTOMER_ID_FOR_UNBAN: 'AWAITING_CUSTOMER_ID_FOR_UNBAN',
  AWAITING_MESSAGE_FOR_SPECIFIC_CUSTOMER: 'AWAITING_MESSAGE_FOR_SPECIFIC_CUSTOMER'

};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['إرسال رسالة للسائقين', 'إرسال رسالة للزبائن'],
      ['إرسال رسالة لسائق محدد', 'إرسال رسالة لزبون محدد'],
      ['عرض قائمة السائقين', 'عرض قائمة الزبائن'],
      ['عرض قائمة الرحلات', 'الموافقة على السائقين'],
      ['حظر زبون', 'إلغاء حظر زبون'] // إضافة أزرار جديدة
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  adminStates.set(chatId, CHAT_STATES.IDLE);
  await bot.sendMessage(chatId, 'مرحبًا بك في لوحة تحكم الإدارة! اختر إحدى الخيارات التالية:', mainMenu);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === '/start') return;

  const currentState = adminStates.get(chatId) || CHAT_STATES.IDLE;

  switch (currentState) {
    case CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_BAN:
      await handleCustomerIdInputForBan(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_UNBAN:
      await handleCustomerIdInputForUnban(chatId, messageText);
      break;
    case CHAT_STATES.IDLE:
      await handleMainMenuInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_MESSAGE_ALL_DRIVERS:
      await sendMessageToAllDrivers(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_DRIVER_ID:
      await handleDriverIdInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_DRIVER_MESSAGE:
      await sendMessageToDriver(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_MESSAGE_ALL_CUSTOMERS:
      await sendMessageToAllCustomers(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_CUSTOMER_ID:
      await handleCustomerIdInput(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_CUSTOMER_MESSAGE:
      await sendMessageToCustomer(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_DRIVER_APPROVAL:
      await handleDriverApproval(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_DRIVER_ID_FOR_MESSAGE:
        await handleDriverIdInputForMessage(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_MESSAGE:
        await handleCustomerIdInputForMessage(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_MESSAGE_FOR_SPECIFIC_DRIVER:
        await sendMessageToSpecificDriver(chatId, messageText);
      break;
    case CHAT_STATES.AWAITING_MESSAGE_FOR_SPECIFIC_CUSTOMER:
        await sendMessageToSpecificCustomer(chatId, messageText);
    break;
  }
});

async function handleMainMenuInput(chatId, messageText) {
  switch (messageText) {
    case 'إرسال رسالة للسائقين':
      adminStates.set(chatId, CHAT_STATES.AWAITING_MESSAGE_ALL_DRIVERS);
      await bot.sendMessage(chatId, 'الرجاء إدخال الرسالة التي تريد إرسالها لجميع السائقين:');
      break;
    case 'إرسال رسالة للزبائن':
      adminStates.set(chatId, CHAT_STATES.AWAITING_MESSAGE_ALL_CUSTOMERS);
      await bot.sendMessage(chatId, 'الرجاء إدخال الرسالة التي تريد إرسالها لجميع الزبائن:');
      break;
    case 'عرض قائمة السائقين':
      await getAllDrivers(chatId);
      break;
    case 'عرض قائمة الزبائن':
      await getAllCustomers(chatId);
      break;
    case 'عرض قائمة الرحلات':
      await getAllRides(chatId);
      break;
    case 'الموافقة على السائقين':
      await showPendingDrivers(chatId);
      break;
    case 'إرسال رسالة لسائق محدد':
        adminStates.set(chatId, CHAT_STATES.AWAITING_DRIVER_ID_FOR_MESSAGE);
        await bot.sendMessage(chatId, 'الرجاء إدخال معرف السائق (Telegram ID) الذي تريد إرسال رسالة له:');
      break;
    case 'إرسال رسالة لزبون محدد':
        adminStates.set(chatId, CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_MESSAGE);
        await bot.sendMessage(chatId, 'الرجاء إدخال معرف الزبون (Telegram ID) الذي تريد إرسال رسالة له:');
      break;
      case 'حظر زبون':
        adminStates.set(chatId, CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_BAN);
        await bot.sendMessage(chatId, 'الرجاء إدخال معرف الزبون (Telegram ID) الذي تريد حظره:');
        break;
      case 'إلغاء حظر زبون':
        adminStates.set(chatId, CHAT_STATES.AWAITING_CUSTOMER_ID_FOR_UNBAN);
        await bot.sendMessage(chatId, 'الرجاء إدخال معرف الزبون (Telegram ID) الذي تريد إلغاء حظره:');
        break;
    default:
      await bot.sendMessage(chatId, 'عذرًا، لم أفهم طلبك. الرجاء اختيار أحد الخيارات المتاحة.', mainMenu);
  }
}

async function sendMessageToAllDrivers(chatId, message) {
  try {
    const drivers = await Driver.find({ registrationStatus: 'approved' });
    for (const driver of drivers) {
      try {
        await driverBot.sendMessage(driver.telegramId, message);
      } catch (error) {
        console.error(`Error sending message to driver ${driver.telegramId}:`, error);
      }
    }
    await bot.sendMessage(chatId, 'تم إرسال الرسالة إلى جميع السائقين.', mainMenu);
  } catch (error) {
    console.error('Error sending message to all drivers:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
}

async function handleDriverIdInput(chatId, driverId) {
  adminStates.set(chatId, CHAT_STATES.AWAITING_DRIVER_MESSAGE);
  adminStates.set(chatId + '_driverId', driverId);
  await bot.sendMessage(chatId, 'الرجاء إدخال الرسالة التي تريد إرسالها للسائق:');
}

async function sendMessageToDriver(chatId, message) {
  const driverId = adminStates.get(chatId + '_driverId');
  try {
    const driver = await Driver.findOne({ telegramId: driverId, registrationStatus: 'approved' });
    if (driver) {
      await driverBot.sendMessage(driver.telegramId, message);
      await bot.sendMessage(chatId, 'تم إرسال الرسالة إلى السائق.', mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على السائق.', mainMenu);
    }
  } catch (error) {
    console.error('Error sending message to driver:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
  adminStates.delete(chatId + '_driverId');
}

async function sendMessageToAllCustomers(chatId, message) {
  try {
    const users = await User.find({});
    for (const user of users) {
      try {
        await customerBot.sendMessage(user.telegramId, message);
      } catch (error) {
        console.error(`Error sending message to customer ${user.telegramId}:`, error);
      }
    }
    await bot.sendMessage(chatId, 'تم إرسال الرسالة إلى جميع الزبائن.', mainMenu);
  } catch (error) {
    console.error('Error sending message to all customers:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
}

async function handleCustomerIdInput(chatId, customerId) {
  adminStates.set(chatId, CHAT_STATES.AWAITING_CUSTOMER_MESSAGE);
  adminStates.set(chatId + '_customerId', customerId);
  await bot.sendMessage(chatId, 'الرجاء إدخال الرسالة التي تريد إرسالها للزبون:');
}

async function sendMessageToCustomer(chatId, message) {
  const customerId = adminStates.get(chatId + '_customerId');
  try {
    const user = await User.findOne({ telegramId: customerId });
    if (user) {
      await customerBot.sendMessage(user.telegramId, message);
      await bot.sendMessage(chatId, 'تم إرسال الرسالة إلى الزبون.', mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على الزبون.', mainMenu);
    }
  } catch (error) {
    console.error('Error sending message to customer:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
  adminStates.delete(chatId + '_customerId');
}

async function getAllDrivers(chatId) {
  try {
    const drivers = await Driver.find({});
    if (drivers.length > 0) {
      let response = 'قائمة السائقين:\n';
      response += '```\n';
      response += 'الاسم          | الهاتف        | السيارة     | الحالة\n';
      response += '---------------|--------------|-------------|-------\n';
      drivers.forEach(driver => {
        response += `${(driver.name || '-').padEnd(15)} | ${(driver.phoneNumber || '-').padEnd(12)} | ${(driver.carType || '-').padEnd(11)} | ${driver.registrationStatus}\n`;
      });
      response += '```';
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, 'لا يوجد سائقين مسجلين.');
    }
  } catch (error) {
    console.error('Error fetching drivers:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة السائقين.');
  }
  await bot.sendMessage(chatId, 'اختر الإجراء التالي:', mainMenu);
}

async function getAllCustomers(chatId) {
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
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, 'لا يوجد زبائن مسجلين.');
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة الزبائن.');
  }
  await bot.sendMessage(chatId, 'اختر الإجراء التالي:', mainMenu);
}

async function getAllRides(chatId) {
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
      await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } else {
      await bot.sendMessage(chatId, 'لا يوجد رحلات مسجلة.');
    }
  } catch (error) {
    console.error('Error fetching rides:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة الرحلات.');
  }
  await bot.sendMessage(chatId, 'اختر الإجراء التالي:', mainMenu);
}

async function showPendingDrivers(chatId) {
  try {
    const pendingDrivers = await Driver.find({ registrationStatus: 'pending' });
    if (pendingDrivers.length > 0) {
      let message = 'السائقون في انتظار الموافقة:\n\n';
      pendingDrivers.forEach((driver, index) => {
        message += `${index + 1}. ${driver.name} - ${driver.phoneNumber} - ${driver.carType}\n`;
      });
      message += '\nأدخل رقم السائق للموافقة عليه أو رفضه:';
      adminStates.set(chatId, CHAT_STATES.AWAITING_DRIVER_APPROVAL);
      adminStates.set(chatId + '_pendingDrivers', pendingDrivers);
      await bot.sendMessage(chatId, message);
    } else {
      await bot.sendMessage(chatId, 'لا يوجد سائقون في انتظار الموافقة.', mainMenu);
      adminStates.set(chatId, CHAT_STATES.IDLE);
    }
  } catch (error) {
    console.error('Error fetching pending drivers:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء جلب قائمة السائقين المعلقين.', mainMenu);
    adminStates.set(chatId, CHAT_STATES.IDLE);
  }
}

async function handleDriverApproval(chatId, input) {
  const pendingDrivers = adminStates.get(chatId + '_pendingDrivers');
  const index = parseInt(input) - 1;

  if (isNaN(index) || index < 0 || index >= pendingDrivers.length) {
    await bot.sendMessage(chatId, 'رقم غير صالح. الرجاء إدخال رقم صحيح من القائمة.');
    return;
  }

  const driver = pendingDrivers[index];
  const approvalMenu = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'موافقة', callback_data: `approve_${driver.telegramId}` },
          { text: 'رفض', callback_data: `reject_${driver.telegramId}` }
        ]
      ]
    }
  };

  await bot.sendMessage(chatId, `هل تريد الموافقة على أو رفض السائق: ${driver.name}?`, approvalMenu);
}

// bot.on('callback_query', async (callbackQuery) => {
//   const chatId = callbackQuery.message.chat.id;
//   const data = callbackQuery.data;

//   if (data.startsWith('approve_') || data.startsWith('reject_')) {
//     const driverTelegramId = data.split('_')[1];
//     const action = data.startsWith('approve_') ? 'approve' : 'reject';
//     await processDriverApproval(chatId, driverTelegramId, action);
//     await bot.answerCallbackQuery(callbackQuery.id);
//   }
// });

async function processDriverApproval(chatId, driverTelegramId, action) {
  try {
    const driver = await Driver.findOne({ telegramId: driverTelegramId });
    if (!driver) {
      await bot.sendMessage(chatId, 'لم يتم العثور على السائق.');
      return;
    }

    const { bot: driverBot } = require('./driverBot');
    let message = '';

    if (action === 'approve') {
      driver.registrationStatus = 'approved';
      await driver.save();
      message += `تمت الموافقة على السائق ${driver.name}.\n\n`;

      if (driverBot && typeof driverBot.sendMessage === 'function') {
        await driverBot.sendMessage(driver.telegramId, 'تم قبول طلبك كسائق! يمكنك الآن استخدام النظام.');
      } else {
        console.error('Error: driverBot.sendMessage is not available');
        message += 'ملاحظة: تعذر إرسال رسالة إعلام للسائق.\n\n';
      }
    } else if (action === 'reject') {
      await Driver.deleteOne({ _id: driver._id });
      message += `تم رفض السائق ${driver.name} وحذف طلب التسجيل.\n\n`;

      if (driverBot && typeof driverBot.sendMessage === 'function') {
        await driverBot.sendMessage(driver.telegramId, 'عذرًا، تم رفض طلب تسجيلك كسائق. يمكنك المحاولة مرة أخرى لاحقًا أو الاتصال بالإدارة للمزيد من المعلومات.');
      } else {
        console.error('Error: driverBot.sendMessage is not available');
        message += 'ملاحظة: تعذر إرسال رسالة إعلام للسائق.\n\n';
      }
    } else {
      await bot.sendMessage(chatId, 'إجراء غير معروف. الرجاء المحاولة مرة أخرى.');
      return;
    }

    // التحقق من وجود سائقين معلقين آخرين
    const pendingDrivers = await Driver.find({ registrationStatus: 'pending' });
    if (pendingDrivers.length > 0) {
      message += 'هناك المزيد من السائقين في انتظار الموافقة. هل ترغب في مراجعتهم الآن؟';
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'نعم، عرض السائقين المعلقين', callback_data: 'show_pending_drivers' }],
            [{ text: 'لا، العودة للقائمة الرئيسية', callback_data: 'back_to_main_menu' }]
          ]
        }
      };
      await bot.sendMessage(chatId, message, options);
    } else {
      message += 'لا يوجد سائقون آخرون في انتظار الموافقة.\n\n';
      message += 'اختر الإجراء التالي:';
      await bot.sendMessage(chatId, message, mainMenu);
      adminStates.set(chatId, CHAT_STATES.IDLE);
    }
  } catch (error) {
    console.error('Error processing driver approval:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء معالجة طلب الموافقة على السائق.');
    adminStates.set(chatId, CHAT_STATES.IDLE);
    await bot.sendMessage(chatId, 'اختر الإجراء التالي:', mainMenu);
  }
}

// أضف هذا الجزء إلى معالج callback_query الموجود
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'show_pending_drivers') {
    await showPendingDrivers(chatId);
  } else if (data === 'back_to_main_menu') {
    adminStates.set(chatId, CHAT_STATES.IDLE);
    await bot.sendMessage(chatId, 'تم العودة إلى القائمة الرئيسية.', mainMenu);
  } else if (data.startsWith('approve_') || data.startsWith('reject_')) {
    const driverTelegramId = data.split('_')[1];
    const action = data.startsWith('approve_') ? 'approve' : 'reject';
    await processDriverApproval(chatId, driverTelegramId, action);
  }
  await bot.answerCallbackQuery(callbackQuery.id);
});

async function handleDriverIdInputForMessage(chatId, driverId) {
  const driver = await Driver.findOne({ telegramId: driverId });
  if (driver) {
    adminStates.set(chatId, CHAT_STATES.AWAITING_MESSAGE_FOR_SPECIFIC_DRIVER);
    adminStates.set(chatId + '_specificDriverId', driverId);
    await bot.sendMessage(chatId, `تم العثور على السائق ${driver.name}. الرجاء إدخال الرسالة التي تريد إرسالها له:`);
  } else {
    await bot.sendMessage(chatId, 'لم يتم العثور على سائق بهذا المعرف. الرجاء التحقق من المعرف وإعادة المحاولة.', mainMenu);
    adminStates.set(chatId, CHAT_STATES.IDLE);
  }
}

async function handleCustomerIdInputForMessage(chatId, customerId) {
  const customer = await User.findOne({ telegramId: customerId });
  if (customer) {
    adminStates.set(chatId, CHAT_STATES.AWAITING_MESSAGE_FOR_SPECIFIC_CUSTOMER);
    adminStates.set(chatId + '_specificCustomerId', customerId);
    await bot.sendMessage(chatId, `تم العثور على الزبون. الرجاء إدخال الرسالة التي تريد إرسالها له:`);
  } else {
    await bot.sendMessage(chatId, 'لم يتم العثور على زبون بهذا المعرف. الرجاء التحقق من المعرف وإعادة المحاولة.', mainMenu);
    adminStates.set(chatId, CHAT_STATES.IDLE);
  }
}

async function sendMessageToSpecificDriver(chatId, message) {
  const driverId = adminStates.get(chatId + '_specificDriverId');
  try {
    const driver = await Driver.findOne({ telegramId: driverId });
    if (driver) {
      const { bot: driverBot } = require('./driverBot');
      await driverBot.sendMessage(driverId, message);
      await bot.sendMessage(chatId, `تم إرسال الرسالة بنجاح إلى السائق ${driver.name}.`, mainMenu);
    } else {
      await bot.sendMessage(chatId, 'حدث خطأ: لم يتم العثور على السائق.', mainMenu);
    }
  } catch (error) {
    console.error('Error sending message to specific driver:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة للسائق.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
  adminStates.delete(chatId + '_specificDriverId');
}

async function sendMessageToSpecificCustomer(chatId, message) {
  const customerId = adminStates.get(chatId + '_specificCustomerId');
  try {
    const customer = await User.findOne({ telegramId: customerId });
    if (customer) {
      const { bot: customerBot } = require('./customerBot');
      await customerBot.sendMessage(customerId, message);
      await bot.sendMessage(chatId, 'تم إرسال الرسالة بنجاح إلى الزبون.', mainMenu);
    } else {
      await bot.sendMessage(chatId, 'حدث خطأ: لم يتم العثور على الزبون.', mainMenu);
    }
  } catch (error) {
    console.error('Error sending message to specific customer:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إرسال الرسالة للزبون.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
  adminStates.delete(chatId + '_specificCustomerId');
}

async function handleCustomerIdInputForBan(chatId, customerId) {
  try {
    const user = await User.findOne({ telegramId: customerId });
    if (user) {
      user.isBanned = true;
      await user.save();
      await bot.sendMessage(chatId, 'تم حظر الزبون بنجاح.', mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على الزبون.', mainMenu);
    }
  } catch (error) {
    console.error('Error banning customer:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء حظر الزبون.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
}

async function handleCustomerIdInputForUnban(chatId, customerId) {
  try {
    const user = await User.findOne({ telegramId: customerId });
    if (user) {
      user.isBanned = false;
      await user.save();
      await bot.sendMessage(chatId, 'تم إلغاء حظر الزبون بنجاح.', mainMenu);
    } else {
      await bot.sendMessage(chatId, 'لم يتم العثور على الزبون.', mainMenu);
    }
  } catch (error) {
    console.error('Error unbanning customer:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء إلغاء حظر الزبون.', mainMenu);
  }
  adminStates.set(chatId, CHAT_STATES.IDLE);
}


// تصدير البوت
module.exports = bot;