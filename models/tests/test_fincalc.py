"""Unit tests for fincalc. All numbers are SYNTHETIC TEST VALUES, not project data."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fincalc as f  # noqa: E402


class TestFincalc(unittest.TestCase):
    def test_npv(self):
        self.assertAlmostEqual(f.npv(0.10, [-100, 110]), 0.0, places=9)
        self.assertAlmostEqual(f.npv(0.0, [-100, 50, 60]), 10.0)

    def test_irr(self):
        self.assertAlmostEqual(f.irr([-100, 110]), 0.10, places=7)
        self.assertAlmostEqual(f.irr([-1000, 300, 400, 500]), 0.0889633947, places=6)
        self.assertIsNone(f.irr([100, 200]))

    def test_moic_payback(self):
        self.assertAlmostEqual(f.moic([-100, 50, 100]), 1.5)
        self.assertAlmostEqual(f.payback([-100, 40, 40, 40]), 2.5)
        self.assertIsNone(f.payback([-100, 10, 10]))

    def test_dscr_wacc(self):
        self.assertEqual(f.dscr_series([130, 0], [100, 0]), [1.3, None])
        self.assertAlmostEqual(f.wacc(60, 40, 0.15, 0.07, 0.20), 0.1124)

    def test_withheld(self):
        res = f.analyse([{"period": "0", "unlevered_cf": "-100"}, {"period": "1", "unlevered_cf": "121"}], 0.1, None)
        self.assertAlmostEqual(res["project_irr"], 0.21, places=7)
        self.assertTrue(str(res["equity_irr"]).startswith("WITHHELD"))


if __name__ == "__main__":
    unittest.main()
