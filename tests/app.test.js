import { describe, it, expect } from 'vitest';
import {
  esc, pf, pf2, project, priceColor, markerClass,
  stationsHTML, planSVG, errorText,
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

describe('projection lat/lon vers le plan', () => {
  it('dx=(lon-lon0)*cos(lat0)*111.32, dy=(lat-lat0)*110.57', () => {
    const { dx, dy } = project(48.01, 2.01, { la: 48, lo: 2 });
    expect(dx).toBeCloseTo(0.01 * Math.cos(48 * Math.PI / 180) * 111.32, 3);
    expect(dy).toBeCloseTo(1.1057, 3);
  });
  it('centre sur lui-même = 0,0', () => {
    expect(project(48, 2, { la: 48, lo: 2 })).toEqual({ dx: 0, dy: 0 });
  });
});

describe('couleur prix', () => {
  it('min -> vert (teinte 140), max -> rouge (teinte 0)', () => {
    expect(priceColor(1, 1, 2)).toContain('140');
    expect(priceColor(2, 1, 2)).toContain('0');
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

describe('planSVG', () => {
  it('sans point -> null (plan masqué)', () => {
    expect(planSVG([], { R: 1, mn: 0, mx: 0, sel: null, centerLabel: 'Toi' })).toBeNull();
  });
  it('positionne les pastilles (dx=1, R=2 -> cx=290)', () => {
    const svg = planSVG(
      [{ _i: 0, dx: 1, dy: 0, prix: 1.5, adresse: 'A' }],
      { R: 2, mn: 1.5, mx: 1.5, sel: null, centerLabel: 'Toi' },
    );
    expect(svg).toContain('cx="290.0"');
    expect(svg).toContain('Toi');
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
