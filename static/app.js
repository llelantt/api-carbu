/* Front de l'API Carburants.
 * Fonctions pures exportées pour les tests (vitest) ; le câblage DOM
 * ne s'exécute que dans le navigateur (garde hasDOM). */

// ---------- formats & échappement ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pf = n => Number(n).toFixed(3).replace('.', ',');
export const pf2 = n => Number(n).toFixed(2).replace('.', ',');

// ---------- plan SVG ----------
export function project(lat, lon, c0) {
  const cos = Math.cos(c0.la * Math.PI / 180);
  return { dx: (lon - c0.lo) * cos * 111.32, dy: (lat - c0.la) * 110.57 };
}
export function priceColor(p, mn, mx) {
  return `hsl(${Math.round(140 - 140 * (p - mn) / ((mx - mn) || 1))} 70% 42%)`;
}
export function markerClass(p, mn, mx) {
  if (!(mx > mn)) return 'mk0';
  return 'mk' + Math.min(4, Math.round(4 * (p - mn) / (mx - mn)));
}
export function planSVG(P, { R, mn, mx, sel, centerLabel }) {
  if (!P.length) return null;
  const km = r => (R * r).toFixed(R * r < 10 ? 1 : 0).replace('.', ',');
  const ring = k => `<circle cx="200" cy="200" r="${180 * k}" fill="none" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${200 + 180 * k * .707 + 3}" y="${200 - 180 * k * .707}" font-size="10" fill="var(--mut)">${km(k)} km</text>`;
  let m = `<svg viewBox="0 0 400 400" role="img" aria-label="Plan des stations">${ring(1 / 3)}${ring(2 / 3)}${ring(1)}<circle cx="200" cy="200" r="6" fill="var(--ink)"/><text x="208" y="204" font-size="11" fill="var(--ink)">${centerLabel}</text>`;
  [...P].reverse().forEach(x => {
    const px = (200 + x.dx / R * 180).toFixed(1), py = (200 - x.dy / R * 180).toFixed(1);
    const best = x.prix === mn, on = sel === x._i;
    m += `<circle data-id="${x._i}" tabindex="0" role="button" aria-label="${esc(x.adresse) || 'Station'}, ${pf(x.prix)} euros le litre" cx="${px}" cy="${py}" r="${best || on ? 10 : 7}" fill="${priceColor(x.prix, mn, mx)}" stroke="${on ? 'var(--acc)' : best ? 'var(--ink)' : 'var(--card)'}" stroke-width="${on || best ? 3 : 1.5}"/>`;
  });
  return m + '</svg>';
}

