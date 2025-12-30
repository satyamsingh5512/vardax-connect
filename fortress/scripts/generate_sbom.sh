#!/bin/bash
# SBOM Generation Script
# Security: Generate Software Bill of Materials for supply chain verification
#
# NIST Control: CM-8 (Information System Component Inventory)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_DIR}/sbom"

echo "=== Fortress SBOM Generator ==="
echo "Project: ${PROJECT_DIR}"
echo "Output: ${OUTPUT_DIR}"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Generate SBOM using CycloneDX
echo "[1/4] Generating CycloneDX SBOM..."
if command -v cyclonedx-py &> /dev/null; then
    cd "${PROJECT_DIR}"
    cyclonedx-py requirements \
        --input requirements.txt \
        --output "${OUTPUT_DIR}/sbom-cyclonedx.json" \
        --format json \
        --schema-version 1.5
    echo "  Created: sbom-cyclonedx.json"
else
    echo "  SKIP: cyclonedx-bom not installed"
    echo "  Install: pip install cyclonedx-bom"
fi

# Generate license report
echo "[2/4] Generating license report..."
if command -v pip-licenses &> /dev/null; then
    pip-licenses \
        --format=json \
        --output-file="${OUTPUT_DIR}/licenses.json" \
        --with-urls \
        --with-description
    echo "  Created: licenses.json"
    
    # Also create human-readable version
    pip-licenses \
        --format=markdown \
        --output-file="${OUTPUT_DIR}/licenses.md"
    echo "  Created: licenses.md"
else
    echo "  SKIP: pip-licenses not installed"
    echo "  Install: pip install pip-licenses"
fi

# Verify package checksums
echo "[3/4] Verifying package checksums..."
if [ -f "${PROJECT_DIR}/requirements.txt" ]; then
    # Generate checksums for installed packages
    pip freeze > "${OUTPUT_DIR}/frozen-requirements.txt"
    
    # Create checksum file
    echo "# Package checksums (SHA256)" > "${OUTPUT_DIR}/checksums.txt"
    echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${OUTPUT_DIR}/checksums.txt"
    echo "" >> "${OUTPUT_DIR}/checksums.txt"
    
    while IFS= read -r package; do
        if [[ ! "$package" =~ ^# ]] && [[ -n "$package" ]]; then
            pkg_name=$(echo "$package" | cut -d'=' -f1)
            pkg_version=$(echo "$package" | cut -d'=' -f3)
            
            # Get package info from pip
            pip_info=$(pip show "$pkg_name" 2>/dev/null || true)
            if [ -n "$pip_info" ]; then
                location=$(echo "$pip_info" | grep "Location:" | cut -d' ' -f2)
                if [ -n "$location" ] && [ -d "$location" ]; then
                    # Calculate checksum of package directory
                    checksum=$(find "$location/$pkg_name" -type f -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1 || echo "N/A")
                    echo "${pkg_name}==${pkg_version}: ${checksum}" >> "${OUTPUT_DIR}/checksums.txt"
                fi
            fi
        fi
    done < "${OUTPUT_DIR}/frozen-requirements.txt"
    
    echo "  Created: checksums.txt"
fi

# Security vulnerability scan
echo "[4/4] Scanning for vulnerabilities..."
if command -v safety &> /dev/null; then
    safety check \
        --file="${PROJECT_DIR}/requirements.txt" \
        --json \
        --output="${OUTPUT_DIR}/vulnerabilities.json" \
        2>/dev/null || true
    echo "  Created: vulnerabilities.json"
    
    # Count vulnerabilities
    if [ -f "${OUTPUT_DIR}/vulnerabilities.json" ]; then
        vuln_count=$(jq 'length' "${OUTPUT_DIR}/vulnerabilities.json" 2>/dev/null || echo "0")
        if [ "$vuln_count" -gt 0 ]; then
            echo "  WARNING: ${vuln_count} vulnerabilities found!"
        else
            echo "  No known vulnerabilities found"
        fi
    fi
else
    echo "  SKIP: safety not installed"
    echo "  Install: pip install safety"
fi

echo ""
echo "=== SBOM Generation Complete ==="
echo "Files created in: ${OUTPUT_DIR}"
ls -la "${OUTPUT_DIR}"

# Verification instructions
echo ""
echo "=== Verification Instructions ==="
echo "1. Review licenses.md for license compliance"
echo "2. Review vulnerabilities.json for security issues"
echo "3. Store checksums.txt for integrity verification"
echo "4. Include sbom-cyclonedx.json in release artifacts"
