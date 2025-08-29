FROM node:18-alpine

# Install sqlite3 for database operations
RUN apk add --no-cache sqlite

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy app source
COPY . .

# Create data directory for SQLite database
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
