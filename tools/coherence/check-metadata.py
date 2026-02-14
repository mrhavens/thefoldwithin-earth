#!/usr/bin/env python3
"""
check-metadata.py - Validates required frontmatter fields

One thing: Check if frontmatter has required fields.
"""

import sys
import yaml
from pathlib import Path

# Required fields for fieldnotes
REQUIRED_FIELDS = [
    "title",
    "date",
]

# Optional but recommended fields
RECOMMENDED_FIELDS = [
    "author",
    "type",
    "status",
]

def parse_frontmatter(filepath):
    """Parse frontmatter from markdown file."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            if content.startswith("---"):
                parts = content.split("---", 3)
                if len(parts) >= 3:
                    return yaml.safe_load(parts[1])
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
    return {}

def check_metadata(filepath):
    """Check if file has required frontmatter fields."""
    fm = parse_frontmatter(filepath)
    
    if not fm:
        return {"error": "No frontmatter found"}
    
    issues = []
    
    # Check required
    for field in REQUIRED_FIELDS:
        if field not in fm or not fm[field]:
            issues.append(f"Missing required: {field}")
    
    # Check recommended
    for field in RECOMMENDED_FIELDS:
        if field not in fm or not fm[field]:
            issues.append(f"Missing recommended: {field}")
    
    return {
        "required_ok": all(f in fm and fm[f] for f in REQUIRED_FIELDS),
        "recommended_ok": all(f in fm and fm[f] for f in RECOMMENDED_FIELDS),
        "issues": issues,
    }

def main():
    """Check metadata in markdown files."""
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    
    issues = []
    checked = 0
    path = Path(path_arg)
    
    if path.is_file() and path.suffix == ".md":
        checked = 1
        result = check_metadata(path)
        if result.get("issues"):
            issues.append((str(path), result["issues"]))
    elif path.is_dir():
        for filepath in path.rglob("*.md"):
            checked += 1
            result = check_metadata(filepath)
            if result.get("issues"):
                issues.append((str(filepath), result["issues"]))
    else:
        print(f"Error: {path_arg} is not a file or directory")
        sys.exit(2)
    
    # Output
    print(f"Checked: {checked}")
    print(f"Files with issues: {len(issues)}")
    
    if issues:
        print("\nIssues found:")
        for filepath, file_issues in issues:
            print(f"  {filepath}")
            for issue in file_issues:
                print(f"    - {issue}")
        sys.exit(1)
    else:
        print("All files have required metadata. OK")
        sys.exit(0)

if __name__ == "__main__":
    main()
