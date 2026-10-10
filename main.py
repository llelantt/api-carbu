from datetime import date, datetime, time, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="API Carburants")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; "
       "img-src 'self' https://tile.openstreetmap.org; "
       "connect-src 'self' https://api-adresse.data.gouv.fr")


@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["Content-Security-Policy"] = CSP
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp

DATA_URL = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records"
CARBURANTS = {"gazole", "sp95", "e10", "sp98", "e85", "gplc"}
HISTO_FILE = Path(__file__).parent / "historique.json"
SEUIL_FRAICHEUR = 7  # jours : au-delà, le prix est signalé comme périmé


def check_params(cp, carburant, lat=None, lon=None):
    if carburant is None or carburant.lower() not in CARBURANTS:
        return JSONResponse(
            {"detail": f"Carburant inconnu. Choix : {', '.join(sorted(CARBURANTS))}."},
            status_code=400,
        )
    if cp and cp.isdigit() and len(cp) == 5:
        return None
    if lat is not None and lon is not None:
        return None
    return JSONResponse(
        {"detail": "Indique un code postal (5 chiffres) ou une position (lat, lon)."},
        status_code=400,
    )


def zone_key(cp, carburant, lat=None, lon=None):
    if cp:
        return f"{cp}|{carburant.lower()}"
    return f"{round(lat, 2)},{round(lon, 2)}|{carburant.lower()}"


def haversine(lat1, lon1, lat2, lon2):
    try:
        from math import asin, cos, radians, sin, sqrt
        dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
        a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
        return round(2 * 6371.0 * asin(sqrt(a)), 1)
    except TypeError:
        return None


async def fetch_stations(cp, carburant, lat=None, lon=None, dist=None):
    carb = carburant.lower()
    prix_col, maj_col = f"{carb}_prix", f"{carb}_maj"
    geo = lat is not None and lon is not None
    where = (f'within_distance(geom, geom\'POINT({lon} {lat})\', {dist or 10}km)'
             if geo else f'cp="{cp}"')
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(DATA_URL, params={"where": where, "limit": 100})
            r.raise_for_status()
            results = r.json().get("results", [])
    except (httpx.TimeoutException, httpx.ConnectError):
        return None, None, JSONResponse({"detail": "L'API de l'État ne répond pas."}, status_code=503)
    except httpx.HTTPStatusError as e:
        s = e.response.status_code
        if s == 401:
            return None, None, JSONResponse(
                {"detail": "Accès refusé par l'API de l'État (clé invalide)."}, status_code=401)
        if s == 429:
            ra = e.response.headers.get("Retry-After")
            return None, None, JSONResponse(
                {"detail": "Trop de requêtes, patiente avant de réessayer.", "retry_after": ra},
                status_code=429, headers={"Retry-After": ra} if ra else None)
        if 500 <= s < 600:
            return None, None, JSONResponse(
                {"detail": "L'API de l'État renvoie une erreur."}, status_code=502)
        return None, None, JSONResponse({"detail": "L'API de l'État ne répond pas."}, status_code=503)
    except httpx.HTTPError:
        return None, None, JSONResponse({"detail": "L'API de l'État ne répond pas."}, status_code=503)

    stations, ruptures = [], []
    for x in results:
        prix, rtype = x.get(prix_col), x.get(f"{carb}_rupture_type")
        if prix is None:
            if x.get(f"{carb}_rupture_debut") or rtype:
                ruptures.append({"adresse": x.get("adresse"), "ville": x.get("ville"), "rupture": rtype})
            continue
        j = jours_depuis(x.get(maj_col))
        ouv = ouvert_actuellement(x.get("horaires"), x.get("horaires_automate_24_24"))
        serv = x.get("services_service") or []
        g = x.get("geom") or {}
        fuels = {}
        for c in sorted(CARBURANTS):
            p, m = x.get(f"{c}_prix"), x.get(f"{c}_maj")
            rt = x.get(f"{c}_rupture_type")
            if p is None and not x.get(f"{c}_rupture_debut") and not rt:
                continue
            jj = jours_depuis(m)
            fuels[c] = {"prix": p, "date": m, "jours": jj,
                        "perime": jj is not None and jj > SEUIL_FRAICHEUR, "rupture": rt}
        stations.append({"id": str(x.get("id")), "adresse": x.get("adresse"), "ville": x.get("ville"),
                         "cp": x.get("cp"), "prix": prix, "date": x.get(maj_col),
                         "lat": g.get("lat"), "lon": g.get("lon"), "jours": j,
                         "perime": j is not None and j > SEUIL_FRAICHEUR,
                         "rupture": rtype, "services": serv, "carburants": fuels,
                         "distance_km": (haversine(lat, lon, g.get("lat"), g.get("lon"))
                                         if geo and g.get("lat") is not None else None),
                         "affluence": calc_affluence(ouv, x.get("pop"), len(serv))})
    stations.sort(key=lambda s: s["prix"])
    if not geo and dist:
        cc = [(s["lat"], s["lon"]) for s in stations if s.get("lat") is not None]
        if cc:
            cla = sum(p[0] for p in cc) / len(cc)
            clo = sum(p[1] for p in cc) / len(cc)
            for s in stations:
                s["distance_km"] = (haversine(cla, clo, s.get("lat"), s.get("lon"))
                                    if s.get("lat") is not None else None)
            stations = [s for s in stations
                        if s["distance_km"] is not None and s["distance_km"] <= dist]
    return stations, ruptures, None


