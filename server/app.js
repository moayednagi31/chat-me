/**
 * Include .env config file to app process
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');

/**
 * Include socket.io handler.
 */
require('./socket-handler');

/**
 * Express Routers.
 */
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

// Express Application
const app = express();

/**
 * Express Middleware's.
 */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Routes
 */
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));

/**
 * Errors handling
 */
app.use((err, req, res, next) => {
    if (err.name === 'MongoError' || err.name === 'ValidationError' || err.name === 'CastError') {
        err.status = 422;
    }
    if (req.get('accept') && req.get('accept').includes('json')) {
        res.status(err.status || 500).json({ message: err.message || 'Some error occurred.' });
    } else {
        res.status(err.status || 500).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

/**
 * Connect to MongoDB Atlas using async/await
 */
async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.DB_URL, {
            family: 4,  // Optional: to force the use of IPv4
        });
        console.log('Connected successfully to MongoDB Atlas');
    } catch (err) {
        console.error('Failed to connect to MongoDB Atlas:', err.message);
        process.exit(1); // Terminate the process if connection fails
    }
}

connectToDatabase();

/**
 * Monitor Mongoose connection events
 */
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

module.exports = app;
