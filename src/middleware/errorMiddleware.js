const errorHandler = (err, req, res, next) => {
  let statusCode =
    err.statusCode ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Server Error";

  if (process.env.NODE_ENV === "development") {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, message);
  }

  // Prisma Unique Constraint Violation
  if (err.code === "P2002") {
    const fields = err.meta?.target ? err.meta.target.join(", ") : "field";
    message = `Duplicate value entered for ${fields}`;
    statusCode = 400;
  }

  // Prisma Record Not Found
  if (err.code === "P2025") {
    message = "Requested resource not found";
    statusCode = 404;
  }

  // Prisma Foreign Key Constraint
  if (err.code === "P2003") {
    message = "Invalid reference ID provided";
    statusCode = 400;
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    message = "Invalid token. Please log in again.";
    statusCode = 401;
  }

  if (err.name === "TokenExpiredError") {
    message = "Your token has expired. Please log in again.";
    statusCode = 401;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
