import rateLimit from 'express-rate-limit';

// Limit document uploads to 20 per hour per IP
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many documents uploaded from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit QA questions to 100 per 15 minutes per IP
export const qaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many questions asked from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
