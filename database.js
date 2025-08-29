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