def jours_depuis(maj):
    try:
        dt = datetime.fromisoformat(maj)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).days
    except (TypeError, ValueError):
        return None


def ouvert_actuellement(horaires, automate, now=None):
    now = now or datetime.now(ZoneInfo("Europe/Paris"))
    if (automate or "") == "1":
        return True
    try:
        import json
        h = json.loads(horaires) if isinstance(horaires, str) else horaires
        jour = next(j for j in h.get("jour", []) if str(j.get("@id")) == str(now.isoweekday()))
        if jour.get("@ferme") == "1":
            return False
        slots = jour.get("horaire")
        if not slots:
            return None
        slots = slots if isinstance(slots, list) else [slots]
        t = now.hour + now.minute / 60
        for s in slots:
            try:
                oh, om = str(s["@ouverture"]).replace(":", ".").split(".")
                fh, fm = str(s["@fermeture"]).replace(":", ".").split(".")
                if int(oh) + int(om) / 60 <= t < int(fh) + int(fm) / 60:
                    return True
            except (KeyError, ValueError, IndexError):
                continue
        return False
    except (ValueError, TypeError, StopIteration, AttributeError):
        return None


def calc_affluence(ouvert, pop, nb_services, now=None):
    if ouvert is False:
        return {"niveau": "fermé", "ouvert": False}
    now = now or datetime.now(ZoneInfo("Europe/Paris"))
    t, wd = now.hour + now.minute / 60, now.isoweekday()
    pointe = (wd <= 5 and ((7.5 <= t < 9.5) or (12 <= t < 14) or (17 <= t < 19.5))) or \
             (wd == 6 and ((9.5 <= t < 12.5) or (14 <= t < 18)))
    creux = t < 6 or t >= 22
    score = 2 if pointe else (0 if creux else 1)
    if nb_services >= 5 or pop == "A":
        score = min(2, score + 1)
    return {"niveau": ("fluide", "modérée", "dense")[score], "ouvert": ouvert}


def load_histo():
    try:
        import json
        return json.loads(HISTO_FILE.read_text())
    except (OSError, ValueError):
        return {}


def push_point(key, entry):
    try:
        import json
        h = load_histo()
        pts = h.get(key, [])
        if pts and pts[-1]["date"] == entry["date"]:
            pts[-1] = entry
        else:
            pts.append(entry)
        h[key] = pts[-30:]
        HISTO_FILE.write_text(json.dumps(h))
    except OSError:
        pass


def record_histo(cp, carburant, mini, moyenne, lat=None, lon=None):
    push_point(zone_key(cp, carburant, lat, lon),
               {"date": date.today().isoformat(), "min": mini, "moyenne": moyenne})


def record_station(sid, carburant, prix):
    push_point(f"st:{sid}|{carburant.lower()}",
               {"date": date.today().isoformat(), "prix": prix})


def get_station_histo(sid, carburant):
    return load_histo().get(f"st:{sid}|{carburant.lower()}", [])[-30:]


def calc_prevision(cp, carburant, lat=None, lon=None):
    pts = load_histo().get(zone_key(cp, carburant, lat, lon), [])[-7:]
    if len(pts) < 2:
        return {"tendance": "inconnu", "variation": 0.0, "points": len(pts),
                "conseil": "Pas encore assez d'historique, reviens demain."}
    n = len(pts)
    xs = list(range(n))
    ys = [p["min"] for p in pts]
    mx, my = sum(xs) / n, sum(ys) / n
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sum((x - mx) ** 2 for x in xs) or 1)
    slope = round(slope, 4)
    variation = round(ys[-1] - ys[0], 3)
    if slope >= 0.002:
        tendance, conseil = "hausse", "Fais le plein aujourd'hui, les prix montent."
    elif slope <= -0.002:
        tendance, conseil = "baisse", "Tu peux attendre, les prix baissent."
    else:
        tendance, conseil = "stable", "Prix stables, fais le plein sans pression."
    return {"tendance": tendance, "variation": variation, "points": n, "conseil": conseil}


