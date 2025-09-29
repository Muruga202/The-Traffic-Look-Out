const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// In-memory databases (replace with real database in production)
const drivers = new Map();
const trafficReports = [];
const activeTrackingSessions = new Map();
const trafficData = {
  congestionZones: [
    { id: 1, location: 'Highway 101 North', severity: 'high', lat: 37.7749, lng: -122.4194 },
    { id: 2, location: 'Main Street Bridge', severity: 'moderate', lat: 37.7849, lng: -122.4094 },
    { id: 3, location: 'Oak Avenue', severity: 'low', lat: 37.7649, lng: -122.4294 }
  ],
  emergencyRoutes: [],
  routeCache: new Map()
};

// Confidentiality API - Encryption/Decryption functions
class ConfidentialityAPI {
  static encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static hashPassword(password) {
    return bcrypt.hashSync(password, 10);
  }

  static verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  }
}

// Traffic Agent - AI/Algorithmic Layer
class TrafficAgent {
  static analyzeTrafficConditions() {
    // Simulate real-time traffic analysis
    const conditions = {
      timestamp: new Date().toISOString(),
      congestionLevel: Math.random(),
      incidents: trafficReports.filter(report => 
        Date.now() - new Date(report.timestamp).getTime() < 30 * 60 * 1000 // Last 30 minutes
      ).length,
      emergencyVehiclesActive: Array.from(activeTrackingSessions.values())
        .filter(session => session.vehicleType === 'emergency').length
    };
    
    return conditions;
  }

  static calculateOptimalRoute(startLat, startLng, endLat, endLng, vehicleType = 'regular') {
    const routeKey = `${startLat},${startLng}-${endLat},${endLng}-${vehicleType}`;
    
    // Check cache first
    if (trafficData.routeCache.has(routeKey)) {
      const cached = trafficData.routeCache.get(routeKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes cache
        return cached.route;
      }
    }

    // Simulate route calculation with traffic consideration
    const baseTime = this.calculateDistance(startLat, startLng, endLat, endLng) * 2; // 2 minutes per unit
    let trafficDelay = 0;
    
    // Check for congestion on route
    trafficData.congestionZones.forEach(zone => {
      const distanceToZone = this.calculateDistance(
        (startLat + endLat) / 2, 
        (startLng + endLng) / 2, 
        zone.lat, 
        zone.lng
      );
      
      if (distanceToZone < 2) { // Within 2 units of congestion zone
        switch (zone.severity) {
          case 'high': trafficDelay += 5; break;
          case 'moderate': trafficDelay += 2; break;
          case 'low': trafficDelay += 0.5; break;
        }
      }
    });

    // Emergency vehicles get priority routing
    if (vehicleType === 'emergency') {
      trafficDelay *= 0.3; // 70% reduction in delay
    }

    const totalTime = Math.max(baseTime + trafficDelay, 1);
    const route = {
      distance: this.calculateDistance(startLat, startLng, endLat, endLng).toFixed(1) + ' km',
      duration: totalTime.toFixed(0) + ' min',
      waypoints: this.generateWaypoints(startLat, startLng, endLat, endLng, vehicleType),
      trafficCondition: trafficDelay > 3 ? 'heavy' : trafficDelay > 1 ? 'moderate' : 'light',
      isPriority: vehicleType === 'emergency'
    };

    // Cache the route
    trafficData.routeCache.set(routeKey, {
      route,
      timestamp: Date.now()
    });

    return route;
  }

