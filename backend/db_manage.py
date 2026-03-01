#!/usr/bin/env python
"""
Database setup and management script.
Run this script to initialize the database and run migrations.
"""
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings


def create_database():
    """Create the MySQL database if it doesn't exist."""
    import pymysql
    
    # Parse database URL to get credentials
    # Format: mysql+pymysql://user:password@host:port/dbname
    url = settings.DATABASE_URL
    parts = url.replace("mysql+pymysql://", "").split("@")
    user_pass = parts[0].split(":")
    host_db = parts[1].split("/")
    host_port = host_db[0].split(":")
    
    user = user_pass[0]
    password = user_pass[1] if len(user_pass) > 1 else ""
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else 3306
    db_name = host_db[1].split("?")[0]
    
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.close()
        print(f"✓ Database '{db_name}' ready")
        return True
    except Exception as e:
        print(f"✗ Error creating database: {e}")
        return False


def run_migrations():
    """Run Alembic migrations."""
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("✓ Migrations completed successfully")
            print(result.stdout)
            return True
        else:
            print(f"✗ Migration error: {result.stderr}")
            return False
    except Exception as e:
        print(f"✗ Error running migrations: {e}")
        return False


def check_migration_status():
    """Check current migration status."""
    try:
        result = subprocess.run(
            ["alembic", "current"],
            capture_output=True,
            text=True
        )
        print("Current migration status:")
        print(result.stdout or "No migrations applied yet")
        return True
    except Exception as e:
        print(f"Error checking status: {e}")
        return False


def generate_migration(message: str):
    """Generate a new migration."""
    try:
        result = subprocess.run(
            ["alembic", "revision", "--autogenerate", "-m", message],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"✓ Migration generated: {message}")
            print(result.stdout)
            return True
        else:
            print(f"✗ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error generating migration: {e}")
        return False


def rollback(steps: int = 1):
    """Rollback migrations."""
    try:
        result = subprocess.run(
            ["alembic", "downgrade", f"-{steps}"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"✓ Rolled back {steps} migration(s)")
            return True
        else:
            print(f"✗ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error rolling back: {e}")
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database management script")
    parser.add_argument("command", choices=["init", "migrate", "status", "generate", "rollback"],
                       help="Command to run")
    parser.add_argument("--message", "-m", help="Migration message (for generate)")
    parser.add_argument("--steps", "-s", type=int, default=1, help="Steps to rollback")
    
    args = parser.parse_args()
    
    if args.command == "init":
        print("Initializing database...")
        if create_database():
            run_migrations()
    elif args.command == "migrate":
        run_migrations()
    elif args.command == "status":
        check_migration_status()
    elif args.command == "generate":
        if args.message:
            generate_migration(args.message)
        else:
            print("Please provide a migration message with --message")
    elif args.command == "rollback":
        rollback(args.steps)
