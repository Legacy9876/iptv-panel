# 🚀 Git Setup Guide for IPTV Panel

This guide will help you set up Git for your IPTV panel project and deploy it to a VPS.

## 📋 **Prerequisites**

- Git installed on your local machine
- GitHub account
- VPS with Ubuntu/Debian
- SSH access to your VPS

## 🔧 **Step 1: Local Git Setup**

### Initialize Git Repository

```bash
# Navigate to your IPTV panel directory
cd iptv-panel

# Initialize Git repository
git init

# Add all files to Git
git add .

# Make initial commit
git commit -m "Initial commit: Custom IPTV Panel"
```

### Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Name it `iptv-panel`
4. Make it **private** (recommended for security)
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### Connect to GitHub

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/iptv-panel.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🖥️ **Step 2: VPS Setup**

### Connect to Your VPS

```bash
ssh root@your-vps-ip
```

### Run the Setup Script

```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/YOUR_USERNAME/iptv-panel/main/setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

**Or manually:**

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install nginx
apt install nginx git -y

# Configure firewall
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000
ufw enable

# Clone repository
git clone https://github.com/YOUR_USERNAME/iptv-panel.git /opt/iptv-panel
cd /opt/iptv-panel

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)
DB_PATH=/opt/iptv-panel/database/iptv_panel.db
EOF

# Start application
pm2 start server.js --name "iptv-panel"
pm2 save
pm2 startup
```

## 🔄 **Step 3: GitHub Actions Setup (Optional)**

### Generate SSH Key on VPS

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "deploy@iptv-panel"

# Add to authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys

# Display private key (copy this)
cat ~/.ssh/id_rsa
```

### Add GitHub Secrets

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Add these secrets:
   - `HOST`: Your VPS IP address
   - `USERNAME`: root
   - `KEY`: The private SSH key (the entire output from `cat ~/.ssh/id_rsa`)
   - `PORT`: 22 (default SSH port)

## 📝 **Step 4: Development Workflow**

### Making Changes Locally

```bash
# Make your changes
cd iptv-panel
# Edit files...

# Add changes to Git
git add .

# Commit changes
git commit -m "Add new feature: channel categories"

# Push to GitHub
git push origin main
```

### Automatic Deployment

With GitHub Actions set up, your changes will automatically deploy when you push to the main branch.

### Manual Deployment

```bash
# SSH to your VPS
ssh root@your-vps-ip

# Navigate to project directory
cd /opt/iptv-panel

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart application
pm2 restart iptv-panel
```

## 🔧 **Step 5: Useful Commands**

### Git Commands

```bash
# Check status
git status

# View changes
git diff

# View commit history
git log --oneline

# Create new branch
git checkout -b feature/new-feature

# Switch branches
git checkout main

# Merge branch
git merge feature/new-feature
```

### VPS Commands

```bash
# Check application status
pm2 status

# View logs
pm2 logs iptv-panel

# Restart application
pm2 restart iptv-panel

# Stop application
pm2 stop iptv-panel

# Start application
pm2 start iptv-panel

# Monitor resources
pm2 monit
```

### Database Backup

```bash
# Create backup
cp /opt/iptv-panel/database/iptv_panel.db /opt/iptv-panel/backup/iptv_panel_$(date +%Y%m%d_%H%M%S).db

# Restore backup
cp /opt/iptv-panel/backup/iptv_panel_20240101_120000.db /opt/iptv-panel/database/iptv_panel.db
```

## 🔒 **Step 6: Security Setup**

### Change Default Password

1. Access admin panel: `http://your-vps-ip:3000/admin`
2. Login with: admin / admin123
3. Change password immediately

### Set Up SSL (Optional)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### Regular Backups

Create a backup script:

```bash
nano /opt/iptv-panel/backup.sh
```

Add this content:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/iptv-panel/backup"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
if [ -f "/opt/iptv-panel/database/iptv_panel.db" ]; then
    cp /opt/iptv-panel/database/iptv_panel.db $BACKUP_DIR/iptv_panel_$DATE.db
    echo "Database backed up: iptv_panel_$DATE.db"
fi

# Backup environment file
if [ -f "/opt/iptv-panel/.env" ]; then
    cp /opt/iptv-panel/.env $BACKUP_DIR/env_$DATE.backup
    echo "Environment backed up: env_$DATE.backup"
fi

# Keep only last 10 backups
cd $BACKUP_DIR
ls -t | tail -n +11 | xargs -r rm --

echo "Backup completed successfully!"
```

Make it executable:

```bash
chmod +x /opt/iptv-panel/backup.sh
```

Set up cron job for automatic backups:

```bash
# Edit crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /opt/iptv-panel/backup.sh
```

## 🚨 **Troubleshooting**

### Common Issues

1. **Git Pull Fails**
   ```bash
   # Check if you have local changes
   git status
   
   # Stash changes and pull
   git stash
   git pull origin main
   git stash pop
   ```

2. **Application Not Starting**
   ```bash
   # Check logs
   pm2 logs iptv-panel
   
   # Check if port is in use
   netstat -tulpn | grep :3000
   
   # Kill process if needed
   kill -9 <PID>
   ```

3. **Database Issues**
   ```bash
   # Check database file
   ls -la /opt/iptv-panel/database/
   
   # Restore from backup
   cp /opt/iptv-panel/backup/iptv_panel_*.db /opt/iptv-panel/database/iptv_panel.db
   ```

4. **Permission Issues**
   ```bash
   # Fix permissions
   chown -R root:root /opt/iptv-panel
   chmod -R 755 /opt/iptv-panel
   ```

### Check Application Status

```bash
# Check if app is running
curl -s http://localhost:3000

# Check PM2 status
pm2 status

# Check nginx status
systemctl status nginx

# Check firewall
ufw status
```

## 📊 **Monitoring**

### Set Up Monitoring

```bash
# Install monitoring tools
apt install htop iotop -y

# Monitor system resources
htop

# Monitor disk usage
df -h

# Monitor memory usage
free -h
```

### Log Rotation

Create log rotation configuration:

```bash
nano /etc/logrotate.d/iptv-panel
```

Add this content:

```
/opt/iptv-panel/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 root root
}
```

## 🎉 **Success!**

Your IPTV panel is now set up with Git and ready for production use!

**Access URLs:**
- User Panel: `http://your-vps-ip:3000`
- Admin Panel: `http://your-vps-ip:3000/admin`

**Default Login:**
- Username: `admin`
- Password: `admin123`

**Remember to:**
1. Change the default admin password
2. Set up regular backups
3. Monitor your application
4. Keep your system updated

Happy streaming! 🎬 