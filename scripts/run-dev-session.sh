#!/usr/bin/env bash
version_output=$(gnome-shell --version 2>/dev/null)
major_version=$(echo "$version_output" | awk '{print $3}' | cut -d. -f1)

if (( major_version >= 49 )); then
    dbus-run-session -- gnome-shell --devkit --wayland
else
	dbus-run-session -- gnome-shell --nested --wayland
fi
