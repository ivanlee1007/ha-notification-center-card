"""Synchronize shipped files after editing root JS: python tools/sync_artifacts.py."""
import gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
primary = ROOT / 'ha-notification-center-card.js'
(ROOT / 'dist' / primary.name).write_bytes(primary.read_bytes())
for source in (primary, ROOT / 'dist' / primary.name, ROOT / 'notification-chip-card.js'):
    source.with_suffix('.js.gz').write_bytes(gzip.compress(source.read_bytes(), mtime=0))
    print('Synchronized', source.relative_to(ROOT))
