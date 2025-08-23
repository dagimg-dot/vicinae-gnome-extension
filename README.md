> # gnomext - Gnome Shell Extension Template

> Get to coding in minutes using this gnome shell extension template that comes out of the box with everything you need to get started including

- Typescript
- Biome for linting and formatting
- Esbuild for building
- HMR (hot module replacement) using another virtual machine or nested session
- Third party dependencies support

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

Optional VM bootstrap (copies `scripts/dev.sh`, installs sshfs on VM):

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

Use `scripts/dev.sh` inside the VM. It mounts the host project to `/mnt/host/gnomext`, cds there, and drops you into a shell.

1) In `scripts/dev.sh`, set `HOST_SPEC` to your host user/IP and project path.
2) Copy to VM (or use `setup-vm.sh`):

```bash
scp scripts/dev.sh user@vm-ip:~/dev.sh
ssh user@vm-ip 'chmod +x ~/dev.sh'
```

3) On the VM:

```bash
~/dev.sh
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
