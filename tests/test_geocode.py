"""Recherche par code postal via géocodage : jamais de filtre postal exact,
les stations voisines sont renvoyées (nécessite le réseau)."""
import unittest

from fastapi.testclient import TestClient

from main import app


class Geocode(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(app)

    def test_proxy_ok(self):
        r = self.c.get("/v1/geocode", params={"cp": "77270"})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("lat", body)
        self.assertIn("lon", body)

    def test_proxy_invalide(self):
        r = self.c.get("/v1/geocode", params={"cp": "000"})
        self.assertEqual(r.status_code, 400)

    def test_proxy_introuvable(self):
        r = self.c.get("/v1/geocode", params={"cp": "00000"})
        self.assertEqual(r.status_code, 404)
        self.assertIn("introuvable", r.json()["detail"].lower())

    def test_voisines(self):
        # 77270 = 1 seule station dans la commune : le rayon doit ramener les voisines
        r = self.c.get("/stations", params={"cp": "77270", "carburant": "gazole"})
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertGreater(d["nombre"], 1)
        self.assertGreater(len({s["cp"] for s in d["stations"]}), 1)


if __name__ == "__main__":
    unittest.main()