// ---------- rendu ----------
export const affBadge = a => {
  const c = { fluide: 'fl', 'modérée': 'mo', dense: 'de', 'fermé': 'fe' }[a.niveau] || 'fe';
  const t = a.niveau === 'fermé' ? 'Fermé' : `${a.ouvert === false ? 'Fermé · ' : a.ouvert ? 'Ouvert · ' : ''}Affluence ${a.niveau}`;
  return `<span class="badge ${c}">${t}</span>`;
};
export const navLinks = x => {
  const dest = (x.lat != null && x.lon != null) ? `${x.lat},${x.lon}` : encodeURIComponent(`${x.adresse || ''} ${x.ville || ''}`);
  const u = { w: `https://waze.com/ul?ll=${dest}&navigate=yes`, g: `https://www.google.com/maps/dir/?api=1&destination=${dest}`, p: `https://maps.apple.com/?daddr=${dest}` };
  return `Y aller : <a href="${u.w}" target="_blank" rel="noopener">Waze</a><a href="${u.g}" target="_blank" rel="noopener">Google Maps</a><a href="${u.p}" target="_blank" rel="noopener">Plans</a>`;
};
export const fuelsRows = x => Object.entries(x.carburants || {}).map(([c, f]) => `<div class="fuel"><span>${c.toUpperCase()}</span><span>${f.prix != null ? `<span class="led sm">${pf(f.prix)} €</span>` : '<span class="addr">—</span>'}</span><span>${f.perime ? `<span class="badge old">Prix ancien (${f.jours} j)</span>` : ''}${f.rupture ? `<span class="badge rup">Rupture ${esc(f.rupture)}</span>` : ''}</span></div>`).join('');
export function curve(h) {
  h = h || [];
  if (h.length < 2) return '<p class="addr">Historique insuffisant : reviens après quelques recherches.</p>';
  const W = 300, H = 90, P = 10;
  const ys = h.map(p => p.prix), mn = Math.min(...ys), mx = Math.max(...ys), rg = (mx - mn) || 0.001;
  const X = i => P + i * (W - 2 * P) / (h.length - 1), Y = v => H - P - (v - mn) / rg * (H - 2 * P);
  const pts = h.map((p, i) => `${X(i).toFixed(1)},${Y(p.prix).toFixed(1)}`).join(' ');
  const d0 = h[0].date.slice(5, 10).replace('-', '/'), d1 = h[h.length - 1].date.slice(5, 10).replace('-', '/');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Historique des prix"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2"/>${h.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.prix).toFixed(1)}" r="3" fill="var(--acc)"/>`).join('')}<text x="${P}" y="${H - 1}" font-size="9" fill="var(--mut)">${d0}</text><text x="${W - P}" y="${H - 1}" font-size="9" text-anchor="end" fill="var(--mut)">${d1}</text><text x="${W - P}" y="12" font-size="9" text-anchor="end" fill="var(--mut)">${pf(mx)} €</text></svg>`;
}
export function stationsHTML(arr, { mn, mx, L }) {
  return arr.map((x, i) => `
<div class="st" data-i="${i}" tabindex="0" role="button" aria-expanded="false"><div class="top"><span class="rk">${i + 1}</span><span class="prix">${pf(x.prix)}<small>€/L</small></span>
${x.prix === mn ? '<span class="badge">Meilleur prix</span>' : ''}</div>
<div><b>${esc(x.adresse) || 'Adresse inconnue'}</b></div>
<div class="addr">${esc(x.ville)}${x.distance_km != null ? ` · à ${String(x.distance_km).replace('.', ',')} km` : ''} · ${x.date ? new Date(x.date).toLocaleDateString('fr-FR') : ''}${x.jours != null ? ` · il y a ${x.jours} j` : ''}</div>
<div class="fiab">${x.perime ? `<span class="badge old">Prix vieux de ${x.jours} j</span>` : ''}${x.rupture ? `<span class="badge rup">Rupture ${esc(x.rupture)}</span>` : ''}${x.affluence ? affBadge(x.affluence) : ''}</div>
<div class="tot">Plein ${L} L : ${pf2(x.total_cost)} €${x.distance_km != null ? ' détour inclus' : ''}</div>
<div class="eco">${x.prix === mn ? '—' : `Économie : ${pf2((mx - x.prix) * L)} € sur un plein de ${L} L`}</div>
<div class="detail" hidden>
<div class="fuels">${fuelsRows(x)}</div>
${(x.services || []).length ? `<div class="fiab">${x.services.map(s => `<span class="badge">${esc(s)}</span>`).join('')}</div>` : ''}
<div class="curve">${curve(x.histo)}</div>
<div class="itin">${navLinks(x)}</div>
</div>
</div>`).join('');
}
export function previsionLine(p) {
  if (p.tendance === 'inconnu' || p.points < 2) return "Tendance 7 j : — · pas encore assez d'historique";
  return `Tendance 7 j : ${p.tendance} (${p.variation >= 0 ? '+' : ''}${pf(p.variation)} €) · ${p.points} relevé(s)`;
}
export function errorText(status, body) {
  body = body || {};
  if (status === 429) {
    const ra = body.retry_after;
    return { kind: 'rate', text: `Trop de requêtes. Réessaie dans ${ra ? ra + ' s' : 'quelques instants'}.` };
  }
  if (status === 401) return { kind: 'auth', text: 'Accès refusé : clé API invalide (401).' };
  if (status >= 500) return { kind: 'server', text: 'Service momentanément indisponible, réessaie plus tard.' };
  if (status === 404) {
    const rl = (body.ruptures || []).map(r => `${r.adresse || 'adresse inconnue'} (${r.ville || ''})`).join(', ');
    return { kind: 'empty', text: (body.detail || 'Aucun résultat.') + (rl ? ` Ruptures : ${rl}.` : '') };
  }
  return { kind: 'error', text: body.detail || 'Erreur.' };
}

