// ==== File: backend/controllers/authController.js ====
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user
 * @route POST /auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    const existingUserByEmail = await User.findByEmail(email, true); // Check if email exists
    if (existingUserByEmail) {
      return res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email уже зарегистрирован'
      });
    }

    const newUser = await User.create({
      email,
      password,
      fullName: fullName || email.split('@')[0]
    });
    
    // newUser here is already formatted by User.create (which calls User.findById)
    // It includes dynamic stats.

    // For consistency with login, generate a token and return it
     const token = generateToken({
      id: newUser.id,
      email: newUser.email,
    });

    res.status(201).json({
        user: newUser, // Send the full user object with stats
        accessToken: token
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при регистрации'
    });
  }
};

/**
 * Login user
 * @route POST /auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body; // fullName not used for login

    // Find user by email, including password hash for comparison
    const userWithPassword = await User.findByEmail(email, true);
    if (!userWithPassword) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    const isPasswordValid = await User.comparePassword(password, userWithPassword.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    const token = generateToken({
      id: userWithPassword.id,
      email: userWithPassword.email,
    });

    // Fetch user data again, this time formatted and with stats
    const userForResponse = await User.findById(userWithPassword.id);

    res.status(200).json({
      user: userForResponse, // Send the full user object with stats
      accessToken: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Ошибка при входе'
    });
  }
};

module.exports = {
  register,
  login
};