#!/usr/bin/env python3
"""
Generate a secure JWT secret for VARDAx.
Run this script to generate a cryptographically secure JWT secret.
"""
import secrets

def generate_jwt_secret():
    """Generate a secure JWT secret."""
    secret = secrets.token_urlsafe(32)
    print("Generated secure JWT secret:")
    print(f"VARDAX_JWT_SECRET={secret}")
    print()
    print("Add this to your .env file or environment variables.")
    print("Keep this secret secure and never commit it to version control!")
    return secret

if __name__ == "__main__":
    generate_jwt_secret()