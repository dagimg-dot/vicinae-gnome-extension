> # Vicinae Gnome Extension

<p align="center">
<img src="https://raw.githubusercontent.com/dagimg-dot/vicinae-gnome-extension/main/src/assets/icons/vicinae-symbolic.svg" alt="Vicinae" width="100">
</p>

<!-- download badge -->
  <p align="center">
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest">
      <img src="https://img.shields.io/github/v/release/dagimg-dot/vicinae-gnome-extension?label=Download&style=for-the-badge" alt="Download">
    </a>
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases">
      <img src="https://img.shields.io/github/downloads/dagimg-dot/vicinae-gnome-extension/total?label=Downloads&style=for-the-badge" alt="Downloads">
    </a>
  </p>

Gnome extension for vicinae launcher to expose clipboard and window managment APIs.

## Installation

1. Download the `.shell-extension.zip` from the [latest release](https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest)
2. Install using: `gnome-extensions install --force <filename>`
3. Enable the extension in GNOME Extensions app
4. Restart GNOME Shell or log out/in

## Development

### Overview

- Edit code on the host machine.
- Test the extension in a Fedora 41 VM using GNOME on Xorg (for unsafe reload).
- Share the project folder into the VM via SSHFS and run dev commands inside the VM.

### Host machine

- Requirements: Bun, OpenSSH client
- Useful scripts:
  - `bun run format` → Format with Biome
  - `bun run lint` → Lint with Biome (safe fixes)
  - `bun run lint:fix` → Lint with unsafe fixes
  - `bun run check` → Lint + format

Optional VM bootstrap (copies `scripts/dev-vicinae.sh`, installs sshfs on VM):

```bash
# Run the script itself
./scripts/setup-vm.sh user@vm-ip

# Run the bun script
bun setup user@vm-ip
```

### VM (Fedora 41)

- At login, choose “GNOME on Xorg”.
- Enable Unsafe mode: Alt+F2 → `lg` → settings → enable Unsafe mode.
- Install tools:

```bash
# This is already automated in the setup script
sudo dnf install -y fuse-sshfs gnome-extensions-app
```

- Install `bun` separately:
```bash
curl -fsSL https://bun.sh/install | bash
```

### Share the project via SSHFS (already automated in the setup script)

Use `scripts/dev-vicinae.sh` inside the VM. It mounts the host project to `/mnt/host/vicinae-gnome-extension`, cds there, and drops you into a shell.

1) In `scripts/dev-vicinae.sh`, set `HOST_SPEC` to your host user/IP and project path.
2) Copy to VM (or use `setup-vm.sh`):

```bash
scp scripts/dev-vicinae.sh user@vm-ip:~/dev-vicinae.sh
ssh user@vm-ip 'chmod +x ~/dev-vicinae.sh'
```

3) On the VM:

```bash
~/dev-vicinae.sh
```

### Build, install, and reload (inside the VM)

```bash
bun install
bun run build:dev   # builds, installs, and unsafe-reloads GNOME Shell (Xorg only)
bun run log         # view GNOME Shell logs
```

Notes
- Build artifacts go to `build/` (gitignored).
- `dist/` contains compiled JS when applicable.
- Biome handles lint/format; `dist/` is ignored.
## License

This software is distributed under MIT license. See the license file for details.