def total_cout(prix, km_ar, conso=6.5, plein=50):
    """Coût total du plein, trajet aller-retour inclus (km_ar = km A/R)."""
    return round(plein * prix + km_ar * conso / 100 * prix, 2)


def calc_detour(prix_proche, km_proche, prix_loin, km_loin, conso=6.5, plein=50):
    economie_station = round((prix_proche - prix_loin) * plein, 2)
    km_extra = max(0.0, km_loin - km_proche)
    surcout_trajet = round(km_extra * conso / 100 * prix_proche, 2)
    economie_nette = round(economie_station - surcout_trajet, 2)
    vaut = economie_nette > 0
    return {
        "economie_station": economie_station,
        "surcout_trajet": surcout_trajet,
        "economie_nette": economie_nette,
        "vaut_le_coup": vaut,
        "message": (
            f"Oui, le détour te fait gagner {economie_nette:.2f} €."
            if vaut
            else "Non, le détour te coûte plus cher en essence qu'il ne rapporte."
        ),
    }


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(
        Path(__file__).parent / "static" / "index.html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api")
def api_root():
    return {
        "nom": "API Carburants — prix les moins chers par code postal",
        "routes": {
            "GET /": "interface web",
            "GET /api": "cette aide",
            "GET /stations?cp=77270&carburant=gazole": "stations triées + fiabilité + affluence (ouvert, niveau estimé)",
            "GET /stations?lat=48.95&lon=2.60&dist=10&carburant=gazole": "idem autour d'une position (géolocalisation)",
            "GET /stations?cp=77270&dist=5&carburant=gazole": "idem rayon autour du centre du code postal",
            "GET /stations?cp=77270&carburant=gazole&km_proche=2&km_loin=10": "idem + verdict détour (facultatif)",
            "GET /stations/moins-chere?cp=77270&carburant=gazole": "station la moins chère",
            "GET /stats?cp=77270&carburant=gazole": "moyenne, min, max, nombre de stations",
            "GET /detour?prix_proche=1.90&km_proche=2&prix_loin=1.80&km_loin=10&conso=6.5&plein=50": "le détour vaut-il le coup ? (km = aller-retour)",
            "GET /alertes/check?cp=77270&carburant=gazole&seuil=1.80": "alerte si le prix min passe sous le seuil",
            "GET /prevision?cp=77270&carburant=gazole": "faut-il faire le plein aujourd'hui ou attendre ?",
        },
        "carburants": sorted(CARBURANTS),
    }


@app.get("/stations")
async def stations(
    cp: str | None = Query(None),
    carburant: str = Query(...),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    dist: float | None = Query(None, gt=0, le=100, description="rayon en km"),
    km_proche: float | None = Query(None, ge=0, description="Km A/R station proche (cher) — facultatif"),
    km_loin: float | None = Query(None, ge=0, description="Km A/R station loin (pas cher) — facultatif"),
    conso: float = Query(6.5, gt=0),
    plein: float = Query(50, gt=0),
):
    err = check_params(cp, carburant, lat, lon)
    if err:
        return err
    data, ruptures, err = await fetch_stations(cp, carburant, lat, lon, dist)
    if err:
        return err
    if not data:
        return JSONResponse({"detail": "Aucune station trouvée.", "ruptures": ruptures}, status_code=404)
    resp = {"cp": cp, "carburant": carburant.lower(), "nombre": len(data), "stations": data,
            "prix_perimes": sum(1 for s in data if s["perime"]), "ruptures": ruptures}
    if lat is not None and lon is not None:
        resp["position"] = {"lat": lat, "lon": lon, "dist": dist}
    for s in data:
        km_ar = 2 * s["distance_km"] if s.get("distance_km") is not None else 0.0
        s["total_cost"] = total_cout(s["prix"], km_ar, conso, plein)
        record_station(s["id"], carburant, s["prix"])
        s["histo"] = get_station_histo(s["id"], carburant)
    near = min([s for s in data if s.get("distance_km") is not None],
               key=lambda s: s["distance_km"], default=None)
    for s in data:
        s["economy_vs_nearest"] = round(near["total_cost"] - s["total_cost"], 2) if near else None
    if km_proche is not None and km_loin is not None and len(data) >= 1:
        d = calc_detour(data[-1]["prix"], km_proche, data[0]["prix"], km_loin, conso, plein)
        d["station_proche"] = {k: data[-1][k] for k in ("adresse", "ville", "prix")}
        d["station_proche"].update({"distance_km": km_proche,
            "total_cost": total_cout(data[-1]["prix"], km_proche, conso, plein)})
        d["station_loin"] = {k: data[0][k] for k in ("adresse", "ville", "prix")}
        d["station_loin"].update({"distance_km": km_loin,
            "total_cost": total_cout(data[0]["prix"], km_loin, conso, plein)})
        d["economy_vs_nearest"] = d["economie_nette"]
        resp["detour"] = d
    return resp


