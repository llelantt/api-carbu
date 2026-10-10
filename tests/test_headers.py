"""En-têtes de sécurité : CSP (tuiles OSM autorisées, pas de CDN)
et Referrer-Policy exigée par la politique d'usage des tuiles."""
import unittest

from fastapi.testclient import TestClient

from main import app


class SecurityHeaders(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(app)

    def test_csp(self):
        csp = self.c.get("/").headers.get("content-security-policy", "")
        self.assertIn("https://api-adresse.data.gouv.fr", csp)
        self.assertIn("https://router.project-osrm.org", csp)
        self.assertIn("script-src 'self'", csp)
        self.assertIn("style-src 'self'", csp)
        self.assertNotIn("unsafe-inline", csp)

    def test_img_src_exact(self):
        csp = self.c.get("/").headers.get("content-security-policy", "")
        m = [d for d in csp.split(";") if d.strip().startswith("img-src")]
        self.assertEqual(len(m), 1)
        srcs = m[0].replace("img-src", "").split()
        self.assertEqual(sorted(srcs), ["'self'", "https://tile.openstreetmap.org"])
        for bad in ("*", "https:", "http:", "data:"):
            self.assertNotIn(bad, srcs)

    def test_referrer_policy(self):
        rp = self.c.get("/").headers.get("referrer-policy")
        self.assertEqual(rp, "strict-origin-when-cross-origin")

    def test_index_no_cache_et_assets_versionnes(self):
        r = self.c.get("/")
        self.assertEqual(r.headers.get("cache-control"), "no-cache")
        self.assertIn("styles.css?v=", r.text)
        self.assertIn("app.js?v=", r.text)

    def test_no_cdn(self):
        html = self.c.get("/").text
        for bad in ("unpkg.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com"):
            self.assertNotIn(bad, html)

    def test_vendor_served(self):
        r = self.c.get("/static/vendor/leaflet.js")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Leaflet", r.text[:500])
        css = self.c.get("/static/vendor/leaflet.css")
        self.assertEqual(css.status_code, 200)
        img = self.c.get("/static/vendor/images/marker-icon.png")
        self.assertEqual(img.status_code, 200)


if __name__ == "__main__":
    unittest.main()
