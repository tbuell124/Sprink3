# Production-Ready Raspberry Pi Deployment Guide

## Quick Start Summary

This guide is validated for the current codebase and ensures reliable deployment with proper security.

### Prerequisites
- **Raspberry Pi 4** (recommended) with Raspberry Pi OS
- **Node.js 20+** (do NOT use Node.js 18 - current code requires 20+)
- **Network access** and basic command line knowledge

### User Configuration
All commands assume the primary user is `pi`. If using a different username, set:
```bash
export SPRINKLER_USER=your_username
```

---

## Step 1: System Setup

### Install Node.js 20+
```bash
# Install Node.js 20 LTS (REQUIRED - do not use Node 18)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify versions
node --version  # Should show v20.x.x or higher
npm --version   # Should show 10.x.x or higher
```

### Install System Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl nano htop ufw fail2ban pigpio python3 python3-pip python3-venv

# Install PM2 globally
sudo npm install -g pm2

# Enable pigpio daemon (required for GPIO control)
sudo systemctl enable pigpiod
sudo systemctl start pigpiod
```

---

## Step 2: Deploy Web Application

### Clone and Setup
```bash
# Clone repository
cd /home/pi
git clone https://github.com/tbuell124/Sprink2.git sprinkler-web
cd sprinkler-web

# Install dependencies (do NOT modify vite.config.ts - it works correctly as-is)
npm install

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
SESSION_SECRET=sprinkler-secret-$(date +%s | sha256sum | head -c 64)
PORT=5000
EOF
```

### Start Web Application
```bash
# Start with PM2 (development mode recommended for Pi)
pm2 start npm --name "sprinkler-web" -- run dev

# Configure auto-start
pm2 save
pm2 startup
# IMPORTANT: Run the command that PM2 outputs above with sudo

# Verify it's running
pm2 status
curl -I http://localhost:5000
```

---

## Step 3: Deploy Pi Backend (GPIO Control)

### Generate Secure API Token
```bash
# Generate a strong API token and save it
API_TOKEN=$(openssl rand -hex 32)
echo "Your API Token: $API_TOKEN"
echo "Save this token - you'll need it for the web interface!"
```

### Install Backend
```bash
cd /home/pi/sprinkler-web/pi-backend

# Run automated installation
chmod +x install.sh
./install.sh
```

### Configure Backend Security
```bash
# Get your Pi's IP address
PI_IP=$(hostname -I | awk '{print $1}')
echo "Your Pi IP: $PI_IP"

# Create proper systemd service configuration
sudo tee /etc/systemd/system/sprinkler.service > /dev/null << EOF
[Unit]
Description=Sprinkler GPIO Control Backend
After=network-online.target pigpiod.service
Wants=network-online.target
Requires=pigpiod.service

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/sprinkler-backend
Environment=PATH=/home/pi/sprinkler-backend/venv/bin
Environment=PYTHONPATH=/home/pi/sprinkler-backend
Environment=SPRINKLER_API_TOKEN=${API_TOKEN}
Environment=ALLOWED_ORIGINS=http://localhost:5000,http://${PI_IP}:5000
Environment=PORT=8000
ExecStart=/home/pi/sprinkler-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload and start the service
sudo systemctl daemon-reload
sudo systemctl enable sprinkler.service
sudo systemctl start sprinkler.service

# Verify backend is running
sudo systemctl status sprinkler.service
curl http://localhost:8000/health
```

---

## Step 4: Network & Security Configuration

### Set Static IP (Recommended)
```bash
# Find your current network info
ip route | grep default
# Note your gateway IP (usually 192.168.1.1)

# Edit network configuration
sudo nano /etc/dhcpcd.conf

# Add at the end (adjust IPs for your network):
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Apply changes
sudo systemctl restart dhcpcd
```

### Configure Firewall
```bash
# Enable firewall
sudo ufw enable

# Allow SSH (CRITICAL - configure first!)
sudo ufw allow ssh

# Allow sprinkler services from your local network only (SECURE)
sudo ufw allow from 192.168.1.0/24 to any port 5000 comment "Sprinkler Web"
sudo ufw allow from 192.168.1.0/24 to any port 8000 comment "Sprinkler API"

