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
  
  try {
    // Get all active alerts first
    const alerts = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM alerts WHERE is_active = 1', [], (err, alerts) => {
        if (err) reject(err);
        else resolve(alerts || []);
      });
    });
    
    console.log(`Found ${alerts.length} active alerts`);
    
    // Process each alert
    for (const alert of alerts) {
      try {
        // Get targets for this alert
        const targets = await new Promise((resolve, reject) => {
          db.all('SELECT * FROM alert_targets WHERE alert_id = ? AND is_triggered = 0', [alert.id], (err, targets) => {
            if (err) reject(err);
            else resolve(targets || []);
          });
        });
        
        if (targets.length === 0) {
          continue; // No active targets for this alert
        }
        
        console.log(`Checking ${targets.length} targets for ${alert.coin_name}`);
        
        // Get current price
        const currentPrice = await getCoinPrice(alert.coin_id);
        
        if (currentPrice === undefined) {
          console.log(`Could not fetch price for ${alert.coin_id}`);
          continue;
        }
        
        // Check each target
        for (const target of targets) {
          let shouldTrigger = false;
          
          // Check different alert types
          switch (target.alert_type) {
            case 'Profit target':
              shouldTrigger = currentPrice >= target.target_price * (1 - (target.tolerance || 1.0) / 100);
              break;
            case 'Loss limit':
              shouldTrigger = currentPrice <= target.target_price * (1 + (target.tolerance || 1.0) / 100);
              break;
            case 'Watch Market':
              shouldTrigger = isPriceWithinTolerance(currentPrice, target.target_price, target.tolerance || 1.0);
              break;
            case 'Target':
              shouldTrigger = isPriceWithinTolerance(currentPrice, target.target_price, target.tolerance || 1.0);
              break;
            case 'Step buy':
              shouldTrigger = currentPrice <= target.target_price * (1 + (target.tolerance || 1.0) / 100);
              break;
            case 'Step sell':
              shouldTrigger = currentPrice >= target.target_price * (1 - (target.tolerance || 1.0) / 100);
              break;
            case 'custom':
              shouldTrigger = isPriceWithinTolerance(currentPrice, target.target_price, target.tolerance || 1.0);
              break;
          }
          
          if (shouldTrigger) {
            console.log(`${target.alert_type} triggered for ${alert.coin_name} (${alert.coin_symbol}) at $${currentPrice}`);
            
            // Send Telegram alert
            try {
              await sendAlertMessage(
                alert.user_id,
                alert.coin_name,
                alert.coin_symbol,
                target.target_price,
                currentPrice,
                target.tolerance,
                target.alert_type,
                target.description
              );
              console.log(`Telegram alert sent for target ${target.id}`);
            } catch (error) {
              console.error(`Error sending Telegram alert for target ${target.id}:`, error.message);
            }
            
            // Mark target as triggered
            db.run('UPDATE alert_targets SET is_triggered = 1, triggered_at = CURRENT_TIMESTAMP WHERE id = ?', [target.id], (err) => {
              if (err) {
                console.error('Error updating target status:', err);
              } else {
                console.log(`Target ${target.id} marked as triggered`);
              }
            });
          }
        }
        
      } catch (error) {
        console.error(`Error processing alert ${alert.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error in checkAlerts:', error);
  }
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
