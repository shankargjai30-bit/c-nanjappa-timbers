import admin from './firebaseAdmin.js';

// Middleware to verify Firebase ID tokens
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken; // Attach user info to request object
      next(); // Proceed to the route handler
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Unauthorized: Token has expired' });
      }
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
};
