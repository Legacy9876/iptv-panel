const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required.' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required.' 
    });
  }

  next();
};

// Reseller middleware (admin or reseller)
const resellerMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required.' 
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'reseller') {
    return res.status(403).json({ 
      error: 'Reseller or admin access required.' 
    });
  }

  next();
};

module.exports = {
  adminMiddleware,
  resellerMiddleware
}; 