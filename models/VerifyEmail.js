const mongoose = require('mongoose');


const verifyEmail = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    otpCode: { type: String, required: true },
    createdAt: { type: Date} ,
    expiresAt: {type:Date}
})


const VerifyEmail = mongoose.model('VerifyEmail',verifyEmail);
module.exports = VerifyEmail;