// Centralized Express Error Handler
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  // Handle PostgreSQL Unique Violation (23505)
  if (err.code === '23505') {
    statusCode = 409;
    message = err.detail || 'Duplicate record: a record with this unique value already exists.';
  }

  // Handle PostgreSQL Foreign Key Violation (23503)
  if (err.code === '23503') {
    statusCode = 400;
    message = err.detail || 'Referenced record does not exist or is constrained by related records.';
  }

  // Handle PostgreSQL Not-Null Violation (23502)
  if (err.code === '23502') {
    statusCode = 400;
    message = `Required field missing: column "${err.column || 'unknown'}" cannot be null.`;
  }

  // Handle PostgreSQL Invalid Data Type / Syntax (22P02)
  if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid data format or numeric parameter syntax.';
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found: invalid ID format';
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // Handle Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate field value entered for '${field}'. Please use another value.`;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
