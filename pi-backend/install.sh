#!/bin/bash
# Raspberry Pi Sprinkler Backend Installation Script

set -e

echo "🚿 Installing Raspberry Pi Sprinkler Control Backend..."

# Target user configuration (defaults to tybuell, override with SPRINKLER_USER env)
TARGET_USER="${SPRINKLER_USER:-tybuell}"

# Check if running as target user
if [ "$(id -un)" != "$TARGET_USER" ]; then
    echo "⚠️  This script should be run as the '$TARGET_USER' user"
    echo "   Switch to the correct user: sudo su - $TARGET_USER"
    exit 1
fi

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    echo "   Continuing anyway (will run in simulation mode)..."
fi

INSTALL_DIR="/home/${TARGET_USER}/sprinkler-backend"
CURRENT_DIR=$(pwd)

echo "📁 Setting up installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Copy files if running from different directory
if [ "$CURRENT_DIR" != "$INSTALL_DIR" ]; then
    echo "📋 Copying backend files..."
    cp "$CURRENT_DIR/main.py" . 2>/dev/null || echo "main.py not found in current directory"
    cp "$CURRENT_DIR/requirements.txt" . 2>/dev/null || echo "requirements.txt not found"
    cp "$CURRENT_DIR/sprinkler.service" . 2>/dev/null || echo "sprinkler.service not found"
fi

# Update system packages
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Python 3 and pip if not present
echo "🐍 Installing Python dependencies..."
sudo apt install -y python3 python3-pip python3-venv

# Install pigpio
echo "🔌 Installing pigpio for GPIO control..."
sudo apt install -y pigpio python3-pigpio

# Enable and start pigpio daemon
echo "⚙️  Configuring pigpio daemon..."
sudo systemctl enable pigpiod
sudo systemctl start pigpiod

# Create Python virtual environment
echo "🌍 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python packages
echo "📚 Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

# Install systemd service
echo "🔄 Installing systemd service..."
sudo cp sprinkler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sprinkler.service

# Start the service
echo "🚀 Starting sprinkler service..."
sudo systemctl start sprinkler.service

# Check service status
echo "📊 Checking service status..."
sleep 2
if sudo systemctl is-active --quiet sprinkler.service; then
    echo "✅ Sprinkler service is running!"
    echo "🌐 Backend available at: http://$(hostname -I | awk '{print $1}'):8000"
    echo "📋 API docs at: http://$(hostname -I | awk '{print $1}'):8000/docs"
else
    echo "❌ Service failed to start. Checking logs..."
    sudo systemctl status sprinkler.service --no-pager
    echo ""
    echo "📝 View detailed logs with: sudo journalctl -u sprinkler.service -f"
fi

# Configure firewall if ufw is active
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
    echo "🔥 Configuring firewall..."
    sudo ufw allow 8000/tcp comment "Sprinkler GPIO API"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Service Commands:"
echo "   Start:   sudo systemctl start sprinkler.service"
echo "   Stop:    sudo systemctl stop sprinkler.service"
echo "   Status:  sudo systemctl status sprinkler.service"
echo "   Logs:    sudo journalctl -u sprinkler.service -f"
echo ""
echo "🌐 Test the API:"
echo "   curl http://localhost:8000/api/status"
    echo "   curl http://localhost:8000/health"
echo ""
echo "⚡ GPIO Pins configured for sprinkler zones:"
echo "   Zones 1-16: GPIO pins [12, 16, 20, 21, 26, 19, 13, 6, 5, 11, 9, 10, 22, 27, 17, 4]"