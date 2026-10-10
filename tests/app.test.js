import { describe, it, expect } from 'vitest';
import {
  esc, pf, pf2, ruptureLabel, fuelName, fuelsRows, markerClass, suggestHTML, zoneSentence, affBadge, openState,
  sheetLinks, openSheet, closeSheet, validCoords, navItems, copyAddr, copyButton, isApple, trendHTML, autoDetourParams,
  detourBannerHTML, sameStationHTML, wireDetourClick, osrmTableURL, applyRoadKm, favToStation,
  toggleFav, isFav, loadFavs, saveFavs, renderFavs,
  renderList, setTestState, initSheet, loadHideClosed, saveHideClosed, initDefaultMap,
  stationsHTML, errorText, previsionLine, leafletPlan,
} from '../static/app.js';

const station = (over = {}) => ({
  id: '1', adresse: 'Place Test', ville: 'Ville', cp: '77270',
  prix: 1.789, date: '2026-10-01T00:00:00+00:00', lat: 48.95, lon: 2.6,
  jours: 1, perime: false, rupture: null, distance_km: 2.5,
  enseigne: null, nom: null,
  affluence: { niveau: 'modérée', ouvert: true },
  total_cost: 90.5, economy_vs_nearest: 0,
  services: [], carburants: { e10: { prix: 1.789, date: null, jours: 1, perime: false, rupture: null } },
  histo: [{ date: '2026-10-08', prix: 1.8 }, { date: '2026-10-09', prix: 1.789 }],
  ...over,
});

