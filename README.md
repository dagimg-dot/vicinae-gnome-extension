<div align="center" style="margin-bottom: 40px;">
  <h1>Vicinae Gnome Extension</h1>
</div>

<a href="https://docs.vicinae.com">
<p align="center" style="margin-bottom: 30px;">
<img src="https://raw.githubusercontent.com/dagimg-dot/vicinae-gnome-extension/main/src/assets/icons/vicinae.svg" alt="Vicinae" width="100">
</p>
</a>

<!-- download badge -->
  <p align="center" style="margin-bottom: 30px;">
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest">
      <img src="https://img.shields.io/github/v/release/dagimg-dot/vicinae-gnome-extension?label=Download&style=for-the-badge" alt="Download">
    </a>
    <a href="https://github.com/dagimg-dot/vicinae-gnome-extension/releases">
      <img src="https://img.shields.io/github/downloads/dagimg-dot/vicinae-gnome-extension/total?label=Downloads&style=for-the-badge" alt="Downloads">
    </a>
  </p>

<p align="center">
  Supercharge your <a href="https://github.com/vicinaehq/vicinae">Vicinae</a> launcher experience
</p>

## Features:

- Clipboard events and Window management APIs through DBus
- Protect sensitive apps (like password managers) by blocking clipboard access
- Launcher window that mimics layer-shell protocol which auto-centers, stays on top, and gracefully closes when you click away
- Paste directly to focused window from vicinae clipboard history view

## Installation

1. Download the `.shell-extension.zip` from the [latest release](https://github.com/dagimg-dot/vicinae-gnome-extension/releases/latest)
2. Install using: `gnome-extensions install --force <filename>`
3. Restart GNOME Shell or log out/in
4. Enable the extension in GNOME Extensions app
5. Restart your vicinae server if it's running

## Development

> Check out [DEVELOPMENT.md](./DEVELOPMENT.md)

## License

This software is distributed under MIT license. See the license file for details.
