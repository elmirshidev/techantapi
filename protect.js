const User = require('./models/User.js')
const jwt = require('jsonwebtoken')


const protect = async (req,res,next) => {
    let token;
    token = req.cookies.jwt;

    if(token) {
        try {
            const decoded = jwt.verify(token,process.env.JWT_SECRET)
            req.user = await User.findById(decoded.userId).select('-password')
            next()
        } catch (error) {
            res.status(401)
        }
    } else {
        res.status(401).json({
            error: "No cookie"
        });
    }
}
module.exports = protect;