describe('esc', () => {
  it('échappe les balises script', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('échappe guillemets, apostrophes et &', () => {
    expect(esc('a"b\'c&d')).toBe('a&quot;b&#39;c&amp;d');
  });
  it('tolère null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('formats de prix FR', () => {
  it('pf : 3 décimales à virgule', () => {
    expect(pf(1.789)).toBe('1,789');
    expect(pf(2)).toBe('2,000');
  });
  it('pf2 : 2 décimales à virgule, signe conservé', () => {
    expect(pf2(4.016)).toBe('4,02');
    expect(pf2(-1.5)).toBe('-1,50');
  });
});

describe('classe marqueur', () => {
  it('min -> mk0, max -> mk4, milieu -> mk2', () => {
    expect(markerClass(1, 1, 2)).toBe('mk0');
    expect(markerClass(2, 1, 2)).toBe('mk4');
    expect(markerClass(1.5, 1, 2)).toBe('mk2');
  });
  it('prix égaux -> mk0, borné à mk4', () => {
    expect(markerClass(1.5, 1.5, 1.5)).toBe('mk0');
    expect(markerClass(9, 1, 2)).toBe('mk4');
  });
});

describe('ruptureLabel', () => {
  it('accentue definitive et temporaire', () => {
    expect(ruptureLabel('definitive')).toBe('définitive');
    expect(ruptureLabel('temporaire')).toBe('temporaire');
  });
  it('laisse passer les valeurs inconnues', () => {
    expect(ruptureLabel('autre')).toBe('autre');
  });
});

describe('fuelsRows', () => {
  const x = { carburants: {
    sp98: { prix: 2.1, date: null, jours: 1, perime: false, rupture: null },
    gazole: { prix: 1.9, date: null, jours: 1, perime: false, rupture: null },
    e85: { prix: null, date: null, jours: null, perime: false, rupture: 'definitive' },
  } };
  it('noms normaux et ordre fixe', () => {
    const html = fuelsRows(x);
    expect(html).toContain('>Gazole<');
    expect(html).toContain('>SP98<');
    expect(html.indexOf('Gazole')).toBeLessThan(html.indexOf('SP98'));
    expect(html.indexOf('SP98')).toBeLessThan(html.indexOf('E85'));
    expect(html).not.toContain('GAZOLE');
  });
  it('surligne le carburant cherché', () => {
    expect(fuelsRows(x, 'e85')).toContain('fuel cur');
    expect(fuelsRows(x, '')).not.toContain('cur');
  });
});

describe('openState', () => {
  it('quatre états, même source pour badge et compteur', () => {
    expect(openState({ ouvert: true, is_24h: true })).toBe('24h');
    expect(openState({ ouvert: true })).toBe('open');
    expect(openState({ ouvert: false })).toBe('closed');
    expect(openState({ ouvert: null })).toBe('unknown');
    expect(openState(undefined)).toBe('unknown');
  });
});

describe('affBadge', () => {
  it('état toujours en premier, séparé de l’affluence', () => {
    const h = affBadge({ niveau: 'modérée', ouvert: true });
    expect((h.match(/<span class="badge/g) || []).length).toBe(2);
    expect(h.indexOf('>Ouvert<')).toBeLessThan(h.indexOf('Affluence'));
  });
  it('couleurs d’état et aria-label lisible', () => {
    const h = affBadge({ niveau: 'dense', ouvert: true });
    expect(h).toContain('st-open');
    expect(h).toContain('aria-label="Station ouverte, affluence dense"');
    expect(h).toContain(' aff">Affluence dense');
    expect(affBadge({ niveau: 'fermé', ouvert: false })).toContain('st-closed');
    expect(affBadge({ niveau: 'fluide', ouvert: null })).toContain('st-unknown');
  });
  it('fermé -> un seul badge', () => {
    const h = affBadge({ niveau: 'fermé', ouvert: false });
    expect(h).toContain('>Fermé<');
    expect(h).not.toContain('Affluence');
  });
  it('inconnu -> Horaires inconnus + niveau', () => {
    const h = affBadge({ niveau: 'dense', ouvert: null });
    expect(h).toContain('Horaires inconnus');
    expect(h).toContain('Affluence dense');
  });
  it('24h/24 -> Ouvert 24h/24 sans mention simple', () => {
    const h = affBadge({ niveau: 'fluide', ouvert: true, is_24h: true });
    expect(h).toContain('Ouvert 24h/24');
    expect(h).not.toContain('>Ouvert<');
  });
});

describe('badges état au rendu', () => {
  const cards = list => stationsHTML(list, { mn: 1, mx: 2, L: 50 });
  it('inconnu / 24h / fermé', () => {
    const html = cards([
      station({ affluence: { niveau: 'dense', ouvert: null } }),
      station({ affluence: { niveau: 'fluide', ouvert: true, is_24h: true } }),
      station({ affluence: { niveau: 'fermé', ouvert: false } }),
    ]);
    expect(html).toContain('Horaires inconnus');
    expect(html).toContain('Affluence dense');
    expect(html).toContain('Ouvert 24h/24');
    expect(html).toContain('>Fermé<');
  });
  it('chaque carte a son badge d’état', () => {
    const html = cards([
      station({ affluence: { niveau: 'fluide', ouvert: true } }),
      station({ affluence: { niveau: 'modérée', ouvert: null } }),
      station({ affluence: { niveau: 'fermé', ouvert: false } }),
    ]);
    const parts = html.split('<div class="st"').slice(1);
    expect(parts.length).toBe(3);
    for (const c of parts) {
      expect(c).toMatch(/Ouvert 24h\/24|>Ouvert<|>Fermé<|Horaires inconnus/);
    }
  });
  it('enseigne en titre, adresse en dessous', () => {
    const html = cards([station({ enseigne: 'Total', nom: 'Station Total' })]);
    expect(html).toContain('<b>Total</b>');
    expect(html).toContain('Place Test');
  });
  it('sans enseigne, adresse en titre', () => {
    const html = cards([station()]);
    expect(html).toContain('<b>Place Test</b>');
  });
});

describe('stationsHTML', () => {
  it('neutralise les noms malveillants', () => {
    const html = stationsHTML([station({
      adresse: '<script>alert("x")</script>',
      ville: 'Ville <img src=x onerror=y>',
      services: ['<b>Bar</b>', 'a"b'],
      rupture: '<i>totale</i>',
    })], { mn: 1.789, mx: 1.789, L: 50 });
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('script')).toBeNull();
    expect(div.textContent).toContain('<script>');
  });
  it('réponse vide -> chaîne vide', () => {
    expect(stationsHTML([], { mn: 0, mx: 0, L: 50 })).toBe('');
  });
  it('affiche rang, prix, total et distance', () => {
    const html = stationsHTML([station()], { mn: 1.789, mx: 1.789, L: 50 });
    expect(html).toContain('1,789');
    expect(html).toContain('90,50');
    expect(html).toContain('2,5 km');
  });
});

describe('previsionLine', () => {
  it('tendance inconnue -> tiret sans variation chiffrée', () => {
    const t = previsionLine({ tendance: 'inconnu', variation: 0, points: 1 });
    expect(t).toContain('—');
    expect(t).toContain("pas encore assez d'historique");
    expect(t).not.toContain('€');
  });
  it('moins de 2 relevés -> idem', () => {
    expect(previsionLine({ tendance: 'hausse', variation: 0.01, points: 1 })).toContain('—');
  });
  it('tendance connue -> variation signée', () => {
    const t = previsionLine({ tendance: 'hausse', variation: 0.012, points: 5 });
    expect(t).toContain('+0,012 €');
  });
});

describe('errorText', () => {
  it('401 -> clé API invalide', () => {
    const e = errorText(401, {});
    expect(e.kind).toBe('auth');
    expect(e.text).toMatch(/clé API invalide/i);
  });
  it('429 avec Retry-After', () => {
    expect(errorText(429, { retry_after: '120' }).text).toContain('120 s');
    expect(errorText(429, {}).text).toContain('quelques instants');
  });
  it('5xx -> service indisponible', () => {
    expect(errorText(502, {}).kind).toBe('server');
  });
  it('404 -> neutre avec ruptures', () => {
    const e = errorText(404, { detail: 'Aucune station trouvée.', ruptures: [{ adresse: 'A', ville: 'V' }] });
    expect(e.kind).toBe('empty');
    expect(e.text).toContain('Aucune station trouvée.');
    expect(e.text).toContain('Ruptures');
  });
});

const geo = (over = {}) => ({
  lat: 48.95, lon: 2.6, prix: 1.8, adresse: 'A', ville: 'V', ...over,
});

describe('leafletPlan', () => {
  it('un marqueur par station géolocalisée, couleurs min/max', () => {
    const p = leafletPlan(
      [geo({ prix: 1.5 }), geo({ prix: 2.5 }), { lat: null, lon: null, prix: 1.0 }],
      { sel: null, pos: null },
    );
    expect(p.markers).toHaveLength(2);
    expect(p.markers[0].html).toContain('mk0');
    expect(p.markers[1].html).toContain('mk4');
    expect(p.bounds).toHaveLength(2);
  });
  it('sélection mise en évidence', () => {
    const p = leafletPlan([geo(), geo()], { sel: 1, pos: null });
    expect(p.markers[1].html).toContain(' sel');
    expect(p.markers[0].html).not.toContain(' sel');
  });
  it('échappe un nom contenant du HTML dans la popup', () => {
    const p = leafletPlan([geo({ adresse: '<script>alert(1)</script>' })], { sel: null, pos: null });
    expect(p.markers[0].popup).toContain('&lt;script&gt;');
    expect(p.markers[0].popup).not.toContain('<script>alert');
  });
  it('liste vide + départ connu -> carte centrée sur le départ', () => {
    const p = leafletPlan([], { sel: null, pos: { lat: 48.8, lon: 2.3 } });
    expect(p.center).toEqual([48.8, 2.3]);
    expect(p.zoom).toBe(14);
    expect(p.markers).toEqual([]);
  });
  it('liste vide sans départ -> null', () => {
    expect(leafletPlan([], { sel: null, pos: null })).toBeNull();
  });
  it('une seule station -> zoom maximum borné', () => {
    const p = leafletPlan([geo()], { sel: null, pos: null });
    expect(p.bounds).toBeNull();
    expect(p.center).toEqual([48.95, 2.6]);
    expect(p.zoom).toBeLessThanOrEqual(16);
  });
});

describe('suggestHTML', () => {
  it('liste les libellés et échappe le HTML', () => {
    const html = suggestHTML([
      { properties: { label: '12 Rue de Rivoli 75004 Paris' } },
      { properties: { label: '<script>alert(1)</script>' } },
    ]);
    expect(html).toContain('12 Rue de Rivoli 75004 Paris');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });
  it('liste vide -> chaîne vide', () => {
    expect(suggestHTML([])).toBe('');
  });
});

describe('zoneSentence', () => {
  it('phrase exacte', () => {
    expect(zoneSentence(45, 10, 'Villeparisis', 'gazole'))
      .toBe('45 station(s) dans un rayon de 10 km autour de Villeparisis · GAZOLE');
  });
});

describe('panneau Y aller', () => {
  const setup = () => {
    document.body.innerHTML = '<div id="sheet" hidden><div id="sheet-card"></div></div>';
  };
  it('titre + 3 liens + Annuler', () => {
    setup();
    openSheet(station({ enseigne: 'TotalX', adresse: 'Rue X', ville: 'V' }), null);
    expect(document.getElementById('sheet').hidden).toBe(false);
    const card = document.getElementById('sheet-card');
    expect(card.textContent).toContain('TotalX');
    expect(card.querySelectorAll('a')).toHaveLength(3);
    expect(card.textContent).toContain('Annuler');
  });
  it('un seul panneau : réouverture remplace', () => {
    setup();
    openSheet(station({ enseigne: 'TotalA' }), null);
    openSheet(station({ enseigne: 'TotalB' }), null);
    expect(document.querySelectorAll('#sheet-card')).toHaveLength(1);
    expect(document.getElementById('sheet-card').textContent).toContain('TotalB');
  });
  it('fermeture', () => {
    setup();
    openSheet(station(), null);
    closeSheet();
    expect(document.getElementById('sheet').hidden).toBe(true);
  });
  it('caché au chargement : display none, aucun clic intercepté', () => {
    const style = document.createElement('style');
    style.textContent = '[hidden]{display:none!important}';
    document.head.appendChild(style);
    document.body.innerHTML = '<div id="sheet" hidden><div id="sheet-card"></div></div><button id="behind">x</button>';
    const el = document.getElementById('sheet');
    expect(el.hidden).toBe(true);
    expect(getComputedStyle(el).display).toBe('none');
    let clicked = false;
    document.getElementById('behind').addEventListener('click', () => { clicked = true; });
    document.getElementById('behind').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toBe(true);
    style.remove();
  });
  it('station vide ne fait rien, Échap ferme', () => {
    document.body.innerHTML = '<div id="sheet" hidden><div id="sheet-card"></div></div>';
    initSheet();
    openSheet({}, null);
    expect(document.getElementById('sheet').hidden).toBe(true);
    openSheet(station(), null);
    expect(document.getElementById('sheet').hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(true);
  });
  it('verrouille le défilement à l’ouverture, libère à la fermeture', () => {
    setup();
    openSheet(station(), null);
    expect(document.body.style.overflow).toBe('hidden');
    closeSheet();
    expect(document.body.style.overflow).toBe('');
  });
  it('sans station ou données vides -> ne s’ouvre pas', () => {
    setup();
    openSheet(null, null);
    openSheet({}, null);
    openSheet({ adresse: null, ville: null, lat: null, lon: null }, null);
    expect(document.getElementById('sheet').hidden).toBe(true);
  });
  it('sheetLinks : 3 liens target blank', () => {
    const h = sheetLinks(station());
    expect((h.match(/<a /g) || []).length).toBe(3);
    expect(h).toContain('target="_blank"');
  });
  it('focus sur la première option à l’ouverture', () => {
    document.body.innerHTML = '<div id="sheet" hidden><div id="sheet-card"></div></div>';
    openSheet(station(), null);
    expect(document.activeElement.tagName).toBe('A');
  });
});

describe('liens navigation', () => {
  it('coordonnées valides -> LAT,LON', () => {
    expect(validCoords(48.9, 2.6)).toBe(true);
    expect(validCoords('48.9', 2.6)).toBe(false);
    expect(validCoords(NaN, 2.6)).toBe(false);
    expect(validCoords(null, 2.6)).toBe(false);
    expect(validCoords(100, 2.6)).toBe(false);
    expect(validCoords(48.9, 200)).toBe(false);
  });
  it('formats officiels avec coordonnées', () => {
    const h = sheetLinks(station({ lat: 48.9, lon: 2.6 }));
    expect(h).toContain('https://waze.com/ul?ll=48.9,2.6&navigate=yes');
    expect(h).toContain('https://www.google.com/maps/dir/?api=1&destination=48.9,2.6');
    expect(h).toContain('https://maps.apple.com/?daddr=48.9,2.6&dirflg=d');
    expect(h).toContain('rel="noopener noreferrer"');
  });
  it('sans coordonnées -> adresse encodée', () => {
    const h = sheetLinks(station({ lat: null, lon: null, adresse: '20 Rue Gambetta', ville: 'Lille' }));
    expect(h).toContain(encodeURIComponent('20 Rue Gambetta Lille'));
    expect(h).toContain('dirflg=d');
  });
  it('ni coordonnées ni adresse -> options désactivées', () => {
    const h = sheetLinks(station({ lat: null, lon: null, adresse: null, ville: null }));
    expect(h).not.toContain('<a ');
    expect((h.match(/aria-disabled="true"/g) || []).length).toBe(3);
  });
});

describe('ordre selon appareil', () => {
  const setUA = ua => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  const def = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
  it('Apple -> Plans en premier', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(isApple()).toBe(true);
    const names = navItems(station()).map(i => i.name);
    expect(names[0]).toBe('Plans');
    setUA(def);
  });
  it('autres -> Waze, Google, Plans (Apple) en dernier', () => {
    setUA(def);
    expect(isApple()).toBe(false);
    const names = navItems(station()).map(i => i.name);
    expect(names).toEqual(['Waze', 'Google Maps', 'Plans (Apple)']);
  });
});

describe('copie adresse', () => {
  it('bouton avec adresse échappée, désactivé sinon', () => {
    expect(copyButton(station({ adresse: '20 Rue', ville: 'Lille' }))).toContain('data-copy="20 Rue Lille"');
    const off = copyButton(station({ adresse: null, ville: null }));
    expect(off).toContain('disabled');
    expect(off).not.toContain('data-copy');
  });
  it('confirme par message, repli si refusé', async () => {
    document.body.innerHTML = '<p id="copy-msg" hidden></p>';
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
    await copyAddr('20 Rue Gambetta Lille');
    expect(document.getElementById('copy-msg').textContent).toBe('Adresse copiée');
    delete window.navigator.clipboard;
    await copyAddr('x');
    expect(document.getElementById('copy-msg').textContent).toContain('Copie impossible');
  });
});

describe('interactions carte/panneau', () => {
  const ui = (stations) => {
    document.body.innerHTML = `
      <div id="stations"></div><div id="map" hidden></div><p id="mapwarn" hidden></p>
      <input type="checkbox" id="hideClosed" checked><p id="closedmsg" class="sub" hidden></p>
      <div id="sheet" hidden><div id="sheet-card"></div></div>`;
    initSheet();
    setTestState({
      stations: stations || [
        station({ enseigne: 'TotalX', lat: 48.9, lon: 2.6 }),
        station({ prix: 1.9 }),
        station({ prix: 2.0 }),
      ],
      stats: { min: 1.789, max: 2.0 },
      plein: 50,
    });
    renderList();
  };
  it('clic sur une carte ouvre le panneau', () => {
    ui();
    document.querySelector('.st').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(false);
    expect(document.getElementById('sheet-title').textContent).toContain('TotalX');
  });
  it('touche Entrée ouvre le panneau', () => {
    ui();
    document.querySelector('.st').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(false);
  });
  it('Échap ferme et rend le focus à la carte', () => {
    ui();
    const card = document.querySelector('.st');
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.activeElement.tagName).toBe('A');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(true);
    expect(document.activeElement).toBe(card);
  });
  it('liens avec les bons href pour des coordonnées', () => {
    ui();
    document.querySelector('.st').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const hrefs = [...document.querySelectorAll('#sheet-card a')].map(a => a.getAttribute('href'));
    expect(hrefs).toHaveLength(3);
    expect(hrefs[0]).toBe('https://waze.com/ul?ll=48.9,2.6&navigate=yes');
    expect(hrefs[1]).toBe('https://www.google.com/maps/dir/?api=1&destination=48.9,2.6');
    expect(hrefs[2]).toBe('https://maps.apple.com/?daddr=48.9,2.6&dirflg=d');
  });
  it('coordonnées invalides -> options désactivées', () => {
    ui([station({ lat: '48.9', lon: 2.6, adresse: null, ville: null })]);
    document.querySelector('.st').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('#sheet-card a')).toHaveLength(0);
    expect(document.querySelectorAll('#sheet-card [aria-disabled="true"]').length).toBeGreaterThanOrEqual(3);
  });
  it('nom avec HTML affiché comme texte', () => {
    ui([station({ enseigne: '<b>Total</b>' })]);
    document.querySelector('.st').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const h2 = document.querySelector('#sheet-title');
    expect(h2.textContent).toContain('<b>Total</b>');
    expect(h2.querySelector('b')).toBeNull();
  });
  it('clic sur un élément interactif n’ouvre pas', () => {
    ui();
    document.querySelector('.st').insertAdjacentHTML('beforeend', '<a href="https://example.com">x</a>');
    document.querySelector('.st a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(true);
  });
});

describe('page servie', () => {
  it('assets versionnés, panneau caché au chargement', async () => {
    const fs = await import('node:fs');
    let html = fs.readFileSync('static/index.html', 'utf8');
    const css = fs.readFileSync('static/styles.css', 'utf8');
    html = html.replace('/static/styles.css', '/static/styles.css?v=3');
    html = html.replace('/static/app.js', '/static/app.js?v=3');
    expect(html).toContain('styles.css?v=');
    expect(html).toContain('app.js?v=');
    html = html.replace(/<script[^>]*src[^>]*><\/script>/g, '');
    html = html.replace('</head>', `<style>${css}</style></head>`);
    document.documentElement.innerHTML = html;
    const sheet = document.getElementById('sheet');
    expect(sheet.hidden).toBe(true);
    expect(getComputedStyle(sheet).display).toBe('none');
  });
  it('CP facultatif (géo possible), carburant requis', () => {
    expect(document.getElementById('cp').hasAttribute('required')).toBe(false);
    expect(document.getElementById('carb').hasAttribute('required')).toBe(true);
  });
});

describe('stations fermées', () => {
  const ui = (stations) => {
    document.body.innerHTML = `
      <div id="stations"></div><div id="map" hidden></div><p id="mapwarn" hidden></p>
      <input type="checkbox" id="hideClosed" checked><p id="closedmsg" class="sub" hidden></p>
      <div id="sheet" hidden><div id="sheet-card"></div></div>`;
    setTestState({ stations, stats: { min: 1.5, max: 2 }, plein: 50 });
    renderList();
  };
  const closed = prix => station({ prix, affluence: { niveau: 'fermé', ouvert: false } });
  const open = prix => station({ prix, affluence: { niveau: 'fluide', ouvert: true } });
  it('badge au moins cher non fermé, jamais aux fermées', () => {
    ui([closed(1.5), open(1.8)]);
    document.getElementById('hideClosed').checked = false;
    renderList();
    const parts = document.querySelectorAll('#stations .st');
    expect(parts.length).toBe(2);
    expect(parts[0].innerHTML).not.toContain('Meilleur prix');
    expect(parts[1].innerHTML).toContain('Meilleur prix');
  });
  it('masque les fermées quand coché', () => {
    ui([closed(1.5), open(1.8)]);
    expect(document.querySelectorAll('#stations .st')).toHaveLength(1);
    expect(document.getElementById('closedmsg').hidden).toBe(true);
  });
  it('toutes fermées -> affichées avec message, sans badge', () => {
    ui([closed(1.5), closed(1.8)]);
    expect(document.querySelectorAll('#stations .st')).toHaveLength(2);
    expect(document.getElementById('closedmsg').hidden).toBe(false);
    expect(document.getElementById('stations').innerHTML).not.toContain('Meilleur prix');
  });
  it('persistance localStorage', () => {
    saveHideClosed(false);
    expect(loadHideClosed()).toBe(false);
    saveHideClosed(true);
    expect(loadHideClosed()).toBe(true);
  });
});

describe('trendHTML', () => {
  it('inconnue -> rien', () => {
    expect(trendHTML({ tendance: 'inconnu', variation: 0, points: 1 })).toBe('');
    expect(trendHTML({ tendance: 'hausse', variation: 0.01, points: 1 })).toBe('');
    expect(trendHTML(null)).toBe('');
  });
  it('baisse verte, hausse rouge, avec aria-label', () => {
    const down = trendHTML({ tendance: 'baisse', variation: -0.012, points: 5 });
    expect(down).toContain('↓');
    expect(down).toContain('−0,012 € sur 7 j');
    expect(down).toContain('trend down');
    expect(down).toContain('aria-label="prix en baisse de 0,012 € sur 7 jours"');
    const up = trendHTML({ tendance: 'hausse', variation: 0.02, points: 5 });
    expect(up).toContain('↑');
    expect(up).toContain('trend up');
  });
});

describe('autoDetourParams', () => {
  const st = (prix, d) => station({ prix, distance_km: d });
  it('proche vs moins chère avec A/R', () => {
    const a = autoDetourParams([st(1.9, 1), st(1.8, 5), st(2.0, 3)]);
    expect(a.prix_proche).toBe(1.9);
    expect(a.km_proche).toBe(2);
    expect(a.prix_loin).toBe(1.8);
    expect(a.km_loin).toBe(10);
  });
  it('même station -> same', () => {
    const a = autoDetourParams([st(1.8, 1), st(1.9, 5)]);
    expect(a.same).toBe(true);
  });
  it('sans distances -> null', () => {
    expect(autoDetourParams([station({ distance_km: null })])).toBeNull();
    expect(autoDetourParams([])).toBeNull();
  });
});

describe('bannière détour cliquable', () => {
  const d = { vaut_le_coup: true, message: 'OK', economy_vs_nearest: 4.01 };
  const lo = station({ adresse: 'Rue B', ville: 'V' });
  const hi = station({ adresse: 'Rue A', ville: 'V' });
  it('contenu + indice Y aller', () => {
    const h = detourBannerHTML(d, lo, hi, 10);
    expect(h).toContain('Rue B');
    expect(h).toContain('Y aller ›');
    expect(sameStationHTML(lo)).toContain('Y aller ›');
  });
  it('clic bannière -> panneau Y aller', () => {
    document.body.innerHTML = '<div id="banner"></div><div id="sheet" hidden><div id="sheet-card"></div></div>';
    const el = document.getElementById('banner');
    el.innerHTML = detourBannerHTML(d, lo, hi, 10);
    wireDetourClick(el, lo);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(false);
    expect(document.getElementById('sheet-title').textContent).toContain('Rue B');
  });
});

describe('distances route', () => {
  it('URL table OSRM', () => {
    expect(osrmTableURL({ lat: 48.9, lon: 2.6 }, [{ lat: 48.95, lon: 2.65 }]))
      .toBe('https://router.project-osrm.org/table/v1/driving/2.6,48.9;2.65,48.95?annotations=distance&sources=0');
  });
  it('applique les km route, ignore les null', () => {
    const a = station({ prix: 2, distance_km: 5, total_cost: 100 });
    const b = station({ prix: 2, distance_km: 5, total_cost: 100 });
    applyRoadKm([a, b], [4, null], 50, 6.5);
    expect(a.distance_km).toBe(4);
    expect(a.parRoute).toBe(true);
    expect(a.total_cost).toBeCloseTo(101.04, 2);
    expect(b.distance_km).toBe(5);
    expect(b.parRoute).toBeUndefined();
  });
});

describe('favoris', () => {
  it('toggle ajoute/retire, isFav', () => {
    const l = [];
    expect(toggleFav(l, { id: '1' })).toBe(true);
    expect(isFav(l, '1')).toBe(true);
    expect(toggleFav(l, { id: '1' })).toBe(false);
    expect(l).toHaveLength(0);
  });
  it('persistance', () => {
    saveFavs([]);
    saveFavs([{ id: '1' }]);
    expect(loadFavs()).toEqual([{ id: '1' }]);
    saveFavs([]);
  });
  it('étoile selon état', () => {
    expect(stationsHTML([station({ id: '9' })], { mn: 1, mx: 2, L: 50, favs: ['9'] })).toContain('★');
    expect(stationsHTML([station({ id: '9' })], { mn: 1, mx: 2, L: 50 })).toContain('☆');
  });
  it('section favoris', () => {
    document.body.innerHTML = '<div id="favs"></div>';
    saveFavs([]);
    saveFavs([{ id: '1', cp: '75001', label: 'Total' }]);
    renderFavs();
    expect(document.getElementById('favs').textContent).toContain('Total');
    saveFavs([]);
  });
  it('clic favori -> panneau Y aller', () => {
    document.body.innerHTML = '<div id="favs"></div><div id="sheet" hidden><div id="sheet-card"></div></div>';
    saveFavs([]);
    saveFavs([{ id: '1', cp: '75001', enseigne: 'TotalX', adresse: 'Rue X', ville: 'V', lat: 48.9, lon: 2.6 }]);
    renderFavs();
    document.querySelector('#favs [data-favi]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('sheet').hidden).toBe(false);
    expect(document.getElementById('sheet-title').textContent).toContain('TotalX');
    const hrefs = [...document.querySelectorAll('#sheet-card a')].map(a => a.getAttribute('href'));
    expect(hrefs[0]).toContain('ll=48.9,2.6');
    saveFavs([]);
  });
});

describe('carte par défaut', () => {
  it('sans Leaflet -> false, carte cachée', () => {
    document.body.innerHTML = '<div id="map" hidden></div>';
    expect(initDefaultMap()).toBe(false);
    expect(document.getElementById('map').hidden).toBe(true);
  });
  it('avec Leaflet -> carte de France affichée', () => {
    const calls = {};
    window.matchMedia = () => ({ matches: false });
    window.L = {
      map: (id, opts) => {
        calls.mapOpts = opts;
        return { setView(c, z) { calls.view = [c, z]; }, invalidateSize() {}, fitBounds() {}, getZoom: () => 6 };
      },
      tileLayer: () => ({ on() {}, addTo() {} }),
      layerGroup: () => ({ addTo() {}, clearLayers() {} }),
    };
    document.body.innerHTML = '<div id="map" hidden></div>';
    expect(initDefaultMap()).toBe(true);
    expect(document.getElementById('map').hidden).toBe(false);
    expect(calls.view).toEqual([[46.6, 2.4], 6]);
    expect(calls.mapOpts.scrollWheelZoom).toBe(false);
    delete window.L;
    delete window.matchMedia;
  });
});
