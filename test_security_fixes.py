#!/usr/bin/env python3
"""
Quick test script to verify security fixes are working.
"""
import os
import sys
import tempfile
import json
from pathlib import Path

def test_jwt_secret_validation():
    """Test that JWT secret validation works."""
    print("Testing JWT secret validation...")
    
    # Add backend to path
    sys.path.insert(0, str(Path(__file__).parent / "backend"))
    
    try:
        # This should fail without JWT secret
        os.environ.pop("VARDAX_JWT_SECRET", None)
        from backend.app.config import Settings
        
        try:
            settings = Settings()
            print("❌ FAIL: JWT secret validation not working - no exception raised")
            return False
        except ValueError as e:
            if "VARDAX_JWT_SECRET" in str(e):
                print("✅ PASS: JWT secret validation working")
                return True
            else:
                print(f"❌ FAIL: Wrong error message: {e}")
                return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_ip_validation():
    """Test that IP validation works in TrafficRequest."""
    print("Testing IP address validation...")
    
    sys.path.insert(0, str(Path(__file__).parent / "backend"))
    
    try:
        from backend.app.models.schemas import TrafficRequest
        from pydantic import ValidationError
        
        # Test valid IP
        try:
            valid_request = TrafficRequest(
                request_id="test-123",
                client_ip="192.168.1.1",
                client_port=8080,
                method="GET",
                uri="/test"
            )
            print("✅ PASS: Valid IP accepted")
        except Exception as e:
            print(f"❌ FAIL: Valid IP rejected: {e}")
            return False
        
        # Test invalid IP
        try:
            invalid_request = TrafficRequest(
                request_id="test-456",
                client_ip="invalid-ip",
                client_port=8080,
                method="GET",
                uri="/test"
            )
            print("❌ FAIL: Invalid IP accepted")
            return False
        except ValidationError as e:
            if "Invalid IP address" in str(e):
                print("✅ PASS: Invalid IP rejected")
                return True
            else:
                print(f"❌ FAIL: Wrong validation error: {e}")
                return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_json_parsing_safety():
    """Test that eval() has been replaced with json.loads()."""
    print("Testing safe JSON parsing...")
    
    # Check that eval is not used in critical files
    critical_files = [
        "sentinelas/ml-service/app/main.py",
        "backend/app/database.py"
    ]
    
    for file_path in critical_files:
        if Path(file_path).exists():
            content = Path(file_path).read_text()
            if "eval(" in content and "json.loads" not in content:
                print(f"❌ FAIL: {file_path} still uses eval() without json.loads")
                return False
    
    print("✅ PASS: No unsafe eval() usage found")
    return True

def test_bare_except_removal():
    """Test that bare except clauses have been fixed."""
    print("Testing bare except clause removal...")
    
    files_to_check = [
        "backend/app/database.py",
        "sentinelas/ml-service/app/main.py",
        "sentinelas/ml-service/app/grpc_server.py"
    ]
    
    for file_path in files_to_check:
        if Path(file_path).exists():
            content = Path(file_path).read_text()
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.strip() == "except:" and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line == "pass":
                        print(f"❌ FAIL: Bare except: pass found in {file_path} at line {i + 1}")
                        return False
    
    print("✅ PASS: No bare except: pass patterns found")
    return True

def main():
    """Run all security tests."""
    print("🔒 Running VARDAx Security Fix Verification Tests")
    print("=" * 50)
    
    tests = [
        test_jwt_secret_validation,
        test_ip_validation,
        test_json_parsing_safety,
        test_bare_except_removal
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ ERROR in {test.__name__}: {e}")
        print()
    
    print("=" * 50)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All security fixes verified successfully!")
        return 0
    else:
        print("⚠️  Some security fixes need attention")
        return 1

if __name__ == "__main__":
    sys.exit(main())