// ---------- état navigateur ----------
const hasDOM = typeof document !== 'undefined' && typeof document.getElementById === 'function' && !!document.getElementById('f');
let f = null, msg = null, box = null, cards = null;
let fa = null, msga = null, alBox = null;
let pos = null, lastStations = [];
let sort = 'tot', mode = 'plan', lastS = null, lastT = null, lastMax = 0, lastL = 50;
let sel = null, ctl = null, req = 0;
const jd = async r => { try { return await r.json() } catch { return {} } };

const zoneP = () => pos ? `lat=${pos.lat}&lon=${pos.lon}&dist=${document.getElementById('dist').value}` : `cp=${encodeURIComponent(document.getElementById('cp').value.trim())}`;
const zoneL = () => pos ? `autour de moi (${document.getElementById('dist').value} km)` : document.getElementById('cp').value.trim();

function sortedStations() {
  const a = [...lastS];
  if (sort === 'pr') a.sort((x, y) => x.prix - y.prix);
  else if (sort === 'd') a.sort((x, y) => (x.distance_km ?? 1e9) - (y.distance_km ?? 1e9));
  else a.sort((x, y) => (x.total_cost ?? 1e9) - (y.total_cost ?? 1e9));
  return a;
}
function renderList() {
  const arr = sortedStations(), mn = lastT.min;
  box.innerHTML = stationsHTML(arr, { mn, mx: lastMax, L: lastL });
  box.querySelectorAll('.st').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const d = el.querySelector('.detail'); d.hidden = !d.hidden; el.setAttribute('aria-expanded', !d.hidden);
    focusMarker(+el.dataset.i);
  }));
  box.querySelectorAll('.st').forEach(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); const d = el.querySelector('.detail'); d.hidden = !d.hidden; el.setAttribute('aria-expanded', !d.hidden);
      focusMarker(+el.dataset.i);
    }
  }));
  drawPlan(arr);
}
export function shouldUseLeaflet({ mode, hasL, tilesOK, online }) {
  return mode === 'carte' && !!hasL && tilesOK !== false && online !== false;
}
export function choosePlan(o) {
  return shouldUseLeaflet(o) ? 'leaflet' : 'svg';
}
export const PLAN_ZOOM_SINGLE = 15, PLAN_ZOOM_EMPTY = 14;
export function leafletPlan(arr, { sel, pos }) {
  const pts = arr.map((x, i) => ({ x, i })).filter(o => o.x.lat != null && o.x.lon != null);
  if (!pts.length) {
    if (!pos) return null;
    return { markers: [], user: pos, bounds: null, center: [pos.lat, pos.lon], zoom: PLAN_ZOOM_EMPTY };
  }
  const pr = pts.map(o => o.x.prix), mn = Math.min(...pr), mx = Math.max(...pr);
  const markers = pts.map(({ x, i }) => ({
    i, lat: x.lat, lon: x.lon,
    html: `<div class="mk ${markerClass(x.prix, mn, mx)}${sel === i ? ' sel' : ''}">${pf2(x.prix)} €</div>`,
    popup: `<b>${pf(x.prix)} €</b><br>${esc(x.adresse)}<br>${esc(x.ville)}`,
  }));
  if (pts.length === 1 && !pos) {
    return { markers, user: null, bounds: null, center: [pts[0].x.lat, pts[0].x.lon], zoom: PLAN_ZOOM_SINGLE };
  }
  const bounds = pts.map(o => [o.x.lat, o.x.lon]);
  if (pos) bounds.push([pos.lat, pos.lon]);
  return { markers, user: pos || null, bounds, center: null, zoom: null };
}
let tilesOK = true, tileErrs = 0;
function showMapWarn() {
  const w = document.getElementById('mapwarn');
  w.textContent = 'Carte indisponible (hors ligne ou tuiles injoignables) — plan schématique affiché.';
  w.hidden = false;
}
function drawPlan(arr) {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : undefined;
  const hasL = typeof window !== 'undefined' && !!window.L;
  if (choosePlan({ mode, hasL, tilesOK, online }) === 'leaflet') {
    document.getElementById('mapwarn').hidden = true;
    drawLeaflet(arr); return;
  }
  if (mode === 'carte') showMapWarn(); else document.getElementById('mapwarn').hidden = true;
  const el = document.getElementById('map');
  const pts = arr.map((x, i) => ({ ...x, _i: i })).filter(x => x.lat != null && x.lon != null);
  if (!pts.length) { el.hidden = true; return; }
  el.hidden = false;
  const c0 = pos ? { la: pos.lat, lo: pos.lon } : { la: pts.reduce((a, x) => a + x.lat, 0) / pts.length, lo: pts.reduce((a, x) => a + x.lon, 0) / pts.length };
  const P = pts.map(x => ({ ...x, ...project(x.lat, x.lon, c0) }));
  const R = Math.max(...P.map(x => Math.hypot(x.dx, x.dy)), 0.5);
  const pr = P.map(x => x.prix), mn = Math.min(...pr), mx = Math.max(...pr);
  el.innerHTML = planSVG(P, { R, mn, mx, sel, centerLabel: pos ? 'Toi' : 'Zone' });
  el.querySelectorAll('circle[data-id]').forEach(o => {
    o.addEventListener('click', () => selectStation(+o.dataset.id));
    o.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectStation(+o.dataset.id); } });
  });
}
function selectStation(i) {
  sel = i;
  box.querySelectorAll('.st').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
  const card = box.querySelector(`.st[data-i="${i}"]`);
  if (card) {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    card.querySelector('.detail').hidden = false; card.setAttribute('aria-expanded', 'true');
  }
  if (lastS) drawPlan(sortedStations());
}
let lmap = null, llayer = null, lmarkers = [];
function focusMarker(i) {
  if (mode !== 'carte' || !lmap || typeof window === 'undefined' || !window.L) return;
  const f = lmarkers.find(o => o.i === i);
  if (!f) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  lmap.setView(f.m.getLatLng(), Math.max(lmap.getZoom(), 14), { animate: smooth });
  lmarkers.forEach(o => {
    const e = o.m.getElement() && o.m.getElement().querySelector('.mk');
    if (e) e.classList.toggle('sel', o.i === i);
  });
}
function drawLeaflet(arr) {
  const el = document.getElementById('map');
  const plan = leafletPlan(arr, { sel, pos });
  if (!plan) { el.hidden = true; return; }
  el.hidden = false;
  if (!lmap) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    lmap = window.L.map('map', { dragging: !coarse, tap: !coarse, touchZoom: true, scrollWheelZoom: false });
    const tl = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    tl.on('tileerror', () => {
      if (++tileErrs >= 4 && tilesOK) {
        tilesOK = false;
        showMapWarn();
        if (lastS) drawPlan(sortedStations());
      }
    });
    tl.addTo(lmap);
  }
  if (llayer) llayer.clearLayers(); else llayer = window.L.layerGroup().addTo(lmap);
  lmarkers = plan.markers.map(d => {
    const m = window.L.marker([d.lat, d.lon], { icon: window.L.divIcon({ className: '', html: d.html, iconSize: null }) }).addTo(llayer);
    m.bindPopup(d.popup);
    m.on('click', () => selectStation(d.i));
    return { i: d.i, m };
  });
  if (plan.user) {
    window.L.circleMarker([plan.user.lat, plan.user.lon], { radius: 8, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 1 }).addTo(llayer).bindPopup('Toi');
  }
  if (plan.bounds) lmap.fitBounds(plan.bounds, { padding: [30, 30] });
  else lmap.setView(plan.center, plan.zoom);
  setTimeout(() => lmap.invalidateSize(), 100);
}

