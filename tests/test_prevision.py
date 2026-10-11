"""Prévision : 2 relevés espacés d'au moins 24 h minimum, sinon inconnu."""
import json
import tempfile
import unittest
from pathlib import Path

import main

ORIG_HISTO = main.HISTO_FILE


class PrevisionSpan(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()) / "h.json"
        main.HISTO_FILE = self.tmp

    def tearDown(self):
        main.HISTO_FILE = ORIG_HISTO

    def write(self, pts):
        self.tmp.write_text(json.dumps({"75001|e10": pts}))

    def test_moins_de_2_releves(self):
        self.write([{"date": "2026-10-09", "min": 1.8, "moyenne": 1.9}])
        self.assertEqual(main.calc_prevision("75001", "e10")["tendance"], "inconnu")

    def test_meme_jour(self):
        self.write([
            {"date": "2026-10-09", "min": 1.8, "moyenne": 1.9},
            {"date": "2026-10-09", "min": 1.81, "moyenne": 1.9},
        ])
        self.assertEqual(main.calc_prevision("75001", "e10")["tendance"], "inconnu")

    def test_24h_baisse(self):
        self.write([
            {"date": "2026-10-08", "min": 1.85, "moyenne": 1.9},
            {"date": "2026-10-09", "min": 1.80, "moyenne": 1.9},
        ])
        p = main.calc_prevision("75001", "e10")
        self.assertEqual(p["tendance"], "baisse")
        self.assertEqual(p["variation"], -0.05)

    def test_variation_nulle_stable(self):
        self.write([
            {"date": "2026-10-08", "min": 1.8, "moyenne": 1.9},
            {"date": "2026-10-09", "min": 1.8, "moyenne": 1.9},
        ])
        p = main.calc_prevision("75001", "e10")
        self.assertEqual(p["tendance"], "stable")
        self.assertEqual(p["variation"], 0)


if __name__ == "__main__":
    unittest.main()
