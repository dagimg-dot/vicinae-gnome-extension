#!/usr/bin/env bash
set -euo pipefail

EXTENSIONS_URL="https://extensions.gnome.org"
LOGIN_URL="$EXTENSIONS_URL/api/v1/accounts/login/"
UPLOAD_URL="$EXTENSIONS_URL/api/v1/extensions"

usage() {
    cat << EOF
Usage: $0 [OPTIONS] <EXTENSION_BUNDLE>...
Upload GNOME Shell extensions to extensions.gnome.org
Options:
    -u, --username USERNAME     Username for extensions.gnome.org
    -p, --password PASSWORD     Password for extensions.gnome.org
    -h, --help                  Show this help message
Examples:
    $0 -u myuser -p mypass extension.zip
    $0 --username user --password pass extension1.zip extension2.zip
Note: For CI usage, consider using environment variables:
    GNOME_USERNAME=user GNOME_PASSWORD=pass $0 extension.zip
EOF
}

error() {
    echo "ERROR: $*" >&2
    exit 1
}

authenticate() {
    local username="$1"
    local password="$2"
    echo "Authenticating with extensions.gnome.org..." >&2
    local response
    response=$(curl -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "Accept: application/json" \
        -d "login=${username}&password=${password}" \
        "$LOGIN_URL" || true)
    if [[ -z "$response" ]]; then
        error "Failed to connect to extensions.gnome.org"
    fi
    local token
    token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null || true)
    if [[ -n "$token" ]]; then
        echo "Authentication successful" >&2
        echo "$token"
    else
        local error_msg
        error_msg=$(echo "$response" | jq -r '.error // "Authentication failed"' 2>/dev/null || echo "Authentication failed")
        error "$error_msg"
    fi
}

upload_extension() {
    local file="$1"
    local token="$2"
    if [[ ! -f "$file" ]]; then
        error "File not found: $file"
    fi
    echo "Uploading $file..." >&2

    local response
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: Token $token" \
        -F "source=@$file" \
        -F "shell_license_compliant=true" \
        -F "tos_compliant=true" \
        "$UPLOAD_URL" || true)
    
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)
    
    if [[ -z "$response_body" ]]; then
        error "Failed to upload $file"
    fi

    if [[ "$http_code" == "201" ]]; then
        echo "Successfully uploaded $file" >&2
    else
        local error_msg
        error_msg=$(echo "$response_body" | jq -r '.detail // .error // "Upload failed"' 2>/dev/null || echo "Upload failed")
        error "Failed to upload $file (HTTP $http_code): $error_msg"
    fi
}

main() {
    local username="${GNOME_USERNAME:-}"
    local password="${GNOME_PASSWORD:-}"
    local files=()
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--username)
                username="$2"
                shift 2
                ;;
            -p|--password)
                password="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                ;;
            *)
                files+=("$1")
                shift
                ;;
        esac
    done
    if [[ ${#files[@]} -eq 0 ]]; then
        error "No extension bundles specified. Use -h for help."
    fi
    if [[ -z "$username" ]]; then
        error "Username is required. Use -u/--username or set GNOME_USERNAME environment variable."
    fi
    if [[ -z "$password" ]]; then
        error "Password is required. Use -p/--password or set GNOME_PASSWORD environment variable."
    fi

    if ! command -v curl >/dev/null; then
        error "curl is required"
    fi
    if ! command -v jq >/dev/null; then
        error "jq is required"
    fi

    local token
    token=$(authenticate "$username" "$password")

    for file in "${files[@]}"; do
        upload_extension "$file" "$token"
    done

    echo "All uploads completed successfully" >&2
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
