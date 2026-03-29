#!/usr/bin/env python3
"""
Helper script to migrate data from a local MySQL database to the Aiven MySQL instance.

Usage (recommended):
  1. From the `backend/` folder, run with a local SQLAlchemy URL and a remote (Aiven) URL:
     python scripts/migrate_to_aiven.py \
       --local-url "mysql+pymysql://root:localpass@127.0.0.1:3306/asd_platform" \
       --remote-url "mysql+pymysql://avnadmin:AVNS_...@host:20935/defaultdb?ssl=true"

  2. The script will:
     - create a data-only dump of the local database (no CREATE TABLE statements)
     - run Alembic migrations against the remote database to create the schema
     - import the data dump into the remote database using the `mysql` client

Notes:
  - This script requires `mysqldump` and `mysql` command-line tools to be installed and on PATH.
  - It uses `MYSQL_PWD` environment variable to pass passwords to the CLI tools (temporary, local process only).
  - Keep backups before running on production data. Test on a staging DB first.
"""

import argparse
import os
import shlex
import shutil
import subprocess
import sys
from urllib.parse import urlparse, unquote
from pathlib import Path


def parse_sqlalchemy_url(url: str):
    # Accept urls like mysql+pymysql://user:pass@host:port/dbname?ssl=true
    p = urlparse(url)
    if not p.scheme.startswith('mysql'):
        raise ValueError('Only MySQL URLs are supported.')
    user = unquote(p.username) if p.username else ''
    password = unquote(p.password) if p.password else ''
    host = p.hostname or '127.0.0.1'
    port = p.port or 3306
    db = p.path.lstrip('/')
    query = p.query
    return dict(user=user, password=password, host=host, port=port, db=db, query=query)


def check_cli_available(cmd_name: str):
    return shutil.which(cmd_name) is not None


def run(cmd, **kwargs):
    print('> ' + ' '.join(shlex.quote(str(c)) for c in cmd))
    subprocess.run(cmd, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local-url', help='Local SQLAlchemy URL (mysql+pymysql://user:pass@host:port/db)')
    parser.add_argument('--remote-url', help='Remote (Aiven) SQLAlchemy URL')
    parser.add_argument('--dump-file', default='data_dump.sql', help='Temporary data dump file')
    args = parser.parse_args()

    if not args.local_url:
        args.local_url = input('Local DB SQLAlchemy URL: ').strip()
    if not args.remote_url:
        args.remote_url = input('Remote (Aiven) DB SQLAlchemy URL: ').strip()

    local = parse_sqlalchemy_url(args.local_url)
    remote = parse_sqlalchemy_url(args.remote_url)

    if not check_cli_available('mysqldump'):
        print('Error: mysqldump not found on PATH. Install MySQL client tools and retry.')
        sys.exit(1)
    if not check_cli_available('mysql'):
        print('Error: mysql client not found on PATH. Install MySQL client tools and retry.')
        sys.exit(1)

    dump_path = Path(args.dump_file).resolve()
    print(f'Local DB: {local["user"]}@{local["host"]}:{local["port"]}/{local["db"]}')
    print(f'Remote DB: {remote["user"]}@{remote["host"]}:{remote["port"]}/{remote["db"]}')
    print(f'Data dump will be written to: {dump_path}')

    # Step 1: Dump data only (no CREATE TABLE)
    print('\n==> Creating data-only dump from local DB')
    dump_cmd = [
        'mysqldump',
        '--no-create-info',
        '--skip-triggers',
        '--single-transaction',
        '-h', local['host'],
        '-P', str(local['port']),
        '-u', local['user'],
        local['db'],
    ]

    env = os.environ.copy()
    if local['password']:
        env['MYSQL_PWD'] = local['password']

    with open(dump_path, 'wb') as f:
        subprocess.run(dump_cmd, stdout=f, check=True, env=env)

    print('Dump created.')

    # Step 2: Run Alembic migrations on remote DB (creates schema)
    print('\n==> Applying Alembic migrations to remote DB')
    alembic_env = os.environ.copy()
    # ensure the subprocess sees the remote DB URL
    alembic_env['DATABASE_URL'] = args.remote_url
    # use current python interpreter (assumes venv activated if needed)
    try:
        run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], env=alembic_env)
    except subprocess.CalledProcessError:
        print('Alembic migration failed. Aborting.')
        sys.exit(1)

    # Step 3: Import data into remote DB
    print('\n==> Importing data into remote DB')
    import_cmd = [
        'mysql',
        '--ssl-mode=REQUIRED',
        '-h', remote['host'],
        '-P', str(remote['port']),
        '-u', remote['user'],
        remote['db'],
    ]

    remote_env = os.environ.copy()
    if remote['password']:
        remote_env['MYSQL_PWD'] = remote['password']

    with open(dump_path, 'rb') as f:
        subprocess.run(import_cmd, stdin=f, check=True, env=remote_env)

    print('\nData import complete.')
    print('You may delete the dump file if not needed:', dump_path)


if __name__ == '__main__':
    main()