const getA = () => { try { return JSON.parse(localStorage.getItem('alertes') || '[]') } catch { return [] } };
const setA = a => localStorage.setItem('alertes', JSON.stringify(a));
function renderA() {
  const a = getA();
  alBox.innerHTML = a.length ? a.map((x, i) => `<div class="st"><div class="top"><b>${esc(x.cp)} · ${esc(x.carburant).toUpperCase()} · ≤ ${pf(x.seuil)} €</b><button class="icon-btn" data-i="${i}">✕</button></div></div>`).join('') : '<span class="addr">Aucune alerte.</span>';
  alBox.querySelectorAll('button').forEach(b => b.onclick = () => { if (!confirm('Supprimer cette alerte ?')) return; const l = getA(); l.splice(+b.dataset.i, 1); setA(l); renderA(); });
}
async function checkAlertes(cp, carb) {
  const list = getA().filter(x => x.cp === cp && x.carburant === carb), el = document.getElementById('notif');
  el.hidden = true; if (!list.length || !cp) return;
  for (const a of list) {
    try {
      const r = await fetch(`/alertes/check?cp=${a.cp}&carburant=${a.carburant}&seuil=${a.seuil}`), d = await jd(r);
      if (r.ok && d.declenchee) {
        el.hidden = false;
        el.innerHTML = `<b>🔔 Alerte prix : ${pf(d.min)} € ≤ ${pf(a.seuil)} € (${esc(cp)} · ${esc(carb).toUpperCase()})</b>`;
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Prix sous le seuil', { body: `${carb.toUpperCase()} à ${pf(d.min)} € (${cp})` });
        break;
      }
    } catch { /* ignore */ }
  }
}

