# PACSTAR Architecture Diagrams

This directory contains Graphviz DOT files for generating professional architecture diagrams of the PACSTAR CTF Platform.

## 📁 Files

| File | Description |
|------|-------------|
| `1_high_level_architecture.dot` | Complete system architecture showing all layers |
| `3_database_schema.dot` | MongoDB collections and relationships (ERD) |
| `6_docker_architecture.dot` | Docker Compose deployment architecture |
| `../ARCHITECTURE_DIAGRAMS.dot` | All diagrams combined in one file |

## 🛠️ Prerequisites

Install Graphviz:

```bash
# Ubuntu/Debian
sudo apt install graphviz

# macOS
brew install graphviz

# Fedora/RHEL
sudo dnf install graphviz

# Windows (with Chocolatey)
choco install graphviz
```

## 🚀 Generate Diagrams

### Option 1: Use the Shell Script (Recommended)

```bash
cd /home/pacstar/PACSTAR
./generate_diagrams.sh png    # Generate PNG images
./generate_diagrams.sh svg    # Generate SVG (scalable)
./generate_diagrams.sh pdf    # Generate PDF
```

### Option 2: Manual Generation

```bash
# Generate a single diagram
dot -Tpng diagrams/1_high_level_architecture.dot -o diagrams/1_high_level_architecture.png

# Generate SVG (better for web/docs)
dot -Tsvg diagrams/3_database_schema.dot -o diagrams/3_database_schema.svg

# Generate PDF
dot -Tpdf diagrams/6_docker_architecture.dot -o diagrams/6_docker_architecture.pdf
```

### Option 3: Online Tools

Upload the `.dot` files to:
- [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/)
- [Edotor](https://edotor.net/)
- [viz-js.com](http://viz-js.com/)

## 📊 Available Diagrams

### 1. High-Level System Architecture
Shows the complete 4-layer architecture:
- **Presentation Layer**: Next.js Frontend
- **Application Layer**: FastAPI Backend with services
- **Data Layer**: MongoDB collections
- **Infrastructure Layer**: Kubernetes & OpenStack

### 2. Component Architecture
Detailed view of frontend and backend components:
- File structure
- Component relationships
- Service dependencies

### 3. Database Schema (ERD)
Entity Relationship Diagram showing:
- All MongoDB collections
- Field definitions with types
- Foreign key relationships
- Indexes

### 4. Authentication Flow
Sequence diagram showing:
- Login process
- JWT token structure
- RBAC permission matrix

### 5. Challenge Deployment Flow
Two deployment paths:
- Kubernetes containerized challenges
- OpenStack VM-based challenges
- Flag submission process

### 6. Docker Architecture
Docker Compose setup:
- Container relationships
- Network configuration
- Volume mappings
- Health checks

### 7. Security Architecture
Multi-layer security:
- Network security
- Application security
- Authentication/Authorization
- Data security
- Audit/Monitoring

### 8. API Endpoints
Complete API reference:
- All endpoints grouped by resource
- HTTP methods
- Access requirements

## 🎨 Customization

### Change Colors
Edit the `fillcolor` and `color` attributes in the DOT files:
```dot
node [fillcolor="#90CAF9" color="#1976D2"]
```

### Change Layout
Modify `rankdir` at the top of each diagram:
```dot
rankdir=TB;  // Top to Bottom
rankdir=LR;  // Left to Right
rankdir=BT;  // Bottom to Top
rankdir=RL;  // Right to Left
```

### Adjust Spacing
```dot
graph [
    nodesep=0.6   // Horizontal spacing
    ranksep=0.8   // Vertical spacing
    pad="0.5"     // Padding
];
```

### Change Resolution (for PNG)
```dot
graph [dpi=300];  // Higher = better quality, larger file
```

## 📝 Color Scheme Reference

| Layer | Primary Color | Hex Code |
|-------|--------------|----------|
| Users | Green | `#4CAF50` |
| Frontend | Blue | `#1976D2` |
| Backend | Orange | `#F57C00` |
| Database | Purple | `#7B1FA2` |
| Infrastructure | Gray | `#455A64` |
| Security | Red | `#C62828` |

## 🔗 Integration with Documentation

Include generated images in Markdown:
```markdown
![Architecture](./diagrams/1_high_level_architecture.png)
```

Or embed SVG for better scaling:
```html
<img src="./diagrams/1_high_level_architecture.svg" width="100%">
```

## 📖 Learn More

- [Graphviz Documentation](https://graphviz.org/documentation/)
- [DOT Language Reference](https://graphviz.org/doc/info/lang.html)
- [Node Shapes](https://graphviz.org/doc/info/shapes.html)
- [Colors](https://graphviz.org/doc/info/colors.html)


