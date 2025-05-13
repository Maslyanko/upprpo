const { verifyToken } = require('../utils/jwt');

/**
 * Middleware to protect routes that require authentication
 */
const protect = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Требуется авторизация'
    });
  }

  // Extract token
  const token = authHeader.split(' ')[1];

  // Verify token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Недействительный токен'
    });
  }

  // Set user on request object
  req.user = decoded;
  next();
};

module.exports = {
  protect,
};