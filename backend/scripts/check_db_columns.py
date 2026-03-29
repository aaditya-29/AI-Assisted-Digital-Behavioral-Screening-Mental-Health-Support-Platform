"""Check and add ml_risk_score column if missing."""
import pymysql
import os
import re
import sys

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

db_url = env.get('DATABASE_URL', '')
m = re.match(r'mysql\+pymysql://([^:@]*)(?::([^@]*))?@([^:/]+)(?::(\d+))?/(.+)', db_url)
if not m:
    print('Cannot parse DB URL:', db_url)
    sys.exit(1)
user, pw, host, port, dbname = m.groups()
port = int(port or 3306)

conn = pymysql.connect(host=host, user=user, password=pw or '', database=dbname, port=port)
cur = conn.cursor()
cur.execute('DESCRIBE screening_sessions')
cols = {row[0] for row in cur.fetchall()}
print('DB columns:', sorted(cols))

needed = ['ml_risk_score', 'ml_prediction', 'ml_probability_label', 'question_scores']
for col in needed:
    if col in cols:
        print(f'  ✓  {col}')
    else:
        print(f'  ✗ MISSING — adding {col}')
        if col == 'ml_risk_score':
            cur.execute('ALTER TABLE screening_sessions ADD COLUMN ml_risk_score FLOAT NULL')
        elif col == 'ml_prediction':
            cur.execute('ALTER TABLE screening_sessions ADD COLUMN ml_prediction INT NULL')
        elif col == 'ml_probability_label':
            cur.execute('ALTER TABLE screening_sessions ADD COLUMN ml_probability_label VARCHAR(20) NULL')
        elif col == 'question_scores':
            cur.execute('ALTER TABLE screening_sessions ADD COLUMN question_scores JSON NULL')
        conn.commit()
        print(f'    ✓ Added {col}')

conn.close()
print('Done.')
