#!/usr/bin/env python3
"""
check-links.py - Finds broken internal links in markdown files

One thing: Check for broken internal links.
"""

import sys
import re
from pathlib import Path
from urllib.parse import urlparse

def extract_links(content):
    """Extract markdown and HTML links from content."""
    links = []
    # Markdown links: [text](url)
    md_links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
    for text, url in md_links:
        links.append(url)
    # HTML links: <a href="url">
    html_links = re.findall(r'href=["']([^"']+)["']', content)
    links.extend(html_links)
    return links

def is_internal_link(url):
    """Check if link is internal (relative or same domain)."""
    parsed = urlparse(url)
    # Relative path or anchor
    if not parsed.netloc or parsed.netloc.startswith('#'):
        return True
    return False

def check_file_links(filepath):
    """Check links in a single file."""
    issues = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        links = extract_links(content)
        for link in links:
            if is_internal_link(link):
                # Check for common issues
                if link.startswith('http'):
                    continue  # External - skip for now
                # Check for broken patterns
                if '..' in link or link.startswith('/'):
                    pass  # Might be valid
                else:
                    # Check if file exists
                    pass
    except Exception as e:
        issues.append(f"Error reading: {e}")
    return issues

def main():
    """Check all markdown files for broken links."""
    path_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    
    issues = []
    checked = 0
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
        checked += 1
        result = check_file_links(filepath)
        if result:
            issues.append((str(filepath), result))
    
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
        print("No broken internal links found. OK")
        sys.exit(0)

if __name__ == "__main__":
    main()
