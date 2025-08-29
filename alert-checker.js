const { db } = require('./database');
const { getCoinPrice } = require('./coin-search');
const { sendAlertMessage } = require('./telegram-bot');

// Check if price is within tolerance range
const isPriceWithinTolerance = (currentPrice, targetPrice, tolerance) => {
  const toleranceAmount = targetPrice * (tolerance / 100);
  const lowerBound = targetPrice - toleranceAmount;
  const upperBound = targetPrice + toleranceAmount;
  
  return currentPrice >= lowerBound && currentPrice <= upperBound;
};

// Check all active alerts
const checkAlerts = async () => {
  console.log('Checking active alerts...');
  
  // Get all active alerts
  db.all(`
    SELECT a.*, u.username, us.telegram_username 
    FROM alerts a 
    JOIN users u ON a.user_id = u.id 
    LEFT JOIN user_settings us ON a.user_id = us.user_id 
    WHERE a.is_active = 1
  `, [], async (err, alerts) => {
    if (err) {
      console.error('Database error:', err);
      return;
    }
    
    // Process each alert
    for (const alert of alerts) {
      try {
        // Get current price
        const currentPrice = await getCoinPrice(alert.coin_id);
        
        if (currentPrice === undefined) {
          console.log(`Could not fetch price for ${alert.coin_id}`);
          continue;
        }
        
        let alertTriggered = false;
        
        // Check profit target (if not already triggered)
        if (!alert.profit_triggered && isPriceWithinTolerance(currentPrice, alert.target_price, alert.tolerance)) {
          console.log(`Profit target triggered for ${alert.coin_name} (${alert.coin_symbol})`);
          
          // Send Telegram alert for profit target
          try {
            await sendAlertMessage(
              alert.user_id,
              alert.coin_name,
              alert.coin_symbol,
              alert.target_price,
              currentPrice,
              alert.tolerance,
              'profit'
            );
            console.log(`Telegram profit alert sent for alert ${alert.id}`);
          } catch (error) {
            console.error(`Error sending Telegram profit alert for alert ${alert.id}:`, error.message);
          }
          
          // Mark profit target as triggered
          db.run('UPDATE alerts SET profit_triggered = 1 WHERE id = ?', [alert.id], (err) => {
            if (err) {
              console.error('Error updating profit alert status:', err);
            } else {
              console.log(`Profit alert ${alert.id} marked as triggered`);
            }
          });
          
          alertTriggered = true;
        }
        
        // Check loss limit (if not already triggered and loss_limit is set)
        if (!alert.loss_triggered && alert.loss_limit && isPriceWithinTolerance(currentPrice, alert.loss_limit, alert.tolerance)) {
          console.log(`Loss limit triggered for ${alert.coin_name} (${alert.coin_symbol})`);
          
          // Send Telegram alert for loss limit
          try {
            await sendAlertMessage(
              alert.user_id,
              alert.coin_name,
              alert.coin_symbol,
              alert.loss_limit,
              currentPrice,
              alert.tolerance,
              'loss'
            );
            console.log(`Telegram loss alert sent for alert ${alert.id}`);
          } catch (error) {
            console.error(`Error sending Telegram loss alert for alert ${alert.id}:`, error.message);
          }
          
          // Mark loss limit as triggered
          db.run('UPDATE alerts SET loss_triggered = 1 WHERE id = ?', [alert.id], (err) => {
            if (err) {
              console.error('Error updating loss alert status:', err);
            } else {
              console.log(`Loss alert ${alert.id} marked as triggered`);
            }
          });
          
          alertTriggered = true;
        }
        
        // If both targets are triggered, deactivate the alert
        if (alert.profit_triggered && alert.loss_triggered) {
          db.run('UPDATE alerts SET is_active = 0 WHERE id = ?', [alert.id], (err) => {
            if (err) {
              console.error('Error deactivating alert:', err);
            } else {
              console.log(`Alert ${alert.id} deactivated - both targets triggered`);
            }
          });
        }
        
      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error.message);
      }
    }
  });
};

// Start alert checking interval (every 5 minutes)
const startAlertChecker = () => {
  console.log('Starting alert checker...');
  
  // Check immediately
  checkAlerts();
  
  // Check every 5 minutes
  setInterval(checkAlerts, 5 * 60 * 1000);
};

module.exports = { startAlertChecker };
