// Production Security Headers, NoSQL Injection Sanitizer & In-Memory Rate Limiter

const rateLimitStore = new Map();

// Clean up expired rate-limit entries periodically
const cleanupRateLimitStore = (now) => {
  if (rateLimitStore.size > 5000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }
};

// Recursively strip keys starting with '$' to prevent NoSQL operator injection
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("$")) {
      clean[key] = sanitizeObject(value);
    }
  }
  return clean;
};

const securityHeadersAndSanitizer = (req, res, next) => {
  // Set standard HTTP security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Sanitize incoming body against NoSQL injection
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  next();
};

const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 150 } = {}) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const now = Date.now();
    cleanupRateLimitStore(now);

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const key = `${ip}:${req.baseUrl || "global"}`;

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: "Too many requests from this IP, please try again later.",
      });
    }

    next();
  };
};

module.exports = {
  securityHeadersAndSanitizer,
  createRateLimiter,
};
