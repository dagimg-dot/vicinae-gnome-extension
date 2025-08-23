#!/bin/bash
set -euo pipefail

# Usage: ./setup-vm.sh user@vm-ip
# Copies ./dev-vicinae.sh to the VM's home, ensures it's executable, creates /mnt/host/vicinae-gnome-extension,
# and installs sshfs on the VM for mounting the host project from within the VM.

if [ "${1:-}" = "" ]; then
    echo "Usage: $0 user@vm-ip"
    exit 1
fi

VM_TARGET="$1"

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

if [ ! -f "$SCRIPT_DIR/dev-vicinae.sh" ]; then
    echo "ERROR: $SCRIPT_DIR/dev-vicinae.sh not found."
    exit 1
fi

echo "Copying dev-vicinae.sh to $VM_TARGET:~/dev-vicinae.sh ..."
scp "$SCRIPT_DIR/dev-vicinae.sh" "$VM_TARGET:~/dev-vicinae.sh"

echo "Preparing VM (install sshfs, create mountpoint, set permissions)..."
# Use a TTY so sudo can prompt if needed; allow password auth (no BatchMode)
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
    chmod +x ~/dev-vicinae.sh; \
    echo 'Setup complete on VM.' \
" >/dev/null

echo "All done. On the VM, run: ~/dev-vicinae.sh"


