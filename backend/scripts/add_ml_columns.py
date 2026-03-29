"""
Add ML columns to screening_sessions table.
Run: venv/bin/python3 scripts/add_ml_columns.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pymysql

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='', database='asd_platform')
cursor = conn.cursor()

cursor.execute('DESCRIBE screening_sessions')
cols = {row[0] for row in cursor.fetchall()}
print('Existing columns:', sorted(cols))

if 'ml_prediction' not in cols:
    cursor.execute('ALTER TABLE screening_sessions ADD COLUMN ml_prediction INT NULL')
    print('✓ Added ml_prediction')
else:
    print('  ml_prediction already exists')

if 'ml_probability_label' not in cols:
    cursor.execute('ALTER TABLE screening_sessions ADD COLUMN ml_probability_label VARCHAR(20) NULL')
    print('✓ Added ml_probability_label')
else:
    print('  ml_probability_label already exists')

if 'question_scores' not in cols:
    cursor.execute('ALTER TABLE screening_sessions ADD COLUMN question_scores JSON NULL')
    print('✓ Added question_scores')
else:
    print('  question_scores already exists')

conn.commit()
conn.close()
print('Done!')
