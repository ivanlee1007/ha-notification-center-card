import gzip
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ArtifactTests(unittest.TestCase):
    def test_root_dist_and_gzip_match(self):
        primary = ROOT / 'ha-notification-center-card.js'
        dist = ROOT / 'dist' / primary.name
        self.assertEqual(primary.read_bytes(), dist.read_bytes())
        for source in (primary, dist, ROOT / 'notification-chip-card.js'):
            with self.subTest(source=source.name):
                self.assertEqual(gzip.decompress(source.with_suffix('.js.gz').read_bytes()), source.read_bytes())

    def test_shared_disclosure_helpers_match(self):
        def helpers(name):
            text = (ROOT / name).read_text(encoding='utf-8')
            return text[text.index('function notificationCardEscapeText'):text.index('\nclass ', text.index('function notificationCardEscapeText'))]
        self.assertEqual(helpers('ha-notification-center-card.js'), helpers('notification-chip-card.js'))
