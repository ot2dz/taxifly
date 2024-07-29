const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { bot: customerBot } = require('./customerBot');
const { bot: driverBot } = require('./driverBot');


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
  AWAITING_DRIVER_APPROVAL: 'AWAITING_DRIVER_APPROVAL'
};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['إرسال رسالة للسائقين', 'إرسال رسالة للزبائن'],
      ['عرض قائمة السائقين', 'عرض قائمة الزبائن'],
      ['عرض قائمة الرحلات', 'الموافقة على السائقين']
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

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data.startsWith('approve_') || data.startsWith('reject_')) {
    const driverTelegramId = data.split('_')[1];
    const action = data.startsWith('approve_') ? 'approve' : 'reject';
    await processDriverApproval(chatId, driverTelegramId, action);
    await bot.answerCallbackQuery(callbackQuery.id);
  }
});

async function processDriverApproval(chatId, driverTelegramId, action) {
  try {
    const driver = await Driver.findOne({ telegramId: driverTelegramId });
    if (!driver) {
      await bot.sendMessage(chatId, 'لم يتم العثور على السائق.');
      return;
    }

    if (action === 'approve') {
      driver.registrationStatus = 'approved';
      await driver.save();
      await bot.sendMessage(chatId, `تمت الموافقة على السائق ${driver.name}.`);
      
      if (driverBot && typeof driverBot.sendMessage === 'function') {
        await driverBot.sendMessage(chatId, ' تم قبول طلبك ');
      } else {
        console.error('Error: driverBot.sendMessage is not available');
        await bot.sendMessage(chatId, 'تم رفض السائق ولكن فشل إرسال رسالة إليه.');
      }
      
    } else {
      await Driver.deleteOne({ _id: driver._id });
      await bot.sendMessage(chatId, `تم رفض السائق ${driver.name} وحذف طلب التسجيل.`);
      
      if (driverBot && typeof driverBot.sendMessage === 'function') {
        await driverBot.sendMessage(driver.telegramId, 'عذرًا، تم رفض طلب تسجيلك كسائق. يمكنك المحاولة مرة أخرى لاحقًا أو الاتصال بالإدارة للمزيد من المعلومات.');
      } else {
        console.error('Error: driverBot.sendMessage is not available');
        await bot.sendMessage(chatId, 'تم رفض السائق ولكن فشل إرسال رسالة إليه.');
      }
          }

    // تحديث قائمة السائقين المعلقين
    await showPendingDrivers(chatId);
  } catch (error) {
    console.error('Error processing driver approval:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء معالجة طلب الموافقة على السائق.');
    adminStates.set(chatId, CHAT_STATES.IDLE);
    await bot.sendMessage(chatId, 'اختر الإجراء التالي:', mainMenu);
  }
}

// تصدير البوت
module.exports = bot;