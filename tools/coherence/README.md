# Coherence Tools

Tools for maintaining site coherence.

## Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| check-frontmatter.py | Validates YAML frontmatter exists | `python3 check-frontmatter.py <dir>` |
| check-metadata.py | Validates required fields | `python3 check-metadata.py <dir>` |

## Usage

```bash
# Check all fieldnotes
python3 check-frontmatter.py ../public/fieldnotes/
python3 check-metadata.py ../public/fieldnotes/

# Check single file
python3 check-metadata.py file.md
```

## Exit Codes

- 0: All files pass
- 1: Some files have issues  
- 2: Invalid arguments
