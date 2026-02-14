#!/usr/bin/env python3
"""
run-coherence.py - Run all coherence checks

One thing: Run all checks and output unified report.
"""

import subprocess
import sys
from datetime import datetime
import json

TOOLS = [
    ("check-frontmatter", "Checking for frontmatter..."),
    ("check-metadata", "Checking metadata quality..."),
    ("check-links", "Checking for broken links..."),
]

def run_check(tool_name):
    """Run a coherence check tool."""
    try:
        result = subprocess.run(
            ["python3", f"tools/coherence/{tool_name}.py", "public/fieldnotes/"],
            capture_output=True,
            text=True,
            timeout=30
        )
        return {
            "tool": tool_name,
            "passed": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr
        }
    except Exception as e:
        return {
            "tool": tool_name,
            "passed": False,
            "output": "",
            "error": str(e)
        }

def main():
    """Run all coherence checks."""
    print("=" * 50)
    print("COHERENCE CHECK")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 50)
    print()
    
    results = []
    all_passed = True
    
    for tool_name, description in TOOLS:
        print(f"Running: {description}")
        result = run_check(tool_name)
        results.append(result)
        
        if result["passed"]:
            print(f"  OK")
        else:
            print(f"  ISSUES FOUND")
            all_passed = False
        print()
    
    # Summary
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    
    print(f"Checks passed: {passed}/{total}")
    print(f"Status: {'ALL OK' if all_passed else 'ISSUES FOUND'}")
    print()
    
    if not all_passed:
        print("Details:")
        for r in results:
            if not r["passed"]:
                print(f"  {r['tool']}:")
                if r["output"]:
                    for line in r["output"].split("\n")[:5]:
                        print(f"    {line}")
        sys.exit(1)
    else:
        print("All coherence checks passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
