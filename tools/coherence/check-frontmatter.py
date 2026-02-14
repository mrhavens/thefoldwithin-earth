#!/usr/bin/env python3
"""
check-frontmatter.py - Validates markdown files have frontmatter

One thing: Check if files have YAML frontmatter.
"""

import sys
import yaml
from pathlib import Path

def has_frontmatter(filepath):
    """Check if file has YAML frontmatter."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            if content.startswith("---"):
                parts = content.split("---", 3)
                if len(parts) >= 3:
                    yaml.safe_load(parts[1])
                    return True
    except Exception:
        pass
    return False

def main():
    """Check markdown files for frontmatter."""
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    
    issues = []
    checked = 0
    path = Path(path_arg)
    
    if path.is_file() and path.suffix == ".md":
        checked = 1
        if not has_frontmatter(path):
            issues.append(str(path))
    elif path.is_dir():
        for filepath in path.rglob("*.md"):
            checked += 1
            if not has_frontmatter(filepath):
                issues.append(str(filepath))
    else:
        print(f"Error: {path_arg} is not a file or directory")
        sys.exit(2)
    
    print(f"Checked: {checked}")
    print(f"Missing frontmatter: {len(issues)}")
    
    if issues:
        print("\nFiles missing frontmatter:")
        for issue in issues:
            print(f"  {issue}")
        sys.exit(1)
    else:
        print("All files have frontmatter. OK")
        sys.exit(0)

if __name__ == "__main__":
    main()
