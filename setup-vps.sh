#!/bin/bash

# IPTV Panel VPS Setup Script
# This script sets up a VPS for running the IPTV panel

set -e  # Exit on any error

echo "🚀 Setting up VPS for IPTV Panel..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_header "Starting VPS setup..."

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_status "Node.js version: $NODE_VERSION"
print_status "npm version: $NPM_VERSION"

# Install PM2 globally
print_status "Installing PM2..."
npm install -g pm2

# Install nginx
print_status "Installing nginx..."
apt install -y nginx

# Configure firewall
print_status "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000
ufw --force enable

# Create application directory
print_status "Creating application directory..."
mkdir -p /opt/iptv-panel
cd /opt/iptv-panel

# Clone repository (you'll need to provide the repository URL)
print_warning "Please provide your Git repository URL:"
read -p "Git repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    print_error "Repository URL is required"
    exit 1
fi

print_status "Cloning repository..."
git clone $REPO_URL .

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Create environment file
print_status "Creating environment file..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
DB_PATH=/opt/iptv-panel/database/iptv_panel.db
EOF

# Make deploy script executable
chmod +x deploy.sh

# Create nginx configuration
print_status "Creating nginx configuration..."
cat > /etc/nginx/sites-available/iptv-panel << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeout for streaming
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/iptv-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start server.js --name "iptv-panel"
pm2 save
pm2 startup

# Start nginx
print_status "Starting nginx..."
systemctl enable nginx
systemctl restart nginx

# Create systemd service as backup
print_status "Creating systemd service..."
cat > /etc/systemd/system/iptv-panel.service << EOF
[Unit]
Description=IPTV Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/iptv-panel
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable iptv-panel

# Create backup directory
mkdir -p /opt/iptv-panel/backup

# Set proper permissions
chown -R root:root /opt/iptv-panel
chmod -R 755 /opt/iptv-panel

# Wait for application to start
print_status "Waiting for application to start..."
sleep 10

# Check if application is running
if curl -s http://localhost:3000 > /dev/null; then
    print_status "✅ Application is running successfully!"
else
    print_warning "⚠️ Application may not be running. Checking logs..."
    pm2 logs iptv-panel --lines 10
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 VPS Setup Complete!"
echo ""
echo "📊 Setup Summary:"
echo "   ✅ System updated"
echo "   ✅ Node.js 18.x installed"
echo "   ✅ PM2 installed"
echo "   ✅ nginx configured"
echo "   ✅ Firewall configured"
echo "   ✅ Application deployed"
echo "   ✅ Services started"
echo ""
echo "🌐 Access your panel:"
echo "   User Panel: http://$SERVER_IP:3000"
echo "   Admin Panel: http://$SERVER_IP:3000/admin"
echo "   Default Admin: admin / admin123"
echo ""
echo "📝 Useful commands:"
echo "   Check status: pm2 status"
echo "   View logs: pm2 logs iptv-panel"
echo "   Restart: pm2 restart iptv-panel"
echo "   Update: cd /opt/iptv-panel && ./deploy.sh"
echo ""
echo "🔒 Security recommendations:"
echo "   1. Change default admin password"
echo "   2. Set up SSL certificate"
echo "   3. Configure domain name"
echo "   4. Set up regular backups"
echo ""
print_status "Setup completed successfully!" 