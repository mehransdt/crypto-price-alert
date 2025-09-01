const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { initDatabase, db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'crypto_monitor_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initDatabase();

// Start alert checker
const { startAlertChecker } = require('./alert-checker');
startAlertChecker();

// Initialize Telegram bot
const { bot } = require('./telegram-bot');

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for user:', username);
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  
  // Get user from database
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    console.log('User found in database:', user);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    console.log('Password provided:', password);
    console.log('Hashed password in database:', user.password);
    
    const isValidPassword = bcrypt.compareSync(password, user.password);
    
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      message: 'Login successful',
      token,
      username: user.username
    });
  });
});

// Get user settings
app.get('/api/settings', authenticateToken, (req, res) => {
  db.get('SELECT telegram_username, telegram_chat_id FROM user_settings WHERE user_id = ?', [req.user.id], (err, settings) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(settings || { telegram_username: '', telegram_chat_id: null });
  });
});

// Update user settings
app.post('/api/settings', authenticateToken, (req, res) => {
  const { telegram_username } = req.body;
  
  // Check if settings exist
  db.get('SELECT id FROM user_settings WHERE user_id = ?', [req.user.id], (err, existing) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (existing) {
      // Update existing settings
      db.run('UPDATE user_settings SET telegram_username = ? WHERE user_id = ?', [telegram_username, req.user.id], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }
        res.json({ message: 'Settings updated successfully' });
      });
    } else {
      // Create new settings
      db.run('INSERT INTO user_settings (user_id, telegram_username) VALUES (?, ?)', [req.user.id, telegram_username], (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }
        res.json({ message: 'Settings updated successfully' });
      });
    }
  });
});

// Get top coins from CoinGecko
app.get('/api/coins', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: false
      }
    });
    
    const coins = response.data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      current_price: coin.current_price,
      image: coin.image
    }));
    
    res.json(coins);
  } catch (error) {
    console.error('Error fetching coins:', error.message);
    res.status(500).json({ message: 'Error fetching coin data' });
  }
});

// Search coins on CoinGecko
app.get('/api/coins/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }
    
    const { searchCoins } = require('./coin-search');
    const coins = await searchCoins(query);
    
    res.json(coins);
  } catch (error) {
    console.error('Error searching coins:', error.message);
    res.status(500).json({ message: 'Error searching coins' });
  }
});

// Get user alerts with their targets
app.get('/api/alerts', authenticateToken, (req, res) => {
  // First get all alerts
  db.all('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, alerts) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (alerts.length === 0) {
      return res.json([]);
    }
    
    // Get targets for each alert
    const alertPromises = alerts.map(alert => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM alert_targets WHERE alert_id = ?', [alert.id], (err, targets) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              ...alert,
              targets: targets || []
            });
          }
        });
      });
    });
    
    Promise.all(alertPromises)
      .then(alertsWithTargets => {
        res.json(alertsWithTargets);
      })
      .catch(error => {
        console.error('Database error:', error);
        res.status(500).json({ message: 'Internal server error' });
      });
  });
});

// Get active alerts for monitoring
app.get('/api/alerts/active', (req, res) => {
  // This endpoint doesn't require authentication as it's used internally
  db.all(`
    SELECT a.*, u.username, us.telegram_username 
    FROM alerts a 
    JOIN users u ON a.user_id = u.id 
    LEFT JOIN user_settings us ON a.user_id = us.user_id 
    WHERE a.is_active = 1 AND a.is_triggered = 0
  `, [], (err, alerts) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json(alerts);
  });
});

// Create new alert with multiple targets
app.post('/api/alerts', authenticateToken, (req, res) => {
  const { coin_id, coin_name, coin_symbol, targets } = req.body;
  
  if (!coin_id || !coin_name || !coin_symbol || !targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ message: 'Coin information and at least one target are required' });
  }
  
  // Create alert first
  db.run('INSERT INTO alerts (user_id, coin_id, coin_name, coin_symbol, target_price, tolerance) VALUES (?, ?, ?, ?, ?, ?)', 
    [req.user.id, coin_id, coin_name, coin_symbol, targets[0].target_price, targets[0].tolerance || 1.0], 
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      const alertId = this.lastID;
      
      // Insert all targets
      const targetInserts = targets.map(target => {
        return new Promise((resolve, reject) => {
          db.run('INSERT INTO alert_targets (alert_id, target_price, alert_type, tolerance, description) VALUES (?, ?, ?, ?, ?)',
            [alertId, target.target_price, target.alert_type, target.tolerance || 1.0, target.description || null],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            });
        });
      });
      
      Promise.all(targetInserts)
        .then(() => {
          // Get the newly created alert
          db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, newAlert) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Internal server error' });
            }
            
            // Get targets for the new alert
            db.all('SELECT * FROM alert_targets WHERE alert_id = ?', [alertId], (err, targets) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Internal server error' });
              }
              
              res.status(201).json({
                message: 'Alert created successfully',
                alert: {
                  ...newAlert,
                  targets: targets || []
                }
              });
            });
          });
        })
        .catch(err => {
          console.error('Error inserting targets:', err);
          res.status(500).json({ message: 'Error creating alert targets' });
        });
    });
});


