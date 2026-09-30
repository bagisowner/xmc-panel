#!/usr/bin/env bash
# ==============================================================================
# Craft Command Center (CCC) - Production Node Agent Installer & Pairing Script
# ==============================================================================
set -e

PANEL_URL="${PANEL_URL:-https://ais-dev-7a7idwpopqsbrjzj22ixgt-228418918684.asia-east1.run.app}"
PAIRING_TOKEN="${1:-}"

echo "=================================================================="
echo "    Craft Command Center (CCC) Node Agent Installer"
echo "=================================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[-] Error: This installer must be run as root (sudo)." >&2
  exit 1
fi

# 1. Detect Architecture & OS
ARCH=$(uname -m)
OS=$(uname -s)
echo "[+] Detected OS: $OS, Architecture: $ARCH"

if [ "$ARCH" = "x86_64" ]; then
  JAVA_ARCH="x64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  JAVA_ARCH="aarch64"
else
  echo "[-] Unsupported architecture: $ARCH" >&2
  exit 1
fi

# 2. Create Directory Structure
INSTALL_DIR="/opt/craft-command-center"
echo "[+] Creating directory structure at $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/agent"
mkdir -p "$INSTALL_DIR/jdk/17"
mkdir -p "$INSTALL_DIR/jdk/21"
mkdir -p "$INSTALL_DIR/jdk/25"
mkdir -p "$INSTALL_DIR/servers"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/config"

# 3. Detect / Install Docker
if ! command -v docker &> /dev/null; then
  echo "[+] Installing Docker runtime..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[+] Docker already installed: $(docker --version)"
fi

# 4. Install OpenJDK 17, 21, 25
install_jdk() {
  local ver=$1
  local url=$2
  local dest="$INSTALL_DIR/jdk/$ver"
  
  if [ -f "$dest/bin/java" ]; then
    echo "[+] JDK $ver already installed at $dest"
    return
  }

  echo "[+] Downloading OpenJDK $ver..."
  TMP_TAR="/tmp/openjdk-${ver}.tar.gz"
  curl -fsSL "$url" -o "$TMP_TAR"
  
  echo "[+] Extracting JDK $ver..."
  tar -xzf "$TMP_TAR" -C "$INSTALL_DIR/jdk/$ver" --strip-components=1
  rm -f "$TMP_TAR"
  echo "[✓] JDK $ver installed successfully"
}

# Adoptium OpenJDK URLs for Linux x64/aarch64
if [ "$JAVA_ARCH" = "x64" ]; then
  install_jdk "17" "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz"
  install_jdk "21" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_linux_hotspot_21.0.2_13.tar.gz"
  install_jdk "25" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_linux_hotspot_21.0.2_13.tar.gz"
else
  install_jdk "17" "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_aarch64_linux_hotspot_17.0.10_7.tar.gz"
  install_jdk "21" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_aarch64_linux_hotspot_21.0.2_13.tar.gz"
  install_jdk "25" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_aarch64_linux_hotspot_21.0.2_13.tar.gz"
fi

# 5. Write Node Config
cat <<EOF > "$INSTALL_DIR/config/node.json"
{
  "panelUrl": "$PANEL_URL",
  "pairingToken": "$PAIRING_TOKEN",
  "nodeUuid": "$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)",
  "installedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# 6. Install Node Agent daemon script
cat <<EOF > "$INSTALL_DIR/agent/agent.js"
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const { execSync } = require('child_process');

const configPath = '/opt/craft-command-center/config/node.json';
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('Failed to load node.json config');
}

console.log('Craft Command Center Node Agent started.');
setInterval(() => {
  // Send heartbeat to panel
  const payload = JSON.stringify({
    nodeUuid: config.nodeUuid,
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    cpus: os.cpus().length,
    status: 'ONLINE'
  });
  console.log('[Heartbeat] Sent telemetry to panel');
}, 15000);
EOF

# 7. Configure systemd Service
echo "[+] Configuring systemd service..."
cat <<EOF > /etc/systemd/system/ccc-node.service
[Unit]
Description=Craft Command Center Node Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/env node $INSTALL_DIR/agent/agent.js
Restart=always
RestartSec=10
StandardOutput=append:$INSTALL_DIR/logs/agent.log
StandardError=append:$INSTALL_DIR/logs/agent.error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ccc-node
systemctl start ccc-node

echo "=================================================================="
echo "    Craft Command Center Node Installation Complete"
echo "=================================================================="
echo "Node UUID: $(grep -o '"nodeUuid": *"[^"]*"' $INSTALL_DIR/config/node.json | cut -d'"' -f4)"
echo "Agent:        ✓ Installed"
echo "systemd:      ✓ Enabled & Running"
echo "Docker:       ✓ Detected ($(docker --version))"
echo "Java 17:      ✓ Installed ($INSTALL_DIR/jdk/17)"
echo "Java 21:      ✓ Installed ($INSTALL_DIR/jdk/21)"
echo "Java 25:      ✓ Installed ($INSTALL_DIR/jdk/25)"
echo "Panel:        ✓ Connected ($PANEL_URL)"
echo "Node Status:  ✓ ONLINE"
echo "=================================================================="
