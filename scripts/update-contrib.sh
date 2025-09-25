#!/bin/bash

# update-contrib.sh - Automatically update contributors in AboutPage.ts based on git history
# Usage: ./scripts/update-contrib.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ABOUT_PAGE_FILE="src/prefs/AboutPage.ts"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ABOUT_PAGE_PATH="$PROJECT_ROOT/$ABOUT_PAGE_FILE"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if file exists
check_file_exists() {
    if [[ ! -f "$ABOUT_PAGE_PATH" ]]; then
        print_error "AboutPage.ts not found at: $ABOUT_PAGE_PATH"
        exit 1
    fi
}

# Function to get contributors from git log
get_git_contributors() {
    print_info "Fetching contributors from git history..."
    
    # Get all unique authors from git log, excluding merge commits
    local contributors=()
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            contributors+=("$line")
        fi
    done < <(git log --pretty=format:"%an" --no-merges | sort -u)
    
    print_info "Found ${#contributors[@]} unique contributors in git history"
    return 0
}

# Function to clean and normalize contributor names
normalize_name() {
    local name="$1"
    # Remove extra whitespace and normalize case
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/  */ /g')
    echo "$name"
}

# Function to determine contributor role
get_contributor_role() {
    local contributor="$1"
    
    # Check for original author
    if [[ "$contributor" == *"Dagim"* ]] || [[ "$contributor" == *"dagimg"* ]]; then
        echo "Original Author"
    else
        echo "Contributor"
    fi
}

# Function to update AboutPage.ts with new contributors
update_about_page() {
    local contributors=("$@")
    
    print_info "Updating AboutPage.ts with ${#contributors[@]} contributors..."
    
    # Create backup
    cp "$ABOUT_PAGE_PATH" "$ABOUT_PAGE_PATH.backup"
    print_info "Backup created: AboutPage.ts.backup"
    
    # Create new CREDITS array content
    local temp_file
    temp_file=$(mktemp)
    
    cat > "$temp_file" << 'EOF'
export const CREDITS: Credit[] = [
EOF

    # Add each contributor
    for contrib in "${contributors[@]}"; do
        # Normalize name
        contrib=$(normalize_name "$contrib")
        
        # Skip empty names
        if [[ -z "$contrib" ]]; then
            continue
        fi
        
        # Get role
        role=$(get_contributor_role "$contrib")
        
        cat >> "$temp_file" << EOF
    {
        title: "$contrib",
        subtitle: "$role",
    },
EOF
    done

    cat >> "$temp_file" << 'EOF'
];
EOF

    # Replace the CREDITS array in AboutPage.ts using awk
    awk -v temp_file="$temp_file" '
    BEGIN {
        # Read the new credits content
        while ((getline line < temp_file) > 0) {
            new_credits[++n] = line
        }
        close(temp_file)
    }
    /^export const CREDITS/ { 
        # Print the new credits array
        for (i = 1; i <= n; i++) {
            print new_credits[i]
        }
        skip = 1
        next
    }
    skip && /^];/ { 
        skip = 0
        next
    }
    !skip { print }
    ' "$ABOUT_PAGE_PATH" > "$ABOUT_PAGE_PATH.new"

    # Replace original file
    mv "$ABOUT_PAGE_PATH.new" "$ABOUT_PAGE_PATH"
    
    # Clean up
    rm -f "$temp_file"
    
    print_success "Successfully updated AboutPage.ts"
}

# Function to display current contributors
show_current_contributors() {
    print_info "Current contributors in AboutPage.ts:"
    
    # Extract and display contributors
    awk '
    /title: "/ {
        gsub(/.*title: "/, "")
        gsub(/".*/, "")
        name = $0
        getline
        gsub(/.*subtitle: "/, "")
        gsub(/".*/, "")
        role = $0
        print "  - " name " (" role ")"
    }
    ' "$ABOUT_PAGE_PATH"
}

# Main function
main() {
    print_info "Starting contributor update process..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository. Please run this script from the project root."
        exit 1
    fi
    
    # Check if AboutPage.ts exists
    check_file_exists
    
    # Get contributors from git
    get_git_contributors
    
    # Convert to array for processing
    local contributors=()
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            contributors+=("$line")
        fi
    done < <(git log --pretty=format:"%an" --no-merges | sort -u)
    
    # Update the AboutPage.ts file
    update_about_page "${contributors[@]}"
    
    # Show current contributors
    show_current_contributors

    # Clean up backup
    rm "$ABOUT_PAGE_PATH.backup"
    
    print_success "Update complete! 🎉"
}

# Run main function
main "$@"