// Update alert with new targets
app.put('/api/alerts/:id', authenticateToken, (req, res) => {
  const { targets } = req.body;
  const alertId = req.params.id;
  
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ message: 'At least one target is required' });
  }
  
  // Check if alert belongs to user
  db.get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id], (err, existingAlert) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!existingAlert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    // Delete existing targets
    db.run('DELETE FROM alert_targets WHERE alert_id = ?', [alertId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      // Insert new targets
      const targetInserts = targets.map(target => {
        return new Promise((resolve, reject) => {
          db.run('INSERT INTO alert_targets (alert_id, target_price, alert_type, tolerance, description) VALUES (?, ?, ?, ?, ?)',
            [alertId, target.target_price, target.alert_type, target.tolerance || 1.0, target.description || null],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            });
        });
      });
      
      Promise.all(targetInserts)
        .then(() => {
          // Update main alert
          db.run('UPDATE alerts SET target_price = ?, tolerance = ?, is_active = 1 WHERE id = ?', 
            [targets[0].target_price, targets[0].tolerance || 1.0, alertId], 
            (err) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Internal server error' });
              }
              
              res.json({ message: 'Alert updated successfully' });
            });
        })
        .catch(err => {
          console.error('Error updating targets:', err);
          res.status(500).json({ message: 'Error updating alert targets' });
        });
    });
  });
});

// Add target to existing alert
app.post('/api/alerts/:id/targets', authenticateToken, (req, res) => {
  const { target_price, alert_type, tolerance, description } = req.body;
  const alertId = req.params.id;
  
  if (!target_price || !alert_type) {
    return res.status(400).json({ message: 'Target price and alert type are required' });
  }
  
  // Check if alert belongs to user
  db.get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id], (err, existingAlert) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!existingAlert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    db.run('INSERT INTO alert_targets (alert_id, target_price, alert_type, tolerance, description) VALUES (?, ?, ?, ?, ?)',
      [alertId, target_price, alert_type, tolerance || 1.0, description || null],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.status(201).json({
          message: 'Target added successfully',
          target_id: this.lastID
        });
      });
  });
});

// Delete specific target
app.delete('/api/alerts/:alertId/targets/:targetId', authenticateToken, (req, res) => {
  const { alertId, targetId } = req.params;
  
  // Check if alert belongs to user
  db.get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id], (err, existingAlert) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!existingAlert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    db.run('DELETE FROM alert_targets WHERE id = ? AND alert_id = ?', [targetId, alertId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      res.json({ message: 'Target deleted successfully' });
    });
  });
});

// Delete alert
app.delete('/api/alerts/:id', authenticateToken, (req, res) => {
  const alertId = req.params.id;
  
  // Check if alert belongs to user
  db.get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id], (err, existingAlert) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!existingAlert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    db.run('DELETE FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      res.json({ message: 'Alert deleted successfully' });
    });
  });
});


// Telegram registration endpoint (for receiving chat_id from Telegram bot)
app.post('/api/telegram/register', (req, res) => {
  const { telegram_username, telegram_chat_id } = req.body;
  
  if (!telegram_username || !telegram_chat_id) {
    return res.status(400).json({ message: 'Telegram username and chat_id are required' });
  }
  
  // Find user by telegram_username and update chat_id
  db.get('SELECT user_id FROM user_settings WHERE telegram_username = ?', [telegram_username], (err, settings) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!settings) {
      return res.status(404).json({ message: 'User with this Telegram username not found' });
    }
    
    // Update chat_id for the user
    db.run('UPDATE user_settings SET telegram_chat_id = ? WHERE user_id = ?', 
      [telegram_chat_id, settings.user_id], 
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }
        
        res.json({ message: 'Telegram chat_id registered successfully' });
      });
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