// ---------- câblage (navigateur uniquement) ----------
if (hasDOM) {
  f = document.getElementById('f'); msg = document.getElementById('msg');
  box = document.getElementById('stations'); cards = document.getElementById('cards');
  fa = document.getElementById('fa'); msga = document.getElementById('msga');
  alBox = document.getElementById('alertes');

  document.getElementById('loc').addEventListener('click', () => {
    if (!navigator.geolocation) { msg.textContent = 'Géolocalisation non supportée.'; msg.className = 'err'; return; }
    msg.textContent = 'Localisation…'; msg.className = '';
    navigator.geolocation.getCurrentPosition(p => {
      pos = { lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) };
      document.getElementById('cp').disabled = true;
      document.getElementById('geo').style.display = 'flex';
      msg.textContent = 'Position détectée, clique Rechercher.'; msg.className = '';
    }, () => { msg.textContent = 'Position refusée ou indisponible.'; msg.className = 'err'; });
  });
  document.getElementById('unclear').addEventListener('click', e => {
    e.preventDefault();
    pos = null; document.getElementById('cp').disabled = false;
    document.getElementById('geo').style.display = 'none';
  });
  document.getElementById('dt').addEventListener('change', e => {
    document.getElementById('dopts').style.display = e.target.checked ? 'flex' : 'none';
  });
  document.querySelectorAll('#sortTabs button').forEach(b => b.addEventListener('click', () => {
    sort = b.dataset.s;
    document.querySelectorAll('#sortTabs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (lastS) renderList();
  }));
  document.querySelectorAll('#mapTabs button').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.m;
    document.querySelectorAll('#mapTabs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (lastS) drawPlan(sortedStations());
  }));

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const carb = document.getElementById('carb').value,
      useD = document.getElementById('dt').checked,
      kp = document.getElementById('kp').value, kl = document.getElementById('kl').value,
      co = document.getElementById('co').value || '6.5', vo = document.getElementById('vo').value || '50';
    if (!pos && !document.getElementById('cp').value.trim()) { msg.textContent = 'Indique un code postal ou localise-toi.'; msg.className = 'err'; return; }
    if (ctl) ctl.abort();
    ctl = new AbortController(); const my = ++req, sig = ctl.signal;
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    box.innerHTML = ''; cards.hidden = true; document.getElementById('detour').hidden = true; sel = null;
    tilesOK = true; tileErrs = 0; document.getElementById('mapwarn').hidden = true;
    document.getElementById('notif').hidden = true; document.getElementById('prev').hidden = true;
    document.getElementById('map').hidden = true;
    msg.textContent = 'Recherche en cours…'; msg.className = '';
    let zl = '', zcp = '';
    try {
      let url = `/stations?${zoneP()}&carburant=${carb}`;
      if (useD && kp !== '' && kl !== '') url += `&km_proche=${encodeURIComponent(kp)}&km_loin=${encodeURIComponent(kl)}&conso=${co}&plein=${vo}`;
      const [rS, rT, rP] = await Promise.all([fetch(url, { signal: sig }), fetch(`/stats?${zoneP()}&carburant=${carb}`, { signal: sig }), fetch(`/prevision?${zoneP()}&carburant=${carb}`, { signal: sig })]);
      if (my !== req) return;
      const s = await jd(rS), t = await jd(rT);
      if (!rS.ok) {
        const et = errorText(rS.status, s);
        if (et.kind === 'empty') { msg.textContent = et.text; msg.className = ''; btn.disabled = false; return; }
        throw new Error(et.text);
      }
      try {
        const p = await jd(rP);
        if (rP.ok) {
          const el = document.getElementById('prev'); el.hidden = false;
          el.innerHTML = `<b>${p.conseil}</b><br><span class="addr">${previsionLine(p)}</span>`;
        }
      } catch { /* prévision optionnelle */ }
      document.getElementById('c-moy').textContent = pf(t.moyenne) + ' €';
      document.getElementById('c-min').textContent = pf(t.min) + ' €';
      document.getElementById('c-max').textContent = pf(t.max) + ' €';
      cards.hidden = false; lastStations = s.stations;
      zl = zoneL(); zcp = pos ? (s.stations[0].cp || '') : document.getElementById('cp').value.trim();
      document.getElementById('a-cp').value = zcp; document.getElementById('a-carb').value = carb;
      msg.textContent = `${t.nombre} station(s) — ${zl} · ${carb.toUpperCase()}`;
      const max = t.max, per = s.prix_perimes || 0, rup = (s.ruptures || []).length;
      const ouv = s.stations.filter(x => x.affluence && x.affluence.ouvert).length;
      if (per || rup) msg.textContent += ` · ${per ? per + ' prix de + de 7 j' : ''}${per && rup ? ' · ' : ''}${rup ? rup + ' station(s) en rupture' : ''}`;
      msg.textContent += ` · ${ouv}/${s.stations.length} ouverte(s)`;
      if (s.detour) {
        const d = s.detour, el = document.getElementById('detour'), lo = d.station_loin;
        el.hidden = false;
        el.innerHTML = `<b>${d.vaut_le_coup ? '✅' : '❌'} ${d.message}</b><br><span class="addr">${esc(lo.adresse)} · ${esc(lo.ville)} · à ${String(lo.distance_km).replace('.', ',')} km · Plein : <span class="led sm">${pf2(lo.total_cost)} €</span> détour inclus · Économie vs plus proche : <span class="led sm">${d.economy_vs_nearest >= 0 ? '+' : ''}${pf2(d.economy_vs_nearest)} €</span></span>`;
      }
      lastS = s.stations; lastT = t; lastMax = t.max; lastL = +vo || 50;
      renderList();
      if (my === req) btn.disabled = false;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (my !== req) return;
      btn.disabled = false;
      msg.textContent = (err instanceof TypeError) ? 'Impossible de joindre le serveur. Vérifie ta connexion.' : (err && err.message ? err.message : 'Erreur inattendue.');
      msg.className = 'err';
    }
    checkAlertes(zcp, carb);
  });

  fa.addEventListener('submit', async e => {
    e.preventDefault();
    const carb = document.getElementById('a-carb').value,
      cp = document.getElementById('a-cp').value.trim(),
      seuil = parseFloat(document.getElementById('seuil').value);
    document.getElementById('e-cp').textContent = '';
    document.getElementById('e-seuil').textContent = '';
    msga.textContent = ''; msga.className = '';
    let ok = true;
    if (!/^\d{5}$/.test(cp)) { document.getElementById('e-cp').textContent = 'Code postal invalide : 5 chiffres attendus.'; ok = false; }
    if (!(seuil > 0)) { document.getElementById('e-seuil').textContent = 'Seuil invalide : entre un prix supérieur à 0.'; ok = false; }
    if (!ok) return;
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    const l = getA();
    if (!l.some(x => x.cp === cp && x.carburant === carb && +x.seuil === seuil)) l.push({ cp, carburant: carb, seuil });
    setA(l); renderA(); msga.textContent = `Alerte créée : ${cp} · ${carb.toUpperCase()} ≤ ${pf(seuil)} €.`; msga.className = '';
    checkAlertes(cp, carb);
  });

  renderA();
  f.requestSubmit();
}
