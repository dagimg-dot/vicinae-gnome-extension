#!/bin/bash
set -euo pipefail

# Usage: ./setup.sh user@vm-ip
# Generates dev-{project-name}.sh script and sets up VM for development

if [ "${1:-}" = "" ]; then
    echo "Usage: $0 user@vm-ip"
    exit 1
fi

VM_TARGET="$1"

# Get the script directory
SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Get the project directory (parent of scripts)
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')"
PROJECT_ABSOLUTE_PATH="$(realpath "$PROJECT_DIR")"

echo "Project detected: $PROJECT_NAME"
echo "Project path: $PROJECT_ABSOLUTE_PATH"

# Helper function to get machine IP
get_machine_ip() {
    # Try to get the IP address used for SSH connections
    # First try to get the IP from the default route
    local ip
    ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    
    # If that fails, try to get the IP from network interfaces
    if [ -z "$ip" ]; then
        ip=$(ip addr show | grep -oP 'inet \K192\.168\.\d+\.\d+' | head -1 || true)
    fi
    
    # If still no IP, try alternative methods
    if [ -z "$ip" ]; then
        ip=$(hostname -I | awk '{print $1}' || true)
    fi
    
    # Fallback to localhost if nothing else works
    if [ -z "$ip" ]; then
        echo "ERROR: Could not detect machine IP" >&2
        exit 1
    fi
    
    echo "$ip"
}

# Helper function to construct host specification
get_host_spec() {
    local project_path="$1"
    local machine_ip
    machine_ip=$(get_machine_ip)
    echo "$(whoami)@${machine_ip}:${project_path}"
}

# Generate the dev script
DEV_SCRIPT_NAME="dev-${PROJECT_NAME}.sh"
DEV_SCRIPT_PATH="${SCRIPT_DIR}/${DEV_SCRIPT_NAME}"

echo "Generating ${DEV_SCRIPT_NAME}..."

# Create the dev script content
cat > "$DEV_SCRIPT_PATH" << EOF
#!/bin/bash
set -euo pipefail

MOUNT_POINT="/mnt/host/${PROJECT_NAME}"
HOST_SPEC="$(get_host_spec "$PROJECT_ABSOLUTE_PATH")"

mkdir -p "\$MOUNT_POINT"

if ! mountpoint -q "\$MOUNT_POINT"; then
	sshfs "\$HOST_SPEC" "\$MOUNT_POINT" -o follow_symlinks
fi

cd "\$MOUNT_POINT" || { echo "Failed to change directory to \$MOUNT_POINT"; exit 1; }

# Replace the current process with an interactive shell so the CWD persists
exec "\${SHELL:-/bin/bash}" -i
EOF

# Make the generated script executable
chmod +x "$DEV_SCRIPT_PATH"

echo "Generated ${DEV_SCRIPT_NAME} with host spec: $(get_host_spec "$PROJECT_ABSOLUTE_PATH")"

# Copy the dev script to the VM
echo "Copying ${DEV_SCRIPT_NAME} to $VM_TARGET:~/"
scp "$DEV_SCRIPT_PATH" "$VM_TARGET:~/"

# Setup VM (install sshfs, create mountpoint, set permissions)
echo "Preparing VM (install sshfs, create mountpoint, set permissions)..."
ssh -t "$VM_TARGET" "\
    set -e; \
    if ! command -v sshfs >/dev/null 2>&1; then \
      if command -v dnf >/dev/null 2>&1; then \
        sudo dnf install -y fuse-sshfs >/dev/null; \
      elif command -v apt >/dev/null 2>&1; then \
        sudo apt update >/dev/null && sudo apt install -y sshfs >/dev/null; \
      fi; \
    fi; \
    mkdir -p /mnt/host; \
    chmod +x ~/${DEV_SCRIPT_NAME}; \
    echo 'Setup complete on VM.' \
" >/dev/null

echo "All done. On the VM, run: ~/${DEV_SCRIPT_NAME}"