@app.get("/stations/moins-chere")
async def moins_chere(
    cp: str | None = Query(None), carburant: str = Query(...),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    dist: float | None = Query(None, gt=0, le=100),
):
    err = check_params(cp, carburant, lat, lon)
    if err:
        return err
    data, _, err = await fetch_stations(cp, carburant, lat, lon, dist)
    if err:
        return err
    if not data:
        return JSONResponse({"detail": "Aucune station trouvée."}, status_code=404)
    return {"cp": cp, "carburant": carburant.lower(), "station": data[0]}


@app.get("/stats")
async def stats(
    cp: str | None = Query(None), carburant: str = Query(...),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    dist: float | None = Query(None, gt=0, le=100),
):
    err = check_params(cp, carburant, lat, lon)
    if err:
        return err
    data, _, err = await fetch_stations(cp, carburant, lat, lon, dist)
    if err:
        return err
    if not data:
        return JSONResponse({"detail": "Aucune station trouvée."}, status_code=404)
    prix = [s["prix"] for s in data]
    mini, maxi = min(prix), max(prix)
    record_histo(cp, carburant, mini, round(sum(prix) / len(prix), 3), lat, lon)
    return {
        "cp": cp, "carburant": carburant.lower(), "nombre": len(data),
        "min": mini, "max": maxi,
        "moyenne": round(sum(prix) / len(prix), 3),
        "prix_perimes": sum(1 for s in data if s["perime"]),
    }


@app.get("/detour")
def detour(
    prix_proche: float = Query(..., gt=0),
    km_proche: float = Query(..., ge=0),
    prix_loin: float = Query(..., gt=0),
    km_loin: float = Query(..., ge=0),
    conso: float = Query(6.5, gt=0, description="L/100 km"),
    plein: float = Query(50, gt=0, description="litres"),
):
    return calc_detour(prix_proche, km_proche, prix_loin, km_loin, conso, plein)


@app.get("/prevision")
async def prevision(
    cp: str | None = Query(None), carburant: str = Query(...),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    dist: float | None = Query(None, gt=0, le=100),
):
    err = check_params(cp, carburant, lat, lon)
    if err:
        return err
    data, _, err = await fetch_stations(cp, carburant, lat, lon, dist)
    if err:
        return err
    if not data:
        return JSONResponse({"detail": "Aucune station trouvée."}, status_code=404)
    prix = [s["prix"] for s in data]
    record_histo(cp, carburant, min(prix), round(sum(prix) / len(prix), 3), lat, lon)
    prev = calc_prevision(cp, carburant, lat, lon)
    return {"cp": cp, "carburant": carburant.lower(), "prix_actuel_min": min(prix), **prev}


@app.get("/alertes/check")
async def alertes_check(
    cp: str | None = Query(None), carburant: str = Query(...), seuil: float = Query(..., gt=0),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    dist: float | None = Query(None, gt=0, le=100),
):
    err = check_params(cp, carburant, lat, lon)
    if err:
        return err
    data, _, err = await fetch_stations(cp, carburant, lat, lon, dist)
    if err:
        return err
    if not data:
        return JSONResponse({"detail": "Aucune station trouvée."}, status_code=404)
    mini = min(s["prix"] for s in data)
    hit = mini <= seuil
    return {
        "cp": cp, "carburant": carburant.lower(), "seuil": seuil,
        "min": mini, "declenchee": hit,
        "message": (
            f"Prix sous le seuil : {mini:.3f} € ≤ {seuil:.3f} €."
            if hit else f"Pas encore : min {mini:.3f} € > seuil {seuil:.3f} €."
        ),
    }
