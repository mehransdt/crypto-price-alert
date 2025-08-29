const TelegramBot = require('node-telegram-bot-api');
const { db } = require('./database');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Get token from environment variable or use default
const token = process.env.TELEGRAM_BOT_TOKEN;

// Check if we're behind a proxy
let botOptions = { polling: true };

// Check for SOCKS5 proxy settings (optional)
if (process.env.SOCKS5_HOST && process.env.SOCKS5_PORT) {
  const proxyUrl = `socks5://${process.env.SOCKS5_HOST}:${process.env.SOCKS5_PORT}`;
  const agent = new SocksProxyAgent(proxyUrl);
  botOptions.request = {
    agent: agent
  };
  console.log(`Using SOCKS5 proxy: ${process.env.SOCKS5_HOST}:${process.env.SOCKS5_PORT}`);
} else if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  botOptions.request = {
    proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  };
  console.log(`Using HTTP proxy: ${process.env.HTTPS_PROXY || process.env.HTTP_PROXY}`);
} else {
  console.log('No proxy configured - connecting directly to Telegram');
}

// Add additional options for better connection handling
botOptions.polling = {
  interval: 3000, // 3 seconds
  autoStart: true,
  params: {
    timeout: 10
  }
};

const bot = new TelegramBot(token, botOptions);

console.log('Telegram bot started...');

// Handle incoming messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  
  console.log(`Received message from ${username} (${chatId}): ${msg.text}`);
  
  if (msg.text === '/start') {
    bot.sendMessage(chatId, 'سلام! به ربات هشدار قیمت ارزهای دیجیتال خوش آمدید.\nلطفاً نام کاربری تلگرام خود را در پنل تنظیمات سایت وارد کنید.');
    
    // If user has username, register their chat_id
    if (username) {
      // Try to find user with @username format first, then without @
      db.get('SELECT user_id FROM user_settings WHERE telegram_username = ? OR telegram_username = ?', 
        [`@${username}`, username], (err, settings) => {
        if (err) {
          console.error('Database error:', err);
          return;
        }
        
        if (settings) {
          // Update chat_id for the user
          db.run('UPDATE user_settings SET telegram_chat_id = ? WHERE user_id = ?', 
            [chatId, settings.user_id], 
            (err) => {
              if (err) {
                console.error('Database error:', err);
              } else {
                bot.sendMessage(chatId, 'حساب شما با موفقیت به سیستم متصل شد!');
                console.log(`Chat ID ${chatId} registered for user @${username} (user_id: ${settings.user_id})`);
              }
            });
        } else {
          bot.sendMessage(chatId, 'لطفاً ابتدا نام کاربری تلگرام خود را در پنل تنظیمات سایت وارد کنید.');
          console.log(`No user found with telegram username: @${username} or ${username}`);
        }
      });
    } else {
      bot.sendMessage(chatId, 'لطفاً برای حساب تلگرام خود نام کاربری انتخاب کنید و مجدداً تلاش کنید.');
    }
  }
});

// Function to send alert message
const sendAlertMessage = async (userId, coinName, coinSymbol, targetPrice, currentPrice, tolerance, alertType = 'profit') => {
  return new Promise((resolve, reject) => {
    db.get('SELECT telegram_chat_id FROM user_settings WHERE user_id = ?', [userId], (err, settings) => {
      if (err) {
        console.error('Database error:', err);
        return reject(err);
      }
      
      if (!settings || !settings.telegram_chat_id) {
        console.log('Chat ID not found for user:', userId);
        return reject('Chat ID not found');
      }
      
      const changePercent = ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2);
      const alertTypeText = alertType === 'profit' ? 'حد سود' : 'حد ضرر';
      const alertIcon = alertType === 'profit' ? '📈' : '📉';
      
      const message = `
🚨 *هشدار قیمت ارز دیجیتال*

📊 *ارز:* ${coinName} (${coinSymbol.toUpperCase()})
💰 *قیمت فعلی:* $${currentPrice}
🎯 *قیمت هدف:* $${targetPrice}
📊 *درصد تغییر:* ${changePercent}%
${alertIcon} *نوع هشدار:* ${alertTypeText}
📈 *وضعیت:* قیمت به ${alertTypeText} رسید

⏰ زمان: ${new Date().toLocaleString('fa-IR')}
      `;
      
      bot.sendMessage(settings.telegram_chat_id, message, { parse_mode: 'Markdown' })
        .then(response => {
          console.log(`${alertType} alert message sent to user ${userId}`);
          resolve(response);
        })
        .catch(error => {
          console.error('Error sending Telegram message:', error.message);
          reject(error);
        });
    });
  });
};

module.exports = { bot, sendAlertMessage };
