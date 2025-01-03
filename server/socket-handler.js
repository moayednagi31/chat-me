io = require('socket.io')();

/**
 * Authentication middleware.
 */
const auth = require('./middlewares/auth');

/**
 * Message Model.
 */
const Message = require('./models/message');

/**
 * User Model.
 */
const User = require('./models/user');

/**
 * User statuses.
 */
const users = {};

/**
 * Add auth middleware to socket.io server.
 */
io.use(auth.socket);

/**
 * Handle new connections.
 */
io.on('connection', (socket) => {
    try {
        onSocketConnected(socket);
    } catch (err) {
        console.error('[SERVER] Error in onSocketConnected:', err);
    }

    // ---------------- EXISTING EVENTS ----------------
    socket.on('message', (data) => {
        try {
            onMessage(socket, data);
        } catch (err) {
            console.error('[SERVER] Error in onMessage:', err);
        }
    });

    socket.on('typing', (receiver) => {
        try {
            onTyping(socket, receiver);
        } catch (err) {
            console.error('[SERVER] Error in onTyping:', err);
        }
    });

    socket.on('seen', (sender) => {
        try {
            onSeen(socket, sender);
        } catch (err) {
            console.error('[SERVER] Error in onSeen:', err);
        }
    });

    // Load initial data (contacts, messages, etc.)
    try {
        initialData(socket);
    } catch (err) {
        console.error('[SERVER] Error in initialData:', err);
    }

    // -------------- NEW WEBRTC CALL EVENTS -----------
    socket.on('callUser', ({ recipientId, callerName }) => {
        try {
            if (!socket.user) {
                console.warn('[SERVER] callUser: socket.user is undefined');
                return;
            }
            console.log(`${socket.user.id} is calling ${recipientId}`);
            // Notify the callee about the incoming call
            io.to(recipientId).emit('incomingCall', {
                from: socket.user.id,
                callerName: callerName,
            });
        } catch (err) {
            console.error('[SERVER] Error in callUser event:', err);
        }
    });

    // Caller sends an SDP offer
    socket.on('offer', (payload) => {
        try {
            if (!socket.user) {
                console.warn('[SERVER] offer: socket.user is undefined');
                return;
            }
            console.log(`Offer from ${socket.user.id} to ${payload.target}`);
            io.to(payload.target).emit('offer', {
                sdp: payload.sdp,
                caller: socket.user.id,
            });
        } catch (err) {
            console.error('[SERVER] Error in offer event:', err);
        }
    });

    // Callee sends an SDP answer
    socket.on('answer', (payload) => {
        try {
            if (!socket.user) {
                console.warn('[SERVER] answer: socket.user is undefined');
                return;
            }
            console.log(`Answer from ${socket.user.id} to ${payload.target}`);
            io.to(payload.target).emit('answer', {
                sdp: payload.sdp,
                callee: socket.user.id,
            });
        } catch (err) {
            console.error('[SERVER] Error in answer event:', err);
        }
    });

    // Either side sends ICE candidates
    socket.on('iceCandidate', (payload) => {
        try {
            if (!socket.user) {
                console.warn('[SERVER] iceCandidate: socket.user is undefined');
                return;
            }
            console.log(`ICE candidate from ${socket.user.id} to ${payload.target}`);
            io.to(payload.target).emit('iceCandidate', {
                candidate: payload.candidate,
                from: socket.user.id,
            });
        } catch (err) {
            console.error('[SERVER] Error in iceCandidate event:', err);
        }
    });

    // A user hangs up the call
    socket.on('hangUp', ({ target }) => {
        try {
            if (!socket.user) {
                console.warn('[SERVER] hangUp: socket.user is undefined');
                return;
            }
            console.log(`${socket.user.id} hung up on ${target}`);
            io.to(target).emit('hangUp');
        } catch (err) {
            console.error('[SERVER] Error in hangUp event:', err);
        }
    });

    // -------------------------------------------------

    // Handle socket disconnect event.
    socket.on('disconnect', () => {
        try {
            onSocketDisconnected(socket);
        } catch (err) {
            console.error('[SERVER] Error in onSocketDisconnected:', err);
        }
    });
});

/**
 * Handle new connection event.
 * @param socket
 */
const onSocketConnected = (socket) => {
    if (!socket.user) {
        console.warn('[SERVER] onSocketConnected: socket.user is missing');
        return;
    }
    console.log('New client connected: ' + socket.id);
    socket.join(socket.user.id);
    users[socket.user.id] = true;
    let room = io.sockets.adapter.rooms[socket.user.id];
    if (!room || room.length === 1) {
        io.emit('user_status', {
            [socket.user.id]: true,
        });
    }
};

/**
 * Handle socket disconnection.
 * @param socket
 */
const onSocketDisconnected = (socket) => {
    if (!socket.user) {
        console.warn('[SERVER] onSocketDisconnected: socket.user is missing');
        return;
    }
    let room = io.sockets.adapter.rooms[socket.user.id];
    if (!room || room.length < 1) {
        let lastSeen = new Date().getTime();
        users[socket.user.id] = lastSeen;
        io.emit('user_status', {
            [socket.user.id]: lastSeen,
        });
    }
    console.log('Client disconnected: ' + socket.user.username);
};

/**
 * Handle user-to-user message event.
 * @param socket
 * @param data
 */
const onMessage = (socket, data) => {
    if (!socket.user) {
        console.warn('[SERVER] onMessage: socket.user is missing');
        return;
    }
    let sender = socket.user.id;
    let receiver = data.receiver;
    let message = {
        sender: sender,
        receiver: receiver,
        content: data.content,
        date: new Date().getTime(),
    };
    Message.create(message).catch((err) => {
        console.error('[SERVER] Error creating message in DB:', err);
    });
    socket.to(receiver).to(sender).emit('message', message);
};

/**
 * Handle typing message event.
 * @param socket
 * @param receiver
 */
const onTyping = (socket, receiver) => {
    if (!socket.user) {
        console.warn('[SERVER] onTyping: socket.user is missing');
        return;
    }
    let sender = socket.user.id;
    socket.to(receiver).emit('typing', sender);
};

/**
 * Handle message seen event.
 * @param socket
 * @param sender
 */
const onSeen = (socket, sender) => {
    if (!socket.user) {
        console.warn('[SERVER] onSeen: socket.user is missing');
        return;
    }
    let receiver = socket.user.id;
    Message.updateMany({ sender, receiver, seen: false }, { seen: true }, { multi: true }).exec();
};

/**
 * Get all user messages.
 * @param userId
 * @returns {Query}
 */
const getMessages = (userId) => {
    let where = [{ sender: userId }, { receiver: userId }];
    return Message.find().or(where);
};

/**
 * Get all users except the connected user.
 * @param userId
 * @returns {Query}
 */
const getUsers = (userId) => {
    let where = { _id: { $ne: userId } };
    return User.find(where).select('-password');
};

/**
 * Initialize user data after connection.
 * @param socket
 */
const initialData = (socket) => {
    if (!socket.user) {
        console.warn('[SERVER] initialData: socket.user is missing');
        return;
    }
    let user = socket.user;
    let messages = [];
    getMessages(user.id)
        .then((data) => {
            messages = data;
            return getUsers(user.id);
        })
        .then((contacts) => {
            socket.emit('data', user, contacts, messages, users);
        })
        .catch((err) => {
            console.error('[SERVER] Error in initialData chain:', err);
            socket.disconnect();
        });
};

module.exports = io;
