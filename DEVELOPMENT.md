## Development

### Overview

This extension uses a modern TypeScript-based development workflow with Bun and automated build scripts. The recommended setup involves:

- **Host machine**: Edit code, run linting/formatting, and manage versions
- **VM environment**: Test the extension in a controlled GNOME session
- **Automated scripts**: Handle building, installation, VM setup, and development workflow

### Prerequisites

- **Host**: Bun, OpenSSH client
- **VM**: Linux distribution with GNOME and Wayland (I use Fedora)

### Development Scripts

The project includes several automation scripts in the `scripts/` directory:

**Fun fact:** the build uses [`esbuild-preserve-whitespace`](https://github.com/dagimg-dot/esbuild-preserve-whitespace), a plugin I made because I couldn't find an existing solution that keeps whitespace intact when transpiling GNOME Shell extensions. It's on npm if you need it! ☝️🤓

#### `scripts/build.sh` - Build and Package
Handles the complete build process:
- Compiles TypeScript files using esbuild
- Compiles GResource files and translations
- Creates the `.shell-extension.zip` package
- Supports installation, GDM restart, and unsafe reload (legacy)

#### `scripts/log.sh` - Log Monitoring
Monitors GNOME Shell logs for debugging:
- Captures logs from both `gnome-shell` and `gjs` processes
- Supports filtered output showing only extension-related logs
- Automatically extracts extension name from `metadata.json`

#### `scripts/setup.sh` - VM Bootstrap
Automates VM setup for development:
- Generates `dev-{project}.sh` script for SSHFS mounting and VM access
- Copies development script to VM
- Installs `sshfs` and creates mount points
- Sets up proper permissions and SSHFS mounting

#### `scripts/run-dev-session.sh` - Nested Dev Session
Launches a development GNOME Shell session using `dbus-run-session`:
- Uses `--devkit --wayland` on GNOME 49+
- Falls back to `--nested --wayland` on older versions

#### `scripts/update-contrib.sh` - Contributor Management
Automatically updates contributors in the About page:
- Fetches contributors from git history
- Updates the credits section with GitHub links
- Maintains contributor information dynamically

#### `scripts/bump-version.js` - Version Management
Handles version bumping and releases:
- Updates `package.json` and `metadata.json` versions
- Creates git commits and tags
- Supports semantic versioning

### Development Workflow

#### 1. Host Machine Setup

**Install Dependencies:**
```bash
bun install  # Install all dependencies
```

**Code Quality Tools:**
```bash
bun format         # Format code with Biome
bun lint          # Lint with safe fixes
bun lint:fix      # Lint with unsafe fixes
bun check         # Combined lint + format check
bun check:types   # TypeScript type checking only
```

**Version Management:**
```bash
bun bump 1.5.0    # Bump version to 1.5.0
bun release 1.5.0 # Bump version, commit, and create git tag
```

**Update Contributors:**
```bash
bun update-credits  # Update contributor list from git history
```

#### 2. VM Environment Setup

**Initial VM Configuration:**
1. Install Fedora 41+ and log in
2. Enable **auto-login** so the session restarts automatically after GDM reloads:

   **GUI method**: Settings → Users → Automatic Login (ON)

   **Manual method**: edit `/etc/gdm/custom.conf` and add to the `[daemon]` section:
   ```ini
   [daemon]
   AutomaticLoginEnable=True
   AutomaticLogin=your-username
   ```
3. Install required tools:
   ```bash
   sudo dnf install -y fuse-sshfs gnome-extensions-app jq
   ```
4. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
5. Set up autostart for convenient development:
   - Add **GNOME Extensions** (`org.gnome.Extensions.desktop`) to autostart
   - Add a **Terminal** to autostart

**Bootstrap VM environment from Host:**
```bash
bun setup -- user@vm-ip  # Generate dev script, copy to VM, install sshfs
```

**Run generated script in VM:**
```bash
~/dev-vicinae-gnome-extension.sh  # Mount host directory via SSHFS and start shell
```

Once mounted, you are in the project directory at `/mnt/host/vicinae-gnome-extension` with an interactive shell.

#### 3. Development Commands

**Build and Install (GNOME 49+ Wayland):**
```bash
bun build              # Build extension package only
bun build:install      # Build and install extension
bun build:install:gdm  # Build, install, then restart GDM to reload (auto-login required)
```

**Build and Install (Xorg / old workflow):**
```bash
bun dev            # Build, install, and unsafe-reload (Xorg only, legacy)
bun dev:nested     # Build, install, and start nested Wayland session
```

**Debugging:**
```bash
bun log            # Monitor extension logs (filtered)
bun log:all        # Monitor all GNOME Shell logs
```

#### Typical Dev Loop (GNOME 49+ on Wayland)

1. Edit code on the **host**
2. On the **VM**, ensure the SSHFS mount is active (`~/dev-vicinae-gnome-extension.sh`)
3. In the mounted directory on the VM:
   ```bash
   bun build:install:gdm
   ```
4. GDM restarts → VM auto-logs back in → extension is installed and active
5. Check logs:
   ```bash
   bun log
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
- Generated `scripts/dev-*.sh` files are gitignored — each developer/environment generates their own via `bun setup`
- GDM restart (`systemctl restart gdm`) logs out the session — ensure **auto-login** is enabled in the VM so the session comes back without manual login