# Check firewall status
sudo ufw status verbose
```

---

## Step 5: Configure Web Interface

### Connect to Your Sprinkler System
1. **Open browser** to `http://YOUR_PI_IP:5000` (replace with your actual Pi IP)
2. **Navigate to Settings** page  
3. **Configure Pi Backend Connection**:
   - **Pi IP Address**: Your Pi's IP (e.g., `192.168.1.100`)
   - **Pi Port**: `8000`
   - **API Token**: The token you generated in Step 3
4. **Click "Save Settings"**
5. **Click "Test Connection"** - you should see "✓ Connection Successful"

---

## Step 6: Verification & Testing

### Test System Integration
```bash
# Verify both services are running
pm2 status
sudo systemctl status sprinkler.service

# Test web app
curl -I http://localhost:5000

# Test backend API
curl http://localhost:8000/health
curl http://localhost:8000/api/status
curl http://localhost:8000/api/pins

# Test authenticated endpoint (replace TOKEN with your actual token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -X POST http://localhost:8000/api/pin/12/on
```

### Test from Another Device
From any device on your network:
```bash
# Test web interface
curl -I http://YOUR_PI_IP:5000

# Should load the sprinkler control interface
```

---

## GPIO Pin Configuration

The system controls sprinkler zones using these GPIO pins:
```
Zone 1: GPIO 12    Zone 9:  GPIO 5
Zone 2: GPIO 16    Zone 10: GPIO 11  
Zone 3: GPIO 20    Zone 11: GPIO 9
Zone 4: GPIO 21    Zone 12: GPIO 10
Zone 5: GPIO 26    Zone 13: GPIO 22
Zone 6: GPIO 19    Zone 14: GPIO 27
Zone 7: GPIO 13    Zone 15: GPIO 17
Zone 8: GPIO 6     Zone 16: GPIO 4
```

**⚠️ SAFETY**: Always use relay modules to isolate 24VAC sprinkler valves from the Pi's 3.3V GPIO pins.

---

## Maintenance Commands

### View Logs
```bash
# Web application logs
pm2 logs sprinkler-web

# Backend logs  
sudo journalctl -u sprinkler.service -f

# System logs
sudo journalctl -f
```

### Restart Services
```bash
# Restart web app
pm2 restart sprinkler-web

# Restart backend
sudo systemctl restart sprinkler.service

# Restart both
pm2 restart sprinkler-web && sudo systemctl restart sprinkler.service
```

### Update Application
```bash
cd /home/pi/sprinkler-web
git pull origin main
npm install
pm2 restart sprinkler-web
sudo systemctl restart sprinkler.service
```

---

## Troubleshooting

### Web App Won't Start
```bash
# Check logs
pm2 logs sprinkler-web

# Common fixes
node --version  # Ensure Node.js 20+
npm install     # Reinstall dependencies
pm2 restart sprinkler-web
```

### Backend Won't Start
```bash
# Check service status
sudo systemctl status sprinkler.service

# Check pigpio daemon
sudo systemctl status pigpiod

# Restart pigpio if needed
sudo systemctl restart pigpiod
sudo systemctl restart sprinkler.service
```

### Connection Issues
```bash
# Check firewall
sudo ufw status

# Verify API token in systemd service
sudo systemctl cat sprinkler.service | grep SPRINKLER_API_TOKEN

# Test local connectivity
curl http://localhost:8000/health
```

---

## Security Notes

✅ **API token authentication** - Required for all GPIO control operations  
✅ **CORS protection** - Backend only accepts requests from configured origins  
✅ **Firewall rules** - Services only accessible from local network  
✅ **Service isolation** - Backend runs as non-root user with minimal permissions  

**⚠️ IMPORTANT**: 
- Never expose the GPIO backend (port 8000) to the internet
- Keep your API token secure and don't share it
- Regularly update the system: `sudo apt update && sudo apt upgrade`

---

**Access URL**: `http://YOUR_PI_IP:5000`  
**Repository**: https://github.com/tbuell124/Sprink2  
**Support**: Check logs first, then refer to troubleshooting section