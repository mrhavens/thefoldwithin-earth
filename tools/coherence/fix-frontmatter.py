#!/usr/bin/env python3
"""
fix-frontmatter.py - Adds missing frontmatter to markdown files

One thing: Add template frontmatter to files missing it.
"""

import sys
import yaml
from pathlib import Path
from datetime import datetime

FRONTMATTER_TEMPLATE = """---
title: "{title}"
date: {date}
author: ""
type: fieldnote
status: published
version: 1.0
series: ""
layer: ""
tags: []
notion_id: ""
notion_created: ""
source: Notion
---"""

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

def extract_title_from_content(content):
    """Try to extract title from first heading."""
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return "Untitled"

def add_frontmatter(filepath):
    """Add frontmatter to file."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        if has_frontmatter(filepath):
            return False, "Already has frontmatter"
        
        # Extract title from content
        title = extract_title_from_content(content)
        date = datetime.now().strftime("%Y-%m-%d")
        
        # Build frontmatter
        fm = FRONTMATTER_TEMPLATE.format(title=title, date=date)
        
        # Add frontmatter
        new_content = fm + "\n\n" + content
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        
        return True, f"Added frontmatter with title: {title}"
        
    except Exception as e:
        return False, f"Error: {e}"

def main():
    """Add frontmatter to markdown files."""
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    dry_run = "--dry-run" in sys.argv
    
    fixed = 0
    skipped = 0
    errors = 0
    path = Path(path_arg)
    
    files = []
    if path.is_file() and path.suffix == ".md":
        files = [path]
    elif path.is_dir():
        files = list(path.rglob("*.md"))
    else:
        print(f"Error: {path_arg} is not a file or directory")
        sys.exit(2)
    
    for filepath in files:
        if not has_frontmatter(filepath):
            if dry_run:
                print(f"[DRY RUN] Would fix: {filepath}")
                fixed += 1
            else:
                success, msg = add_frontmatter(filepath)
                if success:
                    print(f"Fixed: {filepath} - {msg}")
                    fixed += 1
                else:
                    print(f"Skipped: {filepath} - {msg}")
                    skipped += 1
        else:
            skipped += 1
    
    print(f"\nFixed: {fixed}")
    print(f"Skipped: {skipped}")
    print(f"Errors: {errors}")
    
    if dry_run:
        print("\n(Dry run - no changes made)")
    
    sys.exit(0 if fixed > 0 else 0)

if __name__ == "__main__":
    main()
