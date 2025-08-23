#!/bin/bash

# Function to display help information
show_help() {
    echo "Usage: $0 [OPTION]"
	echo ""
    echo "Capture and display logs for GNOME Shell extensions."
    echo
    echo "Options:"
    echo "  -f, --filtered    Apply filtering to show only relevant logs"
    echo "  -h, --help        Display this help message and exit"
    echo
    echo "This script reads the extension name from metadata.json in the current directory."
    echo "It captures logs from both gnome-shell and gjs processes."
    echo
    echo "When run without options, it displays all logs without filtering."
    echo "Use the -f or --filtered option to show only logs related to your extension,"
    echo "stack traces, and JavaScript errors."
    echo
    echo "Make sure to run this script from your GNOME Shell extension's directory."
}

# Check if metadata.json exists
if [ ! -f metadata.json ]; then
    echo "Error: metadata.json not found"
    echo "Please run this script from your GNOME Shell extension's directory."
    exit 1
fi

# Extract the project name from metadata.json
PROJECT_NAME=$(cat metadata.json | jq -r '.name')

# Check if project name is empty
if [ -z "$PROJECT_NAME" ]; then
    echo "Error: metadata.json does not contain a name field"
    exit 1
fi

# Default to unfiltered logs
FILTERED=false

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--filtered) FILTERED=true ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown parameter passed: $1"; show_help; exit 1 ;;
    esac
    shift
done

echo "Listening to logs for $PROJECT_NAME ..."
echo "Filtered: $FILTERED"
echo "Press Ctrl+C to stop capturing logs."
echo

capture_gnome_shell_extension_logs() {
    if [ "$FILTERED" = true ]; then
        journalctl /usr/bin/gnome-shell -f -o cat | awk '
        /^\['"$PROJECT_NAME"'\]/ {
            print
        }
        /^Extension/ {
            print
        }
        /^Stack trace:/ {
            print
            while (getline > 0) {
                if ($0 ~ /^[[:space:]]*$/) break
                print
            }
            print ""
        }
        /^JS ERROR:/ {
            print
            while (getline > 0) {
                if ($0 ~ /^[[:space:]]*$/) break
                print
            }
            print ""
        }'
    else
        journalctl /usr/bin/gnome-shell -f -o cat
    fi
}

capture_gnome_shell_extension_pref_logs() {
    if [ "$FILTERED" = true ]; then
        journalctl /usr/bin/gjs -f -o cat | awk '
        /^'"$PROJECT_NAME"'/ {
            print
        }
        /^Extension/ {
            print
        }
        /^Stack trace:/ {
            print
            while (getline > 0) {
                if ($0 ~ /^[[:space:]]*$/) break
                print
            }
            print ""
        }
        /^JS ERROR:/ {
            print
            while (getline > 0) {
                if ($0 ~ /^[[:space:]]*$/) break
                print
            }
            print ""
        }'
    else
        journalctl /usr/bin/gjs -f -o cat
    fi
}

capture_gnome_shell_extension_logs &
capture_gnome_shell_extension_pref_logs &

wait
