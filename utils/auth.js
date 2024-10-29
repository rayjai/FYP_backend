const jwt = require('jsonwebtoken');

const generateToken = function (user) {
    return jwt.sign(user, process.env.TOKEN_SECRET,{
        expiresIn: 86400
    });
}

module.exports = {generateToken};