  static calculateDistance(lat1, lng1, lat2, lng2) {
    // Simplified distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static generateWaypoints(startLat, startLng, endLat, endLng, vehicleType) {
    // Generate intermediate waypoints based on vehicle type and traffic
    const waypoints = [
      { lat: startLat, lng: startLng, name: 'Start' }
    ];

    if (vehicleType === 'emergency') {
      // Emergency vehicles get direct routes when possible
      waypoints.push(
        { lat: (startLat + endLat) / 2, lng: (startLng + endLng) / 2, name: 'Priority Route' }
      );
    } else {
      // Regular vehicles avoid congestion
      const avoidanceFactor = 0.1;
      waypoints.push(
        { 
          lat: startLat + (endLat - startLat) * 0.3, 
          lng: startLng + (endLng - startLng) * 0.3 + avoidanceFactor,
          name: 'Via Main Route'
        },
        { 
          lat: startLat + (endLat - startLat) * 0.7, 
          lng: startLng + (endLng - startLng) * 0.7 - avoidanceFactor,
          name: 'Avoid Congestion'
        }
      );
    }

    waypoints.push(
      { lat: endLat, lng: endLng, name: 'Destination' }
    );

    return waypoints;
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes

// Driver Registration API
app.post('/api/auth/register', async (req, res) => {
  try {
    const { driverName, vehicleModel, vehicleType, email, password } = req.body;
    
    if (!driverName || !vehicleModel || !vehicleType || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if driver already exists
    for (const [id, driver] of drivers) {
      const decryptedEmail = ConfidentialityAPI.decrypt(driver.encryptedEmail);
      if (decryptedEmail === email) {
        return res.status(400).json({ error: 'Driver already registered with this email' });
      }
    }

    // Create driver with encrypted sensitive data
    const driverId = crypto.randomUUID();
    const hashedPassword = ConfidentialityAPI.hashPassword(password);
    
    const driverData = {
      id: driverId,
      encryptedName: ConfidentialityAPI.encrypt(driverName),
      encryptedEmail: ConfidentialityAPI.encrypt(email),
      vehicleModel, // This can be public
      vehicleType,
      hashedPassword,
      createdAt: new Date().toISOString(),
      isActive: false
    };

    drivers.set(driverId, driverData);

    // Generate JWT token
    const token = jwt.sign(
      { driverId, vehicleType, vehicleModel },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      driver: {
        id: driverId,
        vehicleModel,
        vehicleType,
        // Name is not included in response for privacy
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Driver Login API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find driver by email
    let foundDriver = null;
    let foundDriverId = null;

    for (const [id, driver] of drivers) {
      const decryptedEmail = ConfidentialityAPI.decrypt(driver.encryptedEmail);
      if (decryptedEmail === email) {
        foundDriver = driver;
        foundDriverId = id;
        break;
      }
    }

    if (!foundDriver || !ConfidentialityAPI.verifyPassword(password, foundDriver.hashedPassword)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { driverId: foundDriverId, vehicleType: foundDriver.vehicleType, vehicleModel: foundDriver.vehicleModel },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      driver: {
        id: foundDriverId,
        vehicleModel: foundDriver.vehicleModel,
        vehicleType: foundDriver.vehicleType
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Start/Stop Live Tracking API
app.post('/api/tracking/toggle', authenticateToken, (req, res) => {
  try {
    const { driverId, vehicleType } = req.user;
    const { latitude, longitude, isActive } = req.body;

    if (isActive) {
      // Start tracking
      activeTrackingSessions.set(driverId, {
        driverId,
        vehicleType,
        latitude: latitude || 37.7749, // Default to SF coordinates
        longitude: longitude || -122.4194,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      });
    } else {
      // Stop tracking
      activeTrackingSessions.delete(driverId);
    }

    res.json({
      success: true,
      isTracking: isActive,
      message: isActive ? 'Live tracking started' : 'Live tracking stopped'
    });

  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Tracking operation failed' });
  }
});

// Submit Traffic Report API
app.post('/api/reports/submit', authenticateToken, (req, res) => {
  try {
    const { driverId, vehicleType } = req.user;
    const { reportType, location, description, latitude, longitude, proofText, proofImage } = req.body;

    if (!reportType || !location || !description) {
      return res.status(400).json({ error: 'Report type, location, and description are required' });
    }

    const report = {
      id: crypto.randomUUID(),
      driverId, // This is kept for backend tracking but not exposed to other users
      reportType,
      location,
      description,
      latitude: latitude || 37.7749,
      longitude: longitude || -122.4194,
      vehicleType,
      proofText,
      proofImage: proofImage ? 'image_stored' : null, // In production, store image securely
      timestamp: new Date().toISOString(),
      status: 'active',
      verificationScore: vehicleType === 'emergency' ? 1.0 : Math.random() * 0.8 + 0.2
    };

    trafficReports.push(report);

    // Update traffic conditions based on report
    if (reportType === 'congestion' || reportType === 'accident') {
      trafficData.congestionZones.push({
        id: trafficData.congestionZones.length + 1,
        location,
        severity: reportType === 'accident' ? 'high' : 'moderate',
        lat: latitude || 37.7749,
        lng: longitude || -122.4194,
        source: 'user_report',
        timestamp: new Date().toISOString()
      });
    }

    // Clear route cache to force recalculation
    trafficData.routeCache.clear();

    res.json({
      success: true,
      reportId: report.id,
      message: 'Traffic report submitted successfully'
    });

  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Report submission failed' });
  }
});

// Get Traffic Reports API
app.get('/api/reports', (req, res) => {
  try {
    const { limit = 50, type } = req.query;
    
    let filteredReports = trafficReports
      .filter(report => report.status === 'active')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    if (type) {
      filteredReports = filteredReports.filter(report => report.reportType === type);
    }

    // Remove sensitive driver information before sending
    const publicReports = filteredReports.map(report => ({
      id: report.id,
      reportType: report.reportType,
      location: report.location,
      description: report.description,
      latitude: report.latitude,
      longitude: report.longitude,
      vehicleType: report.vehicleType,
      timestamp: report.timestamp,
      verificationScore: report.verificationScore,
      isEmergencyReport: report.vehicleType === 'emergency'
    }));

    res.json({
      success: true,
      reports: publicReports,
      totalActive: trafficReports.filter(r => r.status === 'active').length
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Route Calculation API
app.post('/api/navigation/route', authenticateToken, (req, res) => {
  try {
    const { vehicleType } = req.user;
    const { startLat, startLng, endLat, endLng, preferences } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: 'Start and end coordinates are required' });
    }

    const route = TrafficAgent.calculateOptimalRoute(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng),
      vehicleType
    );

    const trafficConditions = TrafficAgent.analyzeTrafficConditions();

    res.json({
      success: true,
      route,
      trafficConditions,
      emergencyPriority: vehicleType === 'emergency',
      calculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ error: 'Route calculation failed' });
  }
});

// Get Live Traffic Data API
app.get('/api/traffic/live', (req, res) => {
  try {
    const { bounds } = req.query; // For map bounds filtering in production

    const liveData = {
      congestionZones: trafficData.congestionZones.map(zone => ({
        ...zone,
        // Remove sensitive source information
        source: undefined
      })),
      activeDrivers: activeTrackingSessions.size,
      emergencyVehicles: Array.from(activeTrackingSessions.values())
        .filter(session => session.vehicleType === 'emergency').length,
      trafficConditions: TrafficAgent.analyzeTrafficConditions(),
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: liveData
    });

  } catch (error) {
    console.error('Live traffic data error:', error);
    res.status(500).json({ error: 'Failed to fetch live traffic data' });
  }
});

// Get Driver Statistics (for dashboard)
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      activeDrivers: activeTrackingSessions.size,
      totalReportsToday: trafficReports.filter(report => {
        const reportDate = new Date(report.timestamp);
        const today = new Date();
        return reportDate.toDateString() === today.toDateString();
      }).length,
      emergencyVehiclesActive: Array.from(activeTrackingSessions.values())
        .filter(session => session.vehicleType === 'emergency').length,
      routesOptimizedToday: trafficData.routeCache.size,
      averageResponseTime: '2.3s', // Simulated
      systemUptime: process.uptime(),
      totalRegisteredDrivers: drivers.size
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      confidentialityAPI: 'operational',
      trafficAgent: 'operational',
      navigationAPI: 'operational',
      database: 'operational'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  for (const [driverId, session] of activeTrackingSessions) {
    if (now - new Date(session.lastUpdate).getTime() > timeout) {
      activeTrackingSessions.delete(driverId);
      console.log(`Cleaned up inactive session for driver: ${driverId}`);
    }
  }

  // Clean up old traffic data
  const oldReportThreshold = 24 * 60 * 60 * 1000; // 24 hours
  for (let i = trafficReports.length - 1; i >= 0; i--) {
    if (now - new Date(trafficReports[i].timestamp).getTime() > oldReportThreshold) {
      trafficReports.splice(i, 1);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

app.listen(PORT, () => {
  console.log(`🚦 The Traffic Look Out API Server running on port ${PORT}`);
  console.log(`🔒 Confidentiality API: Operational`);
  console.log(`🤖 Traffic Agents: Active`);
  console.log(`🗺️ Navigation API: Ready`);
  console.log(`📊 Statistics API: Online`);
});
