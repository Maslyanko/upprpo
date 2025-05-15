const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Что-то пошло не так';

  res.status(statusCode).json({
    code: errorCode,
    message
  });
};

module.exports = errorHandler;