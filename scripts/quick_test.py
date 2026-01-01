#!/usr/bin/env python3
"""
VARDAx Quick Test Runner
Runs all Python tests and reports results.
"""
import subprocess
import sys
import os

# Colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
CYAN = '\033[96m'
NC = '\033[0m'

def run_test_suite(name, path):
    """Run a pytest suite and return success status."""
    print(f"\n{BLUE}{'='*60}{NC}")
    print(f"{BLUE}Running: {name}{NC}")
    print(f"{BLUE}{'='*60}{NC}")
    
    result = subprocess.run(
        [sys.executable, '-m', 'pytest', path, '-v', '--tb=short'],
        capture_output=False
    )
    
    return result.returncode == 0

def main():
    print(f"{CYAN}")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║           VARDAx Quick Test Suite                            ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(f"{NC}")
    
    # Change to project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(project_root)
    
    results = {}
    
    # Test suites
    suites = [
        ("ML Models", "backend/tests/test_ml_models.py"),
        ("Feature Extractor", "backend/tests/test_feature_extractor.py"),
        ("Fortress Rate Limiter", "fortress/tests/test_rate_limiter.py"),
        ("Fortress Tarpit", "fortress/tests/test_tarpit.py"),
    ]
    
    for name, path in suites:
        if os.path.exists(path):
            results[name] = run_test_suite(name, path)
        else:
            print(f"{YELLOW}⚠ Skipping {name} - file not found{NC}")
            results[name] = None
    
    # Summary
    print(f"\n{CYAN}{'='*60}{NC}")
    print(f"{CYAN}TEST SUMMARY{NC}")
    print(f"{CYAN}{'='*60}{NC}\n")
    
    passed = 0
    failed = 0
    skipped = 0
    
    for name, result in results.items():
        if result is True:
            print(f"{GREEN}✓ {name}: PASSED{NC}")
            passed += 1
        elif result is False:
            print(f"{RED}✗ {name}: FAILED{NC}")
            failed += 1
        else:
            print(f"{YELLOW}⚠ {name}: SKIPPED{NC}")
            skipped += 1
    
    print(f"\n{CYAN}Total: {passed} passed, {failed} failed, {skipped} skipped{NC}")
    
    if failed == 0:
        print(f"\n{GREEN}✓ All tests passed!{NC}\n")
        return 0
    else:
        print(f"\n{RED}✗ Some tests failed!{NC}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
