<div align="center" style="margin-bottom: 40px;">
  <h1>Vicinae Gnome Extension</h1>
</div>

<p align="center" style="margin-bottom: 30px;">
<img src="https://raw.githubusercontent.com/dagimg-dot/vicinae-gnome-extension/main/src/assets/icons/vicinae-symbolic.svg" alt="Vicinae" width="100">
</p>

<!-- download badge -->
  <p align="center" style="margin-bottom: 30px;">
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest">
      <img src="https://img.shields.io/github/v/release/dagimg-dot/vicinae-gnome-extension?label=Download&style=for-the-badge" alt="Download">
    </a>
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases">
      <img src="https://img.shields.io/github/downloads/dagimg-dot/vicinae-gnome-extension/total?label=Downloads&style=for-the-badge" alt="Downloads">
    </a>
  </p>

✨ **Vicinae GNOME Extension** ✨ - Supercharge your [Vicinae](https://github.com/vicinaehq/vicinae) launcher experience with these awesome features:

- 📋 Seamlessly expose clipboard events through DBus
- 🖼️ Powerful window management APIs via DBus
- 🔒 Protect sensitive apps (like password managers) by blocking clipboard access
- 🪟 Smart launcher window that mimics layer-shell protocol: auto-centers, stays on top, and gracefully closes when you click away

## Installation

1. Download the `.shell-extension.zip` from the [latest release](https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest)
2. Install using: `gnome-extensions install --force <filename>`
3. Restart GNOME Shell or log out/in
4. Enable the extension in GNOME Extensions app
5. Restart your vicinae server if it's running

## Development

### Overview

This extension uses a TypeScript-based development workflow with automated build scripts. The recommended setup involves:

- **Host machine**: Edit code, run linting/formatting
- **VM environment**: Test the extension in a controlled GNOME environment
- **Automated scripts**: Handle building, installation, and development workflow

### Prerequisites

- **Host**: Bun, OpenSSH client
- **VM**: Fedora 41 with GNOME on Xorg (for unsafe reload support)

### Development Scripts

The project includes several automation scripts in the `scripts/` directory:

#### `scripts/build.sh` - Build and Package
Handles the complete build process:
- Compiles TypeScript files using esbuild
- Compiles GResource files and translations
- Creates the `.shell-extension.zip` package
- Supports installation and unsafe reload options

**Usage:**
```bash
./scripts/build.sh              # Build only
./scripts/build.sh --install    # Build and install
./scripts/build.sh --unsafe-reload  # Build, install, and reload GNOME Shell
```

#### `scripts/log.sh` - Log Monitoring
Monitors GNOME Shell logs for debugging:
- Captures logs from both `gnome-shell` and `gjs` processes
- Supports filtered output showing only extension-related logs
- Automatically extracts extension name from `metadata.json`

**Usage:**
```bash
./scripts/log.sh        # All logs
./scripts/log.sh -f     # Filtered logs (extension + errors only)
```

#### `scripts/setup-vm.sh` - VM Bootstrap
Automates VM setup for development:
- Copies `dev-vicinae.sh` to the VM
- Installs `sshfs` and creates mount points
- Sets up proper permissions

**Usage:**
```bash
./scripts/setup-vm.sh user@vm-ip
```

#### `scripts/dev-vicinae.sh` - Development Environment
Sets up the development environment inside the VM:
- Mounts the host project directory via SSHFS
- Changes to the project directory
- Provides an interactive shell

**Usage:**
```bash
~/dev-vicinae.sh  # Run inside the VM
```

### Development Workflow

#### 1. Host Machine Setup

**Code Quality Tools:**
```bash
bun format      # Format code with Biome
bun lint        # Lint with safe fixes
bun lint:fix    # Lint with unsafe fixes  
bun check       # Combined lint + format
```

#### 2. VM Environment Setup

**Initial VM Configuration:**
1. Choose "GNOME on Xorg" at login
2. Enable Unsafe mode: `Alt+F2` → `lg` → settings → enable Unsafe mode
2. Install required tools (automated by setup script):
   ```bash
   sudo dnf install -y fuse-sshfs gnome-extensions-app
   ```
3. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

#### 3. Development Commands (Run in VM)

**Bootstrap VM environment on Host:**
```bash
bun setup user@vm-ip  # Bootstrap VM environment
```

**Build and Install:**
```bash
bun build:install    # Build and install extension
bun dev             # Build, install, and unsafe-reload (Xorg only)
bun dev:nested      # Build, install, and start nested Wayland session
```

**Debugging:**
```bash
bun log             # Monitor extension logs (filtered)
bun log:all         # Monitor all GNOME Shell logs
```

### Project Structure

- **`src/`**: TypeScript source files
- **`dist/`**: Compiled JavaScript (auto-generated)
- **`build/`**: Build artifacts and packages (gitignored)
- **`scripts/`**: Development automation scripts
- **`data/`**: Static resources (icons, UI files)

### Notes

- Build artifacts are automatically placed in `build/` directory
- The `dist/` directory contains compiled JavaScript when using TypeScript
- Biome handles all linting and formatting; `dist/` is gitignored
- Unsafe reload only works on Xorg sessions, not Wayland using the [Unsafe Mode Extension](https://github.com/linushdot/unsafe-mode-menu)

## License

This software is distributed under MIT license. See the license file for details.
