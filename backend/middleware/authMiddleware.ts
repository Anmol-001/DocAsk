import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include a user object
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { sub: string };

    if (!decoded.sub) {
      res.status(401).json({ error: 'Unauthorized: Malformed token payload' });
      return;
    }

    req.user = {
      id: decoded.sub
    };

    next();
  } catch (error: any) {
    console.error('JWT verification error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
