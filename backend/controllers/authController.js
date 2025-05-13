const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user
 * @route POST /auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Проверяем, существует ли уже пользователь с таким email
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        code: 'EMAIL_EXISTS',
        message: 'Email уже зарегистрирован'
      });
    }

    // Создаем нового пользователя
    const newUser = await User.create({
      email,
      password,
      fullName: fullName || email.split('@')[0] // Временное имя по умолчанию
    });

    res.status(201).json(newUser);
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
    const { email, password, fullName } = req.body;

    // Находим пользователя по email (получаем полные данные включая пароль)
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    // Проверяем пароль
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль'
      });
    }

    // Генерируем токен
    const token = generateToken({
      id: user.id, 
      email: user.email, 
    });

    // Форматируем данные пользователя для ответа (без пароля)
    const userForResponse = User.formatUserData(user);

    res.status(200).json({
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