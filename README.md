# Crypto Price Monitor with Telegram Alerts

A comprehensive cryptocurrency price monitoring application that tracks real-time prices and sends automated alerts via Telegram when price targets are reached. Built with Node.js, Express, and SQLite, featuring a responsive web dashboard and Telegram bot integration.

## 🚀 Features

### Core Features
- **Real-time Price Monitoring**: Track cryptocurrency prices from CoinGecko API
- **Automated Alerts**: Set profit targets and loss limits with customizable tolerance
- **Telegram Integration**: Receive instant notifications via Telegram bot
- **User Management**: Secure registration and authentication system
- **Responsive Dashboard**: Modern web interface for managing alerts
- **Persistent Storage**: SQLite database for reliable data storage

### Alert System
- **Dual Target Alerts**: Set both profit targets and loss limits
- **Tolerance Support**: Configure percentage tolerance for price triggers
- **One-time Triggers**: Alerts deactivate after being triggered
- **Status Tracking**: Visual indicators for triggered/untriggered alerts

### Telegram Bot Features
- **Instant Notifications**: Real-time alerts when price targets are hit
- **User Registration**: Link Telegram accounts to web dashboard
- **Persian Language Support**: Native Persian (Farsi) interface
- **Proxy Support**: Works behind SOCKS5 or HTTP proxies

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3 with SQL schema
- **Authentication**: JWT tokens, bcrypt password hashing
- **API**: CoinGecko API for real-time crypto prices
- **Telegram**: node-telegram-bot-api library
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Deployment**: Docker & Docker Compose

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Telegram Bot Token (from @BotFather)
- Docker & Docker Compose (optional)

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd crypto-monitor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-from-botfather

# Optional: Proxy Configuration (for restricted networks)
SOCKS5_HOST=127.0.0.1
SOCKS5_PORT=1080
HTTPS_PROXY=http://proxy.example.com:8080
```

### 4. Database Setup
The application automatically creates the SQLite database on first run. Database schema includes:
- Users table for authentication
- Alerts table for price monitoring
- User settings for Telegram integration

### 5. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Docker Deployment
```bash
docker-compose up -d
```

## 📱 Telegram Bot Setup

1. **Create Bot**: Message @BotFather on Telegram to create a new bot
2. **Get Token**: Copy the provided bot token to your `.env` file
3. **Set Username**: Choose a username for your bot (e.g., @YourCryptoMonitorBot)
4. **Start Bot**: Send `/start` to your bot to initialize

### Linking Telegram Account
1. Open the web dashboard
2. Go to Settings page
3. Enter your Telegram username (with or without @)
4. Send `/start` to your bot
5. Your account will be automatically linked

## 🌐 Usage Guide

### Web Dashboard
1. **Register/Login**: Create an account or log in
2. **Browse Coins**: View top cryptocurrencies with current prices
3. **Search Coins**: Find specific cryptocurrencies using search
4. **Create Alerts**: Set profit targets and loss limits
5. **Manage Alerts**: Edit or delete existing alerts

### Setting Up Alerts
1. **Select Coin**: Choose from available cryptocurrencies
2. **Set Targets**:
   - **Profit Target**: Price to trigger profit alert
   - **Loss Limit**: Price to trigger loss alert (optional)
   - **Tolerance**: Percentage range for trigger sensitivity
3. **Save Alert**: Alert becomes active immediately

### Alert Notifications
- **Profit Alerts**: Triggered when price reaches target (within tolerance)
- **Loss Alerts**: Triggered when price drops to limit (within tolerance)
- **Status Updates**: Visual indicators show triggered/untriggered status
- **Auto-deactivation**: Alerts deactivate after both targets are triggered

## 🔍 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Alerts Management
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update existing alert
- `DELETE /api/alerts/:id` - Delete alert

### Cryptocurrency Data
- `GET /api/coins` - Get top cryptocurrencies
- `GET /api/coins/search` - Search cryptocurrencies

### User Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## 🐳 Docker Deployment

The application includes a complete Docker setup:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### Docker Services
- **app**: Main application container
- **watchtower**: Automatic container updates (optional)

## 🔐 Security Features

- **Password Hashing**: bcrypt for secure password storage
- **JWT Authentication**: Stateless authentication tokens
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: Basic rate limiting on API endpoints
- **HTTPS Support**: Ready for SSL/TLS deployment

## 🌍 Internationalization

- **Persian Language**: Native Persian interface for Telegram bot
- **RTL Support**: Right-to-left text support
- **Local Time**: Persian calendar and time formatting

## 📊 Monitoring & Logging

- **Console Logging**: Detailed logs for debugging
- **Error Handling**: Comprehensive error handling throughout
- **Database Logging**: Query execution logs
- **Telegram Logging**: Bot interaction logs

## 🔄 Alert Checking

The system checks alerts every 5 minutes using a background process:
- Fetches current prices from CoinGecko
- Compares against user-defined targets
- Sends Telegram notifications when triggered
- Updates alert status in database

## 🛡️ Troubleshooting

### Common Issues

**Bot not responding**:
- Check TELEGRAM_BOT_TOKEN in .env
- Verify bot is started with @BotFather
- Check network connectivity

**Alerts not triggering**:
- Verify CoinGecko API connectivity
- Check alert tolerance settings
- Ensure Telegram username is correctly linked

**Database errors**:
- Check file permissions for database directory
- Verify SQLite is properly installed
- Check disk space availability

### Debug Mode
Enable detailed logging by setting:
```bash
DEBUG=* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review logs for error details

## 🔄 Updates

The application includes Watchtower for automatic updates when using Docker deployment. For manual updates:

```bash
git pull origin main
npm install
npm restart
```

---

**Built with ❤️ for the crypto community**
