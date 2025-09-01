const Database = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Create database connection
const db = new Database.Database(path.join(__dirname, 'data', 'database.sqlite'));

// Initialize database tables
const initDatabase = () => {
  // Create users table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_settings table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        telegram_username TEXT,
        telegram_chat_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    
    // Add telegram_chat_id column if it doesn't exist (for existing databases)
    db.run(`
      ALTER TABLE user_settings ADD COLUMN telegram_chat_id TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding telegram_chat_id column:', err);
      }
    });
    
    // Add unique index for telegram_chat_id if it doesn't exist
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_chat_id ON user_settings (telegram_chat_id)
    `, (err) => {
      if (err) {
        console.error('Error creating index for telegram_chat_id:', err);
      }
    });
    
    // Create alerts table
    db.run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        coin_id TEXT NOT NULL,
        coin_name TEXT NOT NULL,
        coin_symbol TEXT NOT NULL,
        target_price REAL NOT NULL,
        loss_limit REAL,
        tolerance REAL NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        is_triggered BOOLEAN DEFAULT 0,
        profit_triggered BOOLEAN DEFAULT 0,
        loss_triggered BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    
    // Check if alert_targets table exists and has the correct schema
    db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='alert_targets'`, (err, row) => {
      if (err) {
        console.error('Error checking alert_targets schema:', err);
        return;
      }
      
      // If table doesn't exist or has old constraint, recreate it
      if (!row || row.sql.includes("'profit target'") || row.sql.includes("'loss limit'")) {
        console.log('Migrating alert_targets table to new schema...');
        
        // Backup existing data
        db.run(`CREATE TABLE IF NOT EXISTS alert_targets_backup AS SELECT * FROM alert_targets`, (err) => {
          if (err && !err.message.includes('no such table')) {
            console.error('Error backing up alert_targets:', err);
          }
          
          // Drop old table
          db.run(`DROP TABLE IF EXISTS alert_targets`, (err) => {
            if (err) {
              console.error('Error dropping old alert_targets table:', err);
              return;
            }
            
            // Create new table with correct schema
            db.run(`
              CREATE TABLE alert_targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id INTEGER NOT NULL,
                target_price REAL NOT NULL,
                alert_type TEXT NOT NULL CHECK (alert_type IN ('Profit target', 'Loss limit', 'Watch Market', 'Target', 'Step buy', 'Step sell', 'custom')),
                tolerance REAL DEFAULT 1.0,
                description TEXT,
                is_triggered BOOLEAN DEFAULT 0,
                triggered_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE
              )
            `, (err) => {
              if (err) {
                console.error('Error creating new alert_targets table:', err);
                return;
              }
              
              // Restore data from backup if it exists, mapping only compatible columns
              db.run(`INSERT INTO alert_targets (id, alert_id, target_price, alert_type, tolerance, is_triggered, triggered_at, created_at) 
                      SELECT id, alert_id, target_price, 
                             CASE 
                               WHEN alert_type = 'profit target' THEN 'Profit target'
                               WHEN alert_type = 'loss limit' THEN 'Loss limit'
                               WHEN alert_type = 'watch market' THEN 'Watch Market'
                               WHEN alert_type = 'target raised' THEN 'Target'
                               WHEN alert_type = 'market down' THEN 'Step sell'
                               WHEN alert_type = 'market up' THEN 'Step buy'
                               ELSE 'custom'
                             END as alert_type,
                             COALESCE(tolerance, 1.0) as tolerance,
                             is_triggered, triggered_at, created_at
                      FROM alert_targets_backup 
                      WHERE EXISTS (SELECT 1 FROM alert_targets_backup)`, (err) => {
                if (err && !err.message.includes('no such table')) {
                  console.error('Error restoring alert_targets data:', err);
                } else {
                  console.log('alert_targets table migration completed successfully');
                }
                
                // Clean up backup table
                db.run(`DROP TABLE IF EXISTS alert_targets_backup`, (err) => {
                  if (err) {
                    console.error('Error cleaning up backup table:', err);
                  }
                });
              });
            });
          });
        });
      } else {
        // Table exists with correct schema
        console.log('alert_targets table schema is up to date');
      }
    });
    
    // Add description column to existing alert_targets table if it doesn't exist
    db.run(`
      ALTER TABLE alert_targets ADD COLUMN description TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding description column:', err);
      }
    });
    
    // Update tolerance column to be nullable
    db.run(`
      ALTER TABLE alert_targets ADD COLUMN tolerance_new REAL DEFAULT 1.0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        // Copy data from old tolerance column to new one
        db.run(`UPDATE alert_targets SET tolerance_new = tolerance WHERE tolerance IS NOT NULL`);
        // Note: SQLite doesn't support dropping columns easily, so we keep both for compatibility
      }
    });
    
    // Add new columns if they don't exist (for existing databases)
    db.run(`
      ALTER TABLE alerts ADD COLUMN loss_limit REAL
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding loss_limit column:', err);
      }
    });
    
    db.run(`
      ALTER TABLE alerts ADD COLUMN profit_triggered BOOLEAN DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding profit_triggered column:', err);
      }
    });
    
    db.run(`
      ALTER TABLE alerts ADD COLUMN loss_triggered BOOLEAN DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding loss_triggered column:', err);
      }
    });
    
    // Add is_triggered column if it doesn't exist (for existing databases)
    db.run(`
      ALTER TABLE alerts ADD COLUMN is_triggered BOOLEAN DEFAULT 0
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding is_triggered column:', err);
      }
    });
    
    console.log('Database initialized successfully');
  });
};

// Function to create a new user (for manual user creation)
const createUser = (username, password) => {
  return new Promise((resolve, reject) => {
    // Check if username already exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
      if (err) {
        return reject(err);
      }
      
      if (existingUser) {
        return reject(new Error('Username already exists'));
      }
      
      // Hash password
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);
      
      // Insert user
      db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username });
          }
        }
      );
    });
  });
};

module.exports = { initDatabase, db, createUser };
