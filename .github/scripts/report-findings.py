#!/usr/bin/env python3
"""
Report Findings Script
Parses coherence report and creates GitHub issues for findings.
"""

import json
import os
import sys
from datetime import datetime


def get_severity_emoji(severity):
    """Get emoji for severity level."""
    return {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
    }.get(severity, "⚪")


def get_type_emoji(issue_type):
    """Get emoji for issue type."""
    return {
        "frontmatter-missing": "📝",
        "frontmatter-required-missing": "⚠️",
        "broken-link": "🔗",
        "metadata-missing": "📋",
    }.get(issue_type, "📌")


def format_issue_title(issue):
    """Format issue title for GitHub issue."""
    severity = issue.get("severity", "medium")
    issue_type = issue.get("type", "unknown")
    file = issue.get("file", "unknown")
    
    return f"[{severity.upper()}] {issue_type}: {file}"


def format_issue_body(issue):
    """Format issue body with all details."""
    lines = [
        f"**Issue Type:** {issue.get('type', 'Unknown')}",
        f"**Severity:** {issue.get('severity', 'Unknown')}",
        f"**Location:** `{issue.get('file', 'Unknown')}`",
        "",
        "### Description",
        issue.get("message", "No description provided."),
        "",
    ]
    
    if issue.get("suggestion"):
        lines.extend([
            "### Suggested Fix",
            issue.get("suggestion"),
            "",
        ])
    
    if issue.get("link"):
        lines.extend([
            "### Broken Link",
            f"`{issue.get('link')}`",
            "",
        ])
    
    if issue.get("field"):
        lines.extend([
            "### Affected Field",
            f"`{issue.get('field')}`",
            "",
        ])
    
    lines.extend([
        "---",
        f"*Reported by Coherence Loop at {datetime.now().isoformat()}*",
    ])
    
    return "\n".join(lines)


def group_issues_by_file(issues):
    """Group issues by file path."""
    grouped = {}
    for issue in issues:
        file = issue.get("file", "unknown")
        if file not in grouped:
            grouped[file] = []
        grouped[file].append(issue)
    return grouped


def main():
    report_path = os.environ.get("REPORT_PATH", "coherence-report.json")
    
    if not os.path.exists(report_path):
        print(f"⚠️ Report file not found: {report_path}")
        sys.exit(0)
    
    with open(report_path) as f:
        report = json.load(f)
    
    issues = report.get("issues", [])
    
    if not issues:
        print("✅ No issues found in coherence report")
        sys.exit(0)
    
    print(f"📊 Found {len(issues)} issues to report")
    
    # Group by file for reporting
    grouped = group_issues_by_file(issues)
    
    # Create consolidated issues
    for file_path, file_issues in grouped.items():
        critical_issues = [i for i in file_issues if i.get("severity") == "critical"]
        other_issues = [i for i in file_issues if i.get("severity") != "critical"]
        
        # Skip non-critical issues in individual issues (they'll be in summary)
        if not critical_issues:
            continue
        
        # Print issue summary (actual GitHub issue creation would use gh CLI)
        for issue in critical_issues:
            print(f"\n{get_severity_emoji(issue.get('severity'))} {format_issue_title(issue)}")
            print(f"   {issue.get('message', '')}")
    
    # Summary output for workflow
    summary = report.get("summary", {})
    print(f"\n{'='*50}")
    print("COHERENCE REPORT SUMMARY")
    print(f"{'='*50}")
    print(f"Total files validated: {summary.get('total_files_validated', 0)}")
    print(f"Total issues: {summary.get('total_issues', 0)}")
    print(f"Critical: {summary.get('critical_issues', 0)}")
    print(f"High: {summary.get('high_issues', 0)}")
    print(f"Medium: {summary.get('medium_issues', 0)}")
    print(f"Low: {summary.get('low_issues', 0)}")
    
    # Output for workflow
    with open("coherence-summary.json", "w") as f:
        json.dump({
            "total_issues": summary.get("total_issues", 0),
            "critical_issues": summary.get("critical_issues", 0),
            "high_issues": summary.get("high_issues", 0),
            "issues_by_type": report.get("issues_by_type", {}),
        }, f)


if __name__ == "__main__":
    main()
