// The Traffic Look Out - Frontend Application
class TrafficLookOutApp {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3000/api';
        this.token = null; // Don't use localStorage in artifacts
        this.driverData = null;
        this.isTracking = false;
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        console.log('🚦 Initializing The Traffic Look Out Application');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadStats();
        await this.loadTrafficReports();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        console.log('✅ Application initialized successfully');
    }

    setupEventListeners() {
        // Handle Enter key for forms
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                if (target.form) {
                    e.preventDefault();
                    const submitBtn = target.form.querySelector('button[type="submit"], button:not([type])');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    }
                }
            }
        });

        // Handle file input for proof images
        document.getElementById('proofImage')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    this.showToast('File size must be less than 5MB', 'error');
                    e.target.value = '';
                    return;
                }
                
                // Validate file type
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    this.showToast('Please upload a valid image file (JPG, PNG, GIF)', 'error');
                    e.target.value = '';
                    return;
                }
                
                this.showToast('Image selected successfully', 'success');
            }
        });
    }

    // Authentication Methods
    async registerDriver() {
        const driverName = document.getElementById('regDriverName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const vehicleModel = document.getElementById('regVehicleModel').value.trim();
        const vehicleType = document.getElementById('regVehicleType').value;

        if (!driverName || !email || !password || !vehicleModel) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showToast('Please enter a valid email address', 'error');
            return;
        }

        // Password validation
        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters long', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.makeAPICall('/auth/register', 'POST', {
                driverName,
                email,
                password,
                vehicleModel,
                vehicleType
            });

            if (response.success) {
                this.token = response.token;
                this.driverData = response.driver;
                
                this.showDashboard();
                this.showToast('Registration successful! Welcome to The Traffic Look Out', 'success');
            }
        } catch (error) {
            this.showToast(error.message || 'Registration failed. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loginDriver() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showToast('Please enter both email and password', 'error');
            return;
        }

        this.showLoading();

        try {
            const response = await this.makeAPICall('/auth/login', 'POST', {
                email,
                password
            });

            if (response.success) {
                this.token = response.token;
                this.driverData = response.driver;
                
                this.showDashboard();
                this.showToast('Login successful! Welcome back', 'success');
            }
        } catch (error) {
            this.showToast(error.message || 'Login failed. Please check your credentials.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    logout() {
        this.token = null;
        this.driverData = null;
        this.isTracking = false;
        
        // Reset UI
        document.getElementById('registrationForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('driverDashboard').classList.add('hidden');
        
        // Clear form data
        this.clearForms();
        
        // Disable features
        this.disableFeatures();
        
        // Stop real-time updates
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.showToast('Logged out successfully', 'success');
    }

    showDashboard() {
        document.getElementById('registrationForm').classList.add('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('driverDashboard').classList.remove('hidden');
        
        // Update dashboard info
        document.getElementById('displayVehicle').textContent = this.driverData.vehicleModel;
        
        if (this.driverData.vehicleType === 'emergency') {
            document.getElementById('emergencyBadge').classList.remove('hidden');
        }
        
        // Enable features
        this.enableFeatures();
    }

    // UI Helper Methods
    showRegistrationForm() {
        document.getElementById('registrationForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    }

    showLoginForm() {
        document.getElementById('registrationForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    }

    clearForms() {
        // Registration form
        document.getElementById('regDriverName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regVehicleModel').value = '';
        document.getElementById('regVehicleType').value = 'regular';
        
        // Login form
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        
        // Report form
        document.getElementById('reportLocation').value = '';
        document.getElementById('reportDescription').value = '';
        document.getElementById('proofText').value = '';
        document.getElementById('proofImage').value = '';
    }

    enableFeatures() {
        document.getElementById('reportBtn').disabled = false;
    }

    disableFeatures() {
        document.getElementById('routeBtn').disabled = true;
        document.getElementById('reportBtn').disabled = true;
        document.getElementById('trackingBtn').innerHTML = '<i class="fas fa-play"></i> Start Live Tracking';
    }

    // Tracking Methods
    async toggleTracking() {
        if (!this.token) return;

        this.showLoading();

        try {
            // Get current position if available
            let latitude = parseFloat(document.getElementById('startLat').value) || 37.7749;
            let longitude = parseFloat(document.getElementById('startLng').value) || -122.4194;

            if (navigator.geolocation) {
                try {
                    const position = await this.getCurrentPosition();
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                    
                    // Update coordinate inputs
                    document.getElementById('startLat').value = latitude.toFixed(4);
                    document.getElementById('startLng').value = longitude.toFixed(4);
                } catch (geoError) {
                    console.log('Geolocation not available, using default coordinates');
                }
            }

            const response = await this.makeAPICall('/tracking/toggle', 'POST', {
                latitude,
                longitude,
                isActive: !this.isTracking
            });

            if (response.success) {
                this.isTracking = response.isTracking;
                this.updateTrackingUI();
                this.showToast(response.message, 'success');
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to toggle tracking', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateTrackingUI() {
        const btn = document.getElementById('trackingBtn');
        const status = document.getElementById('driverStatus');
        const indicator = document.getElementById('statusIndicator');

        if (this.isTracking) {
            btn.innerHTML = '<i class="fas fa-stop"></i> Stop Live Tracking';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-danger');
            status.textContent = 'Live Tracking Active';
            indicator.classList.add('status-online');
            indicator.classList.remove('status-offline');
            document.getElementById('routeBtn').disabled = false;
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i> Start Live Tracking';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-success');
            status.textContent = 'Offline';
            indicator.classList.add('status-offline');
            indicator.classList.remove('status-online');
            document.getElementById('routeBtn').disabled = true;
            document.getElementById('routeInfo').classList.add('hidden');
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            });
        });
    }

    // Navigation Methods
    async requestRoute() {
        if (!this.token || !this.isTracking) return;

        const startLat = parseFloat(document.getElementById('startLat').value);
        const startLng = parseFloat(document.getElementById('startLng').value);
        const endLat = parseFloat(document.getElementById('endLat').value);
        const endLng = parseFloat(document.getElementById('endLng').value);

        if (!startLat || !startLng || !endLat || !endLng) {
            this.showToast('Please enter valid coordinates for start and end points', 'error');
            return;
        }

        this.showLoading();
        document.getElementById('routeInfo').classList.remove('hidden');
        document.getElementById('routeDetails').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating optimal route...';

        try {
            const response = await this.makeAPICall('/navigation/route', 'POST', {
                startLat,
                startLng,
                endLat,
                endLng
            });

            if (response.success) {
                this.displayRouteInfo(response.route, response.trafficConditions);
                this.showToast('Route calculated successfully', 'success');
                
                // Update stats
                const routesOptimized = document.getElementById('routesOptimized');
                const current = parseInt(routesOptimized.textContent) || 0;
                routesOptimized.textContent = current + 1;
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to calculate route', 'error');
            document.getElementById('routeInfo').classList.add('hidden');
        } finally {
            this.hideLoading();
        }
    }

    displayRouteInfo(route, trafficConditions) {
        const routeDetails = document.getElementById('routeDetails');
        const priorityBadge = route.isPriority ? '<span class="emergency-badge"><i class="fas fa-ambulance"></i> PRIORITY ROUTE</span>' : '';
        
        routeDetails.innerHTML = `
            <div class="route-summary">
                ${priorityBadge}
                <div class="route-stats">
                    <div class="route-stat">
                        <i class="fas fa-route"></i>
                        <strong>Distance:</strong> ${route.distance}
                    </div>
                    <div class="route-stat">
                        <i class="fas fa-clock"></i>
                        <strong>Duration:</strong> ${route.duration}
                    </div>
                    <div class="route-stat">
                        <i class="fas fa-traffic-light"></i>
                        <strong>Traffic:</strong> 
                        <span class="traffic-${route.trafficCondition}">${route.trafficCondition.toUpperCase()}</span>
                    </div>
                </div>
                <div class="waypoints">
                    <h6><i class="fas fa-map-marked-alt"></i> Route Waypoints:</h6>
                    <ul>
                        ${route.waypoints.map(point => `<li>${point.name}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        // Update map visualization
        this.updateMapVisualization(route);
    }

    updateMapVisualization(route) {
        // Simulate route visualization on the map
        const mapOverlay = document.getElementById('mapOverlay');
        if (route.isPriority) {
            mapOverlay.style.background = `
                radial-gradient(circle at 20% 30%, rgba(255,0,0,0.6) 25px, transparent 30px),
                radial-gradient(circle at 60% 70%, rgba(0,0,255,0.4) 30px, transparent 35px),
                radial-gradient(circle at 80% 20%, rgba(0,255,0,0.3) 15px, transparent 20px),
                linear-gradient(45deg, rgba(255,255,0,0.2), transparent)
            `;
        } else {
            // Reset to normal traffic visualization
            mapOverlay.style.background = `
                radial-gradient(circle at 20% 30%, rgba(255,0,0,0.4) 20px, transparent 25px),
                radial-gradient(circle at 60% 70%, rgba(255,255,0,0.4) 25px, transparent 30px),
                radial-gradient(circle at 80% 20%, rgba(0,255,0,0.4) 15px, transparent 20px)
            `;
        }
    }

    // Traffic Reporting Methods
    async submitReport() {
        if (!this.token) return;

        const reportType = document.getElementById('reportType').value;
        const location = document.getElementById('reportLocation').value.trim();
        const description = document.getElementById('reportDescription').value.trim();
        const proofText = document.getElementById('proofText').value.trim();
        const proofImageFile = document.getElementById('proofImage').files[0];

        if (!location || !description) {
            this.showToast('Please fill in location and description', 'error');
            return;
        }

        this.showLoading();

        try {
            // Get current position for report location
            let latitude = parseFloat(document.getElementById('startLat').value) || 37.7749;
            let longitude = parseFloat(document.getElementById('startLng').value) || -122.4194;

            const reportData = {
                reportType,
                location,
                description,
                latitude,
                longitude,
                proofText
            };

            // Handle image upload if provided
            if (proofImageFile) {
                // In a real application, you would upload the image to a cloud service
                // For this demo, we'll just indicate that an image was provided
                reportData.proofImage = 'image_provided';
            }

            const response = await this.makeAPICall('/reports/submit', 'POST', reportData);

            if (response.success) {
                this.showToast('Traffic report submitted successfully', 'success');
                
                // Clear form
                document.getElementById('reportLocation').value = '';
                document.getElementById('reportDescription').value = '';
                document.getElementById('proofText').value = '';
                document.getElementById('proofImage').value = '';
                
                // Refresh reports
                await this.loadTrafficReports();
                
                // Update stats
                const reportsToday = document.getElementById('reportsToday');
                const current = parseInt(reportsToday.textContent) || 0;
                reportsToday.textContent = current + 1;
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to submit report', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadTrafficReports() {
        try {
            const response = await this.makeAPICall('/reports?limit=20', 'GET');
            
            if (response.success) {
                this.displayTrafficReports(response.reports);
            }
        } catch (error) {
            console.error('Failed to load traffic reports:', error);
            const reportsContainer = document.getElementById('trafficReports');
            reportsContainer.innerHTML = '<div class="loading">Failed to load traffic reports</div>';
        }
    }

    displayTrafficReports(reports) {
        const reportsContainer = document.getElementById('trafficReports');
        
        if (!reports || reports.length === 0) {
            reportsContainer.innerHTML = '<div class="loading">No traffic reports available</div>';
            return;
        }

        const reportsHTML = reports.map(report => {
            const timeAgo = this.getTimeAgo(new Date(report.timestamp));
            const priorityClass = report.isEmergencyReport ? 'emergency' : 
                                 (report.verificationScore > 0.7 ? 'high-priority' : '');
            const reportIcon = this.getReportIcon(report.reportType);
            const emergencyBadge = report.isEmergencyReport ? '<span class="emergency-badge"><i class="fas fa-ambulance"></i> EMERGENCY</span>' : '';
            
            return `
                <div class="report-item ${priorityClass}">
                    <div class="report-header">
                        <strong><i class="${reportIcon}"></i> ${this.capitalizeFirst(report.reportType)}</strong>
                        ${emergencyBadge}
                        <span class="verification-score" title="Verification Score: ${(report.verificationScore * 100).toFixed(0)}%">
                            ${'★'.repeat(Math.ceil(report.verificationScore * 5))}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-map-marker-alt"></i> ${report.location}
                    </div>
                    <div class="report-description">${report.description}</div>
                    <div class="report-meta">
                        <small><i class="fas fa-clock"></i> ${timeAgo} | Vehicle: ${report.vehicleType}</small>
                    </div>
                </div>
            `;
        }).join('');
        
        reportsContainer.innerHTML = reportsHTML;
    }

    getReportIcon(reportType) {
        const icons = {
            'accident': 'fas fa-car-crash',
            'congestion': 'fas fa-traffic-light',
            'hazard': 'fas fa-exclamation-triangle',
            'construction': 'fas fa-hard-hat',
            'weather': 'fas fa-cloud-rain'
        };
        return icons[reportType] || 'fas fa-info-circle';
    }

    // Statistics Methods
    async loadStats() {
        try {
            const response = await this.makeAPICall('/stats', 'GET');
            
            if (response.success) {
                this.updateStatsDisplay(response.stats);
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    updateStatsDisplay(stats) {
        document.getElementById('activeDrivers').textContent = stats.activeDrivers || 0;
        document.getElementById('reportsToday').textContent = stats.totalReportsToday || 0;
        document.getElementById('emergencyVehicles').textContent = stats.emergencyVehiclesActive || 0;
        document.getElementById('routesOptimized').textContent = stats.routesOptimizedToday || 0;
        document.getElementById('avgResponseTime').textContent = stats.averageResponseTime || '0s';
        document.getElementById('systemStatus').textContent = 'Online';
    }

    async refreshTrafficData() {
        this.showLoading();
        
        try {
            await Promise.all([
                this.loadStats(),
                this.loadTrafficReports(),
                this.loadLiveTrafficData()
            ]);
            
            this.showToast('Traffic data refreshed', 'success');
        } catch (error) {
            this.showToast('Failed to refresh data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadLiveTrafficData() {
        try {
            const response = await this.makeAPICall('/traffic/live', 'GET');
            
            if (response.success) {
                this.updateTrafficVisualization(response.data);
            }
        } catch (error) {
            console.error('Failed to load live traffic data:', error);
        }
    }

    updateTrafficVisualization(trafficData) {
        // Update map overlay based on live traffic data
        const mapOverlay = document.getElementById('mapOverlay');
        const congestionZones = trafficData.congestionZones || [];
        
        // Generate dynamic background based on congestion zones
        const gradients = congestionZones.map((zone, index) => {
            const x = (index * 30 + 20) % 80;
            const y = (index * 25 + 25) % 75;
            const size = zone.severity === 'high' ? 25 : zone.severity === 'moderate' ? 20 : 15;
            const color = zone.severity === 'high' ? '255,0,0' : zone.severity === 'moderate' ? '255,255,0' : '0,255,0';
            const opacity = zone.severity === 'high' ? 0.5 : zone.severity === 'moderate' ? 0.4 : 0.3;
            
            return `radial-gradient(circle at ${x}% ${y}%, rgba(${color},${opacity}) ${size}px, transparent ${size + 5}px)`;
        });
        
        if (gradients.length > 0) {
            mapOverlay.style.background = gradients.join(', ');
        }
    }

    // Real-time Updates
    startRealTimeUpdates() {
        // Update stats and reports every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (this.token) {
                try {
                    await this.loadStats();
                    
                    // Randomly add new simulated reports
                    if (Math.random() < 0.3) { // 30% chance every 30 seconds
                        await this.loadTrafficReports();
                    }
                } catch (error) {
                    console.error('Real-time update failed:', error);
                }
            }
        }, 30000);
    }

    // API Helper Methods
    async makeAPICall(endpoint, method = 'GET', data = null) {
        const url = `${this.API_BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        return result;
    }

    // Utility Methods
    showLoading() {
        document.getElementById('loadingModal').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingModal').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                    type === 'error' ? 'fas fa-exclamation-circle' : 
                    type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }
}

// Global function references for HTML onclick handlers
let app;

window.addEventListener('DOMContentLoaded', () => {
    app = new TrafficLookOutApp();
});

// Global functions for HTML onclick handlers
function registerDriver() {
    app?.registerDriver();
}

function loginDriver() {
    app?.loginDriver();
}

function logout() {
    app?.logout();
}

function showRegistrationForm() {
    app?.showRegistrationForm();
}

function showLoginForm() {
    app?.showLoginForm();
}

function toggleTracking() {
    app?.toggleTracking();
}

function requestRoute() {
    app?.requestRoute();
}

function submitReport() {
    app?.submitReport();
}

function loadTrafficReports() {
    app?.loadTrafficReports();
}

function refreshTrafficData() {
    app?.refreshTrafficData();
}
