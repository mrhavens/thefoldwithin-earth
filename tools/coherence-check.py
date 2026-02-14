#!/usr/bin/env python3
"""
Coherence Check Script for The Fold Within Earth

Validates fieldnote frontmatter, checks for broken links,
and verifies metadata completeness. Outputs report as JSON.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


# Configuration
FRONTMATTER_REQUIRED = {
    "title": str,
    "date": str,
    "author": str,
    "type": str,
    "status": str,
}

FRONTMATTER_OPTIONAL = {
    "version": (str, int, float),
    "series": str,
    "layer": str,
    "tags": list,
    "notion_id": str,
    "notion_created": str,
    "source": str,
}

VALID_LAYERS = ["first", "second", "third", "fourth"]
VALID_STATUSES = ["published", "draft", "archived", "review"]


class CoherenceChecker:
    """Main coherence checking class."""
    
    def __init__(self, root_path: str = ".", output_path: str = None):
        self.root_path = Path(root_path)
        self.output_path = output_path or "coherence-report.json"
        self.issues: list[dict] = []
        self.warnings: list[dict] = []
        self.validated_files: list[dict] = []
        self.start_time = datetime.now()
    
    def parse_frontmatter(self, content: str) -> tuple[dict | None, str | None]:
        """Parse YAML frontmatter from markdown content."""
        # Match frontmatter between --- markers
        match = re.match(r'^---\n(.*?)\n---(.*)$', content, re.DOTALL)
        if not match:
            return None, content
        
        try:
            frontmatter = yaml.safe_load(match.group(1))
            content_body = match.group(2)
            return frontmatter, content_body
        except yaml.YAMLError as e:
            return None, content
    
    def check_frontmatter(self, file_path: Path, content: str) -> dict | None:
        """Check frontmatter for a single file."""
        frontmatter, body = self.parse_frontmatter(content)
        
        if frontmatter is None:
            return {
                "file": str(file_path.relative_to(self.root_path)),
                "type": "frontmatter-missing",
                "severity": "critical",
                "message": "No frontmatter found",
                "suggestion": "Add YAML frontmatter between --- markers"
            }
        
        issues = []
        
        # Check required fields
        for field, expected_type in FRONTMATTER_REQUIRED.items():
            if field not in frontmatter:
                issues.append({
                    "field": field,
                    "type": "frontmatter-required-missing",
                    "severity": "critical",
                    "message": f"Required field '{field}' is missing",
                    "suggestion": f"Add {field}: <value> to frontmatter"
                })
            elif not isinstance(frontmatter[field], expected_type):
                issues.append({
                    "field": field,
                    "type": "frontmatter-type-error",
                    "severity": "high",
                    "message": f"Field '{field}' has wrong type",
                    "suggestion": f"Expected {expected_type}, got {type(frontmatter[field]).__name__}"
                })
        
        # Validate specific fields
        if "status" in frontmatter:
            if frontmatter["status"] not in VALID_STATUSES:
                issues.append({
                    "field": "status",
                    "type": "frontmatter-validation-error",
                    "severity": "medium",
                    "message": f"Invalid status: '{frontmatter['status']}'",
                    "suggestion": f"Status must be one of: {', '.join(VALID_STATUSES)}"
                })
        
        if "layer" in frontmatter:
            if frontmatter["layer"] not in VALID_LAYERS:
                issues.append({
                    "field": "layer",
                    "type": "frontmatter-validation-error",
                    "severity": "medium",
                    "message": f"Invalid layer: '{frontmatter['layer']}'",
                    "suggestion": f"Layer must be one of: {', '.join(VALID_LAYERS)}"
                })
        
        # Check tags format
        if "tags" in frontmatter:
            if isinstance(frontmatter["tags"], str):
                issues.append({
                    "field": "tags",
                    "type": "frontmatter-format-error",
                    "severity": "low",
                    "message": "Tags should be a list, not a comma-separated string",
                    "suggestion": "Change tags to a YAML list format"
                })
        
        return {
            "file": str(file_path.relative_to(self.root_path)),
            "has_frontmatter": True,
            "issues": issues,
            "frontmatter": {k: v for k, v in frontmatter.items() if k in FRONTMATTER_REQUIRED}
        } if issues else {
            "file": str(file_path.relative_to(self.root_path)),
            "has_frontmatter": True,
            "issues": [],
            "frontmatter": {k: v for k, v in frontmatter.items() if k in FRONTMATTER_REQUIRED}
        }
    
    def check_links(self, content: str, base_path: Path) -> list[dict]:
        """Check for broken or malformed links."""
        issues = []
        
        # Match markdown links
        link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        matches = re.findall(link_pattern, content)
        
        for link_text, link_url in matches:
            # Skip external URLs
            if link_url.startswith(('http://', 'https://', 'mailto:', '#')):
                continue
            
            # Check internal links
            link_path = link_url.split('#')[0]
            if link_path.startswith('/'):
                # Absolute path
                full_path = self.root_path / link_path.lstrip('/')
            else:
                # Relative path
                full_path = base_path.parent / link_path
            
            if not full_path.exists():
                issues.append({
                    "file": str(base_path.relative_to(self.root_path)),
                    "type": "broken-link",
                    "severity": "high",
                    "link": link_url,
                    "message": f"Broken link: {link_url}",
                    "suggestion": f"Update link to point to existing file or remove"
                })
        
        return issues
    
    def check_metadata_file(self, file_path: Path) -> dict | None:
        """Check metadata.yaml file completeness."""
        if not file_path.exists():
            return {
                "file": str(file_path.relative_to(self.root_path)),
                "type": "metadata-missing",
                "severity": "high",
                "message": "metadata.yaml file not found",
                "suggestion": "Create metadata.yaml with required fields"
            }
        
        try:
            with open(file_path) as f:
                metadata = yaml.safe_load(f)
        except yaml.YAMLError as e:
            return {
                "file": str(file_path.relative_to(self.root_path)),
                "type": "metadata-invalid",
                "severity": "critical",
                "message": f"Invalid YAML: {e}",
                "suggestion": "Fix YAML syntax errors"
            }
        
        if metadata is None:
            return {
                "file": str(file_path.relative_to(self.root_path)),
                "type": "metadata-empty",
                "severity": "high",
                "message": "metadata.yaml is empty",
                "suggestion": "Add required metadata fields"
            }
        
        return None
    
    def scan_content(self) -> dict:
        """Scan all content files for coherence issues."""
        content_path = self.root_path / "content"
        
        if not content_path.exists():
            return {
                "status": "warning",
                "message": "Content directory not found",
                "files_validated": 0,
                "issues": self.issues,
                "warnings": self.warnings
            }
        
        # Find all markdown files
        md_files = list(content_path.rglob("*.md"))
        
        for md_file in md_files:
            try:
                with open(md_file) as f:
                    content = f.read()
                
                # Skip index files
                if md_file.name.lower() in ("index.md", "readme.md"):
                    continue
                
                # Check frontmatter
                result = self.check_frontmatter(md_file, content)
                if result:
                    if result.get("issues"):
                        self.issues.extend(result["issues"])
                    self.validated_files.append(result)
                
                # Check links
                link_issues = self.check_links(content, md_file)
                self.issues.extend(link_issues)
                
                # Check for corresponding metadata.yaml
                metadata_file = md_file.parent / "metadata.yaml"
                if md_file.name.startswith(tuple(str(i) for i in range(10))):  # Date-prefixed files
                    metadata_issue = self.check_metadata_file(metadata_file)
                    if metadata_issue:
                        self.issues.append(metadata_issue)
                        
            except Exception as e:
                self.warnings.append({
                    "file": str(md_file.relative_to(self.root_path)),
                    "message": f"Error processing file: {e}"
                })
        
        return self.generate_report()
    
    def generate_report(self) -> dict:
        """Generate the final coherence report."""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        # Calculate coherence score
        total_files = len(self.validated_files)
        files_with_issues = len(set(
            i["file"] for i in self.issues if "file" in i
        ))
        coherence_score = max(0, 100 - (files_with_issues / max(1, total_files) * 20))
        
        # Group issues by type
        issues_by_type = {}
        for issue in self.issues:
            issue_type = issue.get("type", "unknown")
            if issue_type not in issues_by_type:
                issues_by_type[issue_type] = []
            issues_by_type[issue_type].append(issue)
        
        report = {
            "timestamp": self.start_time.isoformat(),
            "duration_seconds": duration,
            "status": "critical" if any(i.get("severity") == "critical" for i in self.issues) else "warning" if self.issues else "healthy",
            "coherence_score": round(coherence_score, 2),
            "summary": {
                "total_files_validated": total_files,
                "total_issues": len(self.issues),
                "total_warnings": len(self.warnings),
                "critical_issues": len([i for i in self.issues if i.get("severity") == "critical"]),
                "high_issues": len([i for i in self.issues if i.get("severity") == "high"]),
                "medium_issues": len([i for i in self.issues if i.get("severity") == "medium"]),
                "low_issues": len([i for i in self.issues if i.get("severity") == "low"]),
            },
            "issues_by_type": {k: len(v) for k, v in issues_by_type.items()},
            "issues": self.issues,
            "warnings": self.warnings,
            "validated_files": self.validated_files,
            "auto_fixable": [
                i for i in self.issues
                if i.get("type") in ("frontmatter-missing", "frontmatter-required-missing", "metadata-empty")
            ]
        }
        
        return report
    
    def save_report(self, report: dict = None) -> str:
        """Save report to JSON file."""
        if report is None:
            report = self.scan_content()
        
        output_path = Path(self.output_path)
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        
        return str(output_path)
    
    def run(self) -> dict:
        """Run the full coherence check."""
        print(f"🔍 Starting coherence check at {self.start_time.isoformat()}")
        print(f"📁 Root path: {self.root_path}")
        
        report = self.scan_content()
        
        # Print summary
        print(f"\n📊 Coherence Score: {report['coherence_score']}/100")
        print(f"   Files validated: {report['summary']['total_files_validated']}")
        print(f"   Issues found: {report['summary']['total_issues']}")
        if report['summary']['critical_issues']:
            print(f"   🔴 Critical: {report['summary']['critical_issues']}")
        if report['summary']['high_issues']:
            print(f"   🟠 High: {report['summary']['high_issues']}")
        if report['summary']['medium_issues']:
            print(f"   🟡 Medium: {report['summary']['medium_issues']}")
        if report['summary']['low_issues']:
            print(f"   🟢 Low: {report['summary']['low_issues']}")
        
        # Save report
        report_path = self.save_report(report)
        print(f"\n📄 Report saved to: {report_path}")
        
        return report


def main():
    parser = argparse.ArgumentParser(description="Coherence Check for The Fold Within Earth")
    parser.add_argument("--root", "-r", default=".", help="Root path to scan (default: current directory)")
    parser.add_argument("--output", "-o", default="coherence-report.json", help="Output file path")
    parser.add_argument("--check-only", action="store_true", help="Only check, don't save report")
    
    args = parser.parse_args()
    
    checker = CoherenceChecker(args.root, args.output)
    report = checker.run()
    
    # Exit with error code if critical issues found
    if report["status"] == "critical":
        sys.exit(2)
    elif report["status"] == "warning":
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
