import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
import pymysql

# Parse database url like db_manage.create_database
url = settings.DATABASE_URL
s = url.replace("mysql+pymysql://", "")
try:
    user_pass, host_db = s.split("@")
except ValueError:
    print('Could not parse DATABASE_URL:', url)
    sys.exit(1)

user_pass = user_pass.split(":")
user = user_pass[0]
password = user_pass[1] if len(user_pass) > 1 else ""
host_db = host_db.split("/")
host_port = host_db[0].split(":")
host = host_port[0]
port = int(host_port[1]) if len(host_port) > 1 else 3306
db_name = host_db[1].split("?")[0]

print('Dropping database', db_name, 'on', host, port, 'as', user)
try:
    conn = pymysql.connect(host=host, port=port, user=user, password=password)
    cur = conn.cursor()
    cur.execute(f"DROP DATABASE IF EXISTS {db_name}")
    cur.execute(f"CREATE DATABASE {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    conn.commit()
    conn.close()
    print('✓ Dropped and recreated database', db_name)
except Exception as e:
    print('✗ Failed to drop/create database:', e)
    sys.exit(2)
