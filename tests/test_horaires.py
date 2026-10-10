"""Ouverture calculée en Europe/Paris, horloge injectée (aucun réseau)."""
import json
import os
import time
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from main import calc_affluence, ouvert_actuellement

PARIS = ZoneInfo("Europe/Paris")


def horaires(slots_by_day, fermes=()):
    jours = []
    for i in range(1, 8):
        j = {"@id": str(i), "@nom": "J"}
        if i in fermes:
            j["@ferme"] = "1"
        elif i in slots_by_day:
            ss = slots_by_day[i]
            j["horaire"] = ss if isinstance(ss, list) else [ss]
        jours.append(j)
    return json.dumps({"jour": jours})


def slot(o, f):
    return {"@ouverture": o, "@fermeture": f}


SEMAINE = horaires({i: slot("06.00", "19.00") for i in range(1, 8)})


def paris(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=PARIS)


class Ouverture(unittest.TestCase):
    def test_automate(self):
        self.assertTrue(ouvert_actuellement(None, "Oui", paris(2026, 10, 11, 3)))
        self.assertTrue(ouvert_actuellement(None, "1", paris(2026, 10, 11, 3)))

    def test_creneau(self):
        self.assertTrue(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 8)))    # lundi 8h
        self.assertTrue(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 6)))     # ouverture incluse
        self.assertFalse(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 19)))   # fermeture exclue
        self.assertFalse(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 23)))

    def test_absents_inconnu(self):
        for h in (None, "", "nawak", '{"jour": []}', '{"autre": 1}'):
            self.assertIsNone(ouvert_actuellement(h, "Non", paris(2026, 10, 5, 12)))

    def test_jour_sans_horaires_ferme(self):
        h = horaires({1: slot("06.00", "19.00")})  # seul lundi renseigné
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 6, 12)))  # mardi
        self.assertTrue(ouvert_actuellement(h, "Non", paris(2026, 10, 5, 12)))   # lundi

    def test_ferme_explicite(self):
        h = horaires({i: slot("06.00", "19.00") for i in range(1, 7)}, fermes=(7,))
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 4, 10)))  # dimanche

    def test_nuit(self):
        h = horaires({5: slot("18.00", "02.00"), 6: slot("18.00", "02.00")})
        self.assertTrue(ouvert_actuellement(h, "Non", paris(2026, 10, 9, 23)))   # ven 23h
        self.assertTrue(ouvert_actuellement(h, "Non", paris(2026, 10, 10, 1)))   # sam 1h (veille)
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 10, 3)))
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 10, 10)))

    def test_nuit_veille_fermee(self):
        h = horaires({6: slot("18.00", "02.00")}, fermes=(5,))
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 10, 1)))  # sam 1h, ven fermé

    def test_multiples_plages(self):
        h = horaires({1: [slot("08.00", "12.00"), slot("14.00", "18.00")]})
        self.assertTrue(ouvert_actuellement(h, "Non", paris(2026, 10, 5, 9)))
        self.assertFalse(ouvert_actuellement(h, "Non", paris(2026, 10, 5, 13)))
        self.assertTrue(ouvert_actuellement(h, "Non", paris(2026, 10, 5, 15)))

    def test_fuseau_serveur_ignore(self):
        old = os.environ.get("TZ")
        os.environ["TZ"] = "Pacific/Kiritimati"
        try:
            time.tzset()
            self.assertTrue(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 8)))
            self.assertFalse(ouvert_actuellement(SEMAINE, "Non", paris(2026, 10, 5, 23)))
        finally:
            if old is None:
                del os.environ["TZ"]
            else:
                os.environ["TZ"] = old
            time.tzset()

    def test_instant_utc_converti(self):
        from datetime import timezone
        # lundi 06:00 UTC = 08:00 à Paris (octobre, +2) -> ouvert
        self.assertTrue(ouvert_actuellement(SEMAINE, "Non", datetime(2026, 10, 5, 6, tzinfo=timezone.utc)))

    def test_affluence_deterministe(self):
        self.assertEqual(calc_affluence(True, "R", 2, paris(2026, 10, 5, 8))["niveau"], "dense")
        self.assertEqual(calc_affluence(True, "R", 2, paris(2026, 10, 5, 3))["niveau"], "fluide")
        self.assertEqual(calc_affluence(False, "R", 2, paris(2026, 10, 5, 8))["niveau"], "fermé")


if __name__ == "__main__":
    unittest.main()
