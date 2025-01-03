/**
 * Include .env config file to app process
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors'); // إضافة دعم CORS

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
 * Middleware
 */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS (اختياري)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));

/**
 * Routes
 */
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));

/**
 * Error Handling
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
 * Connect to MongoDB Atlas
 */
mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}, (err) => {
    if (err) {
        console.error('Failed to connect to MongoDB Atlas:', err.message);
        process.exit(1); // Terminate the process if connection fails
    }
    console.log('Connected successfully to MongoDB Atlas');
});

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

/**
 * Start Server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
