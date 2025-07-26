#!/bin/bash

# IPTV Panel Deployment Script
# This script updates the application from Git and restarts services

set -e  # Exit on any error

echo "🚀 Starting IPTV Panel deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Backup current database
print_status "Creating database backup..."
if [ -f "database/iptv_panel.db" ]; then
    cp database/iptv_panel.db database/iptv_panel.db.backup.$(date +%Y%m%d_%H%M%S)
    print_status "Database backed up successfully"
else
    print_warning "No database file found to backup"
fi

# Pull latest changes from Git
print_status "Pulling latest changes from Git..."
if git pull origin main; then
    print_status "Git pull successful"
else
    print_error "Git pull failed"
    exit 1
fi

# Install/update dependencies
print_status "Installing/updating dependencies..."
if npm install; then
    print_status "Dependencies updated successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    print_status "Restarting application with PM2..."
    if pm2 restart iptv-panel; then
        print_status "Application restarted successfully"
    else
        print_warning "PM2 restart failed, trying to start..."
        pm2 start server.js --name "iptv-panel"
    fi
else
    print_warning "PM2 not found, restarting with systemctl..."
    if systemctl is-active --quiet iptv-panel; then
        systemctl restart iptv-panel
        print_status "Application restarted with systemctl"
    else
        print_warning "Systemd service not found, starting manually..."
        node server.js &
        print_status "Application started manually"
    fi
fi

# Check if application is running
sleep 3
if curl -s http://localhost:3000 > /dev/null; then
    print_status "✅ Deployment successful! Application is running."
else
    print_warning "⚠️  Application may not be running. Please check manually."
fi

echo ""
echo "📊 Deployment Summary:"
echo "   - Git repository updated"
echo "   - Dependencies installed"
echo "   - Application restarted"
echo "   - Database backed up"
echo ""
echo "🌐 Access your panel at:"
echo "   User Panel: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Admin Panel: http://$(hostname -I | awk '{print $1}'):3000/admin"
echo ""
echo "📝 To check application status:"
echo "   PM2: pm2 status"
echo "   Systemd: systemctl status iptv-panel"
echo "   Logs: pm2 logs iptv-panel" 