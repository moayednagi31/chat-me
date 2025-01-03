/**
 * User Model.
 */
const User = require('../models/user');

/**
 * HttpErrors Module.
 */
const createError = require('http-errors');

/**
 * Login.
 * @param req
 * @param res
 * @param next
 */
exports.login = (req, res, next) => {
    // Get username and password from request
    const { username, password } = req.body;
    // Find user by username
    User.findOne({ username }).then(user => {
        // If user not found or password is incorrect, throw an error
        if (!user || !user.checkPassword(password)) {
            throw createError(401, 'Please check the username and password');
        }
        // Generate user token
        res.json(user.signJwt());
    })
    .catch(next);
};

/**
 * Register.
 * @param req
 * @param res
 * @param next
 */
exports.register = (req, res, next) => {
    // Get name, username, and password from request
    let data = { name, username, password } = req.body;
    // Check if username already exists
    User.findOne({ username })
    .then(user => {
        // If username already exists, throw an error
        if (user) throw createError(422, "Username already exists");
        // Create a new user
        return User.create(data);
    })
    .then(user => {
        // Generate user token
        res.json(user.signJwt());
        // Broadcast created user profile to other users
        sendNewUser(user);
    })
    .catch(next);
};

/**
 * Broadcast created user profile to other users.
 * @param user
 */
const sendNewUser = user => {
    let data = { name, username, avatar } = user;
    io.emit('new_user', data);
};
