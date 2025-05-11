const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fileUpload = require('express-fileupload'); // Добавляем модуль для загрузки файлов
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const courseRoutes = require('./routes/courseRoutes');

// Create Express app
const app = express();

// Middleware
app.use(cors());

// Настройка helmet с учетом необходимости загрузки изображений
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  })
);

app.use(morgan('dev'));
app.use(express.json());

// Middleware для загрузки файлов
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB макс. размер файла
  abortOnLimit: true,
  responseOnLimit: 'Файл слишком большой (макс. 5MB)'
}));

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/courses', courseRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;