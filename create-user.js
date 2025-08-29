const { createUser } = require('./database');

// Get username and password from command line arguments
const args = process.argv.slice(2);
const username = args[0];
const password = args[1];

if (!username || !password) {
    console.log('Usage: node create-user.js <username> <password>');
    process.exit(1);
}

// Create user
createUser(username, password)
    .then(user => {
        console.log(`User created successfully:`);
        console.log(`ID: ${user.id}`);
        console.log(`Username: ${user.username}`);
    })
    .catch(error => {
        console.error('Error creating user:', error.message);
    });
