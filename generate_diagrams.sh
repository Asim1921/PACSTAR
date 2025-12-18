#!/bin/bash
# ============================================================================
# PACSTAR Architecture Diagram Generator
# ============================================================================
# This script generates architecture diagrams from the Graphviz DOT file
#
# Prerequisites:
#   - Install Graphviz: sudo apt install graphviz
#   - Or on Mac: brew install graphviz
#
# Usage:
#   ./generate_diagrams.sh [format]
#   
# Formats: png, svg, pdf (default: png)
# ============================================================================

set -e

# Configuration
DOT_FILE="ARCHITECTURE_DIAGRAMS.dot"
OUTPUT_DIR="diagrams"
FORMAT="${1:-png}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     PACSTAR Architecture Diagram Generator                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Graphviz is installed
if ! command -v dot &> /dev/null; then
    echo -e "${YELLOW}⚠️  Graphviz is not installed. Installing...${NC}"
    if command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y graphviz
    elif command -v brew &> /dev/null; then
        brew install graphviz
    elif command -v yum &> /dev/null; then
        sudo yum install -y graphviz
    else
        echo "❌ Please install Graphviz manually:"
        echo "   Ubuntu/Debian: sudo apt install graphviz"
        echo "   MacOS: brew install graphviz"
        echo "   Fedora/RHEL: sudo yum install graphviz"
        exit 1
    fi
fi

# Check if DOT file exists
if [ ! -f "$DOT_FILE" ]; then
    echo "❌ Error: $DOT_FILE not found!"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}✓ Graphviz installed${NC}"
echo -e "${GREEN}✓ Output format: $FORMAT${NC}"
echo -e "${GREEN}✓ Output directory: $OUTPUT_DIR/${NC}"
echo ""

# Extract and generate individual diagrams
echo -e "${BLUE}Generating diagrams...${NC}"
echo ""

# Array of diagram names (matching the digraph names in the DOT file)
DIAGRAMS=(
    "HighLevelArchitecture:1_high_level_architecture"
    "ComponentArchitecture:2_component_architecture"
    "DatabaseSchema:3_database_schema"
    "AuthenticationFlow:4_authentication_flow"
    "ChallengeDeployment:5_challenge_deployment"
    "DockerArchitecture:6_docker_architecture"
    "SecurityArchitecture:7_security_architecture"
    "APIEndpoints:8_api_endpoints"
)

# Generate each diagram
for item in "${DIAGRAMS[@]}"; do
    IFS=':' read -r graph_name file_name <<< "$item"
    
    echo -n "  📊 Generating $file_name.$FORMAT... "
    
    # Extract the specific digraph and generate
    awk "/digraph $graph_name/,/^}$/" "$DOT_FILE" > "/tmp/${graph_name}.dot"
    
    if [ -s "/tmp/${graph_name}.dot" ]; then
        dot -T$FORMAT "/tmp/${graph_name}.dot" -o "$OUTPUT_DIR/${file_name}.$FORMAT"
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠ Skipped (not found)${NC}"
    fi
    
    rm -f "/tmp/${graph_name}.dot"
done

# Also generate a combined diagram (all in one)
echo -n "  📊 Generating combined_all_diagrams.$FORMAT... "
dot -T$FORMAT "$DOT_FILE" -o "$OUTPUT_DIR/combined_all_diagrams.$FORMAT" 2>/dev/null || true
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All diagrams generated successfully!${NC}"
echo ""
echo "📁 Output files:"
ls -la "$OUTPUT_DIR/"*.$FORMAT 2>/dev/null | awk '{print "   " $NF}'
echo ""
echo -e "${BLUE}Tip: Open the diagrams with:${NC}"
echo "   xdg-open $OUTPUT_DIR/1_high_level_architecture.$FORMAT"
echo ""


