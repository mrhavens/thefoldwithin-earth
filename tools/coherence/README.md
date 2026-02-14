# Coherence Tools

Tools for maintaining site coherence.

## Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| check-frontmatter.py | Validates YAML frontmatter exists | `python3 check-frontmatter.py <dir>` |

## Usage

```bash
# Check all fieldnotes
python3 check-frontmatter.py ../public/fieldnotes/

# Check single file
python3 check-frontmatter.py file.md
```

## Exit Codes

- 0: All files have frontmatter
- 1: Some files missing frontmatter
- 2: Invalid arguments

## Adding New Tools

1. Create new tool in this directory
2. Add entry to this README
3. Document usage and exit codes
