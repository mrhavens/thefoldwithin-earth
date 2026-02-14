# Coherence Tools

Tools for maintaining site coherence.

## Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| check-frontmatter.py | Validates YAML frontmatter exists | `python3 check-frontmatter.py <dir>` |
| check-metadata.py | Validates required fields | `python3 check-metadata.py <dir>` |
| fix-frontmatter.py | Adds missing frontmatter | `python3 fix-frontmatter.py <dir>` |
| check-links.py | Finds broken internal links | `python3 check-links.py <dir>` |
| run-coherence.py | Runs all checks at once | `python3 run-coherence.py` |

## Quick Start

```bash
# Run all checks
python3 run-coherence.py

# Or run individual checks
python3 check-frontmatter.py public/fieldnotes/
python3 check-metadata.py public/fieldnotes/
python3 check-links.py public/fieldnotes/

# Fix issues
python3 fix-frontmatter.py --dry-run public/fieldnotes/
python3 fix-frontmatter.py public/fieldnotes/
```

## Exit Codes

- 0: Success / All checks pass
- 1: Issues found
- 2: Invalid arguments
