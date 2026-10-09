# API Carburants

Trouve l'essence la moins chère près de chez toi (données officielles de l'État).

## Installation

```bash
pip install -r requirements.txt
```

## Lancement

```bash
uvicorn main:app --reload
```

Interface : http://127.0.0.1:8000

## Tests front

```bash
npm install
npm test   # vitest + jsdom (aussi lancé par la CI GitHub)
```

## Exemples d'URL

- `GET /api` — nom de l'API et liste des routes
- `GET /stations?cp=77270&carburant=gazole` — stations triées + fiabilité (jours depuis màj, prix périmés > 7 j, stations en rupture) + affluence (ouvert/fermé d'après horaires, niveau estimé)
- `GET /stations?lat=48.95&lon=2.60&dist=10&carburant=gazole` — idem autour de ta position (géolocalisation, rayon en km, distance par station)
- `GET /stations/moins-chere?cp=77270&carburant=gazole` — la moins chère
- `GET /stats?cp=77270&carburant=e10` — moyenne, min, max, nombre de stations
- `GET /stations?cp=77270&carburant=gazole&km_proche=2&km_loin=10` — idem + verdict détour (facultatif)
- `GET /detour?prix_proche=1.90&km_proche=2&prix_loin=1.80&km_loin=10&conso=6.5&plein=50` — le détour vaut-il le coup ? (km = aller-retour, conso en L/100 km)
- `GET /alertes/check?cp=77270&carburant=gazole&seuil=1.80` — alerte si le prix min passe sous le seuil
- `GET /prevision?cp=77270&carburant=gazole` — plein aujourd'hui ou attendre ? (historique local des flux quotidiens)

Carburants : `gazole, sp95, e10, sp98, e85, gplc`
