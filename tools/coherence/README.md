# Coherence Tools

Tools for maintaining site coherence.

## Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| check-frontmatter.py | Validates YAML frontmatter exists | `python3 check-frontmatter.py <dir>` |
| check-metadata.py | Validates required fields | `python3 check-metadata.py <dir>` |
| fix-frontmatter.py | Adds missing frontmatter | `python3 fix-frontmatter.py <dir>` |

## Usage

```bash
# Check all fieldnotes
python3 check-frontmatter.py ../public/fieldnotes/
python3 check-metadata.py ../public/fieldnotes/

# Fix missing frontmatter (dry run first!)
python3 fix-frontmatter.py --dry-run ../public/fieldnotes/
python3 fix-frontmatter.py ../public/fieldnotes/
```

## Exit Codes

- 0: Success
- 2: Invalid arguments
