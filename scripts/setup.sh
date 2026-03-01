#!/bin/bash
set -euo pipefail

PORT=22
VM_TARGET=""

# Parse arguments to support a custom port
while [[ $# -gt 0 ]]; do
	case $1 in
	-p | --port)
		PORT="$2"
		shift 2
		;;
	*)
		VM_TARGET="$1"
		shift
		;;
	esac
done

if [ -z "$VM_TARGET" ]; then
	echo "Usage: $0 [-p port] user@vm-ip  (port defaults to 22)"
	echo "Example for GNOME Boxes Tunnel: $0 -p 2222 jdev@localhost"
	exit 1
fi

# Get the script directory
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Get the project directory (parent of scripts)
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]')"
PROJECT_ABSOLUTE_PATH="$(realpath "$PROJECT_DIR")"

echo "Project detected: $PROJECT_NAME"
echo "Project path: $PROJECT_ABSOLUTE_PATH"

# Helper function to get machine IP
get_machine_ip() {
	local ip
	ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' | head -1)

	if [ -z "$ip" ]; then
		ip=$(ip addr show | grep -oP 'inet \K192\.168\.\d+\.\d+' | head -1 || true)
	fi
	if [ -z "$ip" ]; then
		ip=$(hostname -I | awk '{print $1}' || true)
	fi
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

cat >"$DEV_SCRIPT_PATH" <<EOF
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

chmod +x "$DEV_SCRIPT_PATH"

echo "Generated ${DEV_SCRIPT_NAME} with host spec: $(get_host_spec "$PROJECT_ABSOLUTE_PATH")"

# Copy the dev script to the VM using the correct port flag (-P for scp)
echo "Copying ${DEV_SCRIPT_NAME} to $VM_TARGET:~/"
scp -P "$PORT" "$DEV_SCRIPT_PATH" "$VM_TARGET:~/"

# Setup VM using the correct port flag (-p for ssh)
echo "Preparing VM (install sshfs, create mountpoint, set permissions)..."

# Run via bash explicitly so it works when the VM's login shell is fish (or other non-bash).
# Copy script to remote first so ssh -t gets a real TTY (needed for sudo password prompts).
REMOTE_SETUP_SCRIPT=$(
	cat <<REMOTE_EOF
set -e
if ! command -v sshfs >/dev/null 2>&1; then
  echo 'Installing sshfs...'
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y fuse-sshfs
  elif command -v apt >/dev/null 2>&1; then
    sudo apt update && sudo apt install -y sshfs
  fi
fi
echo 'Setting up /mnt/host permissions...'
sudo mkdir -p /mnt/host
sudo chown -R \$USER:\$USER /mnt/host
chmod +x \$HOME/${DEV_SCRIPT_NAME}
echo 'Setup complete on VM.'
REMOTE_EOF
)

TMP_LOCAL=$(mktemp)
TMP_REMOTE_SCRIPT="/tmp/setup-vicinae-$$.sh"

echo "$REMOTE_SETUP_SCRIPT" >"$TMP_LOCAL"

scp -P "$PORT" -q "$TMP_LOCAL" "$VM_TARGET:$TMP_REMOTE_SCRIPT"
rm -f "$TMP_LOCAL"
ssh -p "$PORT" -t "$VM_TARGET" "bash $TMP_REMOTE_SCRIPT && rm -f $TMP_REMOTE_SCRIPT"

echo "All done. On the VM, run: ~/${DEV_SCRIPT_NAME}"
