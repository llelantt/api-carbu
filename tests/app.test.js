import { describe, it, expect } from 'vitest';
import {
  esc, pf, pf2, ruptureLabel, fuelName, fuelsRows, markerClass, suggestHTML, zoneSentence, affBadge, openState,
  stationsHTML, errorText, previsionLine, leafletPlan,
} from '../static/app.js';

const station = (over = {}) => ({
  id: '1', adresse: 'Place Test', ville: 'Ville', cp: '77270',
  prix: 1.789, date: '2026-10-01T00:00:00+00:00', lat: 48.95, lon: 2.6,
  jours: 1, perime: false, rupture: null, distance_km: 2.5,
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
