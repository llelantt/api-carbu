"""Intégration : communes voisines dans le rayon, tri, limite et plafond.
L'API d'État et le géocodeur sont simulés (aucun réseau)."""
import re
import unittest
from math import asin, cos, radians, sin, sqrt

import main
from fastapi.testclient import TestClient


def hav(lat1, lon1, lat2, lon2):
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(a))


def station(i, cp, lat, lon, prix):
    return {
        "id": i, "adresse": f"Rue {i}", "ville": f"Ville{i}", "cp": cp,
        "pop": "R", "horaires": None, "horaires_automate_24_24": "Non",
        "services_service": [], "geom": {"lat": lat, "lon": lon},
        "gazole_prix": prix, "gazole_maj": "2026-10-09T00:00:00+00:00",
    }


STATIONS = [
    station(1, "77000", 48.94, 2.61, 1.90),   # commune cherchée
    station(2, "77100", 48.98, 2.65, 1.80),   # ~5 km
    station(3, "77200", 49.40, 3.20, 2.00),   # ~65 km : hors rayon 50
    station(4, "77300", 48.60, 2.30, 1.85),   # ~44 km
]


class FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeClient:
    last_params = None

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, params=None):
        FakeClient.last_params = params
        if "api-adresse" in url:
            if (params or {}).get("q") == "77000":
                return FakeResp({"features": [{
                    "geometry": {"coordinates": [2.61, 48.94]},
                    "properties": {"label": "Ville"},
                }]})
            return FakeResp({"features": []})
        out = list(STATIONS)
        m = re.search(r"POINT\(([-\d.]+) ([-\d.]+)\)', ([\d.]+)km", (params or {}).get("where", ""))
        if m:
            lon, lat, km = float(m.group(1)), float(m.group(2)), float(m.group(3))
            out = [s for s in out
                   if hav(lat, lon, s["geom"]["lat"], s["geom"]["lon"]) <= km]
        return FakeResp({"results": out[:int((params or {}).get("limit", 100))]})


class Integration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(main.app)

    def setUp(self):
        import httpx
        self._orig_client = httpx.AsyncClient
        httpx.AsyncClient = FakeClient
        self._orig_histo = main.HISTO_FILE
        main.HISTO_FILE = main.Path("/tmp/test-histo.json")
        try:
            main.Path("/tmp/test-histo.json").unlink()
        except OSError:
            pass

    def tearDown(self):
        import httpx
        httpx.AsyncClient = self._orig_client
        main.HISTO_FILE = self._orig_histo

    def test_rayon_50_voisines_triees(self):
        r = self.c.get("/stations", params={"cp": "77000", "carburant": "gazole", "dist": 50})
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["nombre"], 3)
        self.assertEqual([s["prix"] for s in d["stations"]], [1.80, 1.85, 1.90])
        self.assertEqual(len({s["cp"] for s in d["stations"]}), 3)

    def test_limite_resultats(self):
        global STATIONS
        saved = STATIONS
        try:
            STATIONS = [station(100 + i, "77000", 48.94 + (i % 12) * 0.002, 2.61 + (i // 12) * 0.002, 1.5 + i * 0.001)
                        for i in range(120)]
            r = self.c.get("/stations", params={"cp": "77000", "carburant": "gazole", "dist": 50})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["nombre"], 100)
            self.assertEqual(FakeClient.last_params["limit"], 100)
        finally:
            STATIONS = saved

    def test_plafond_rayon(self):
        for bad in ("500", "0", "-5", "abc"):
            r = self.c.get("/stations", params={"cp": "77000", "carburant": "gazole", "dist": bad})
            self.assertEqual(r.status_code, 422, bad)


if __name__ == "__main__":
    unittest.main()
