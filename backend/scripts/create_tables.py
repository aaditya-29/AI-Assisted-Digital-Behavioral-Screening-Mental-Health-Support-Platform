import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import create_tables

create_tables()
print('✓ Created tables via metadata.create_all()')
