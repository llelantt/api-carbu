/* Front de l'API Carburants.
 * Fonctions pures exportées pour les tests (vitest) ; le câblage DOM
 * ne s'exécute que dans le navigateur (garde hasDOM). */

// ---------- formats & échappement ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pf = n => Number(n).toFixed(3).replace('.', ',');
export const pf2 = n => Number(n).toFixed(2).replace('.', ',');
export const ruptureLabel = r => ({ definitive: 'définitive', temporaire: 'temporaire' }[r] || r);

// ---------- plan SVG ----------
export function markerClass(p, mn, mx) {
  if (!(mx > mn)) return 'mk0';
  return 'mk' + Math.min(4, Math.round(4 * (p - mn) / (mx - mn)));
}
// ---------- rendu ----------
export const openState = a => {
  if (!a) return 'unknown';
  if (a.is_24h) return '24h';
  if (a.ouvert === true) return 'open';
  if (a.ouvert === false) return 'closed';
  return 'unknown';
};
export const affBadge = a => {
  const s = openState(a);
  const st = {
    '24h': '<span class="badge st-open">Ouvert 24h/24</span>',
    open: '<span class="badge st-open">Ouvert</span>',
    closed: '<span class="badge st-closed">Fermé</span>',
    unknown: '<span class="badge st-unknown">Horaires inconnus</span>',
  }[s];
  const stateLabel = { '24h': 'ouverte 24h/24', open: 'ouverte', closed: 'fermée', unknown: 'aux horaires inconnus' }[s];
  const affLabel = (a && a.niveau && a.niveau !== 'fermé') ? `, affluence ${a.niveau}` : '';
  const aff = affLabel
    ? `<span class="badge ${{ fluide: 'fl', 'modérée': 'mo', dense: 'de' }[a.niveau] || 'fe'} aff">Affluence ${a.niveau}</span>`
    : '';
  return `<span role="img" aria-label="Station ${stateLabel}${affLabel}">${st}${aff}</span>`;
};
export const validCoords = (lat, lon) =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
export const isApple = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|Macintosh|Mac OS/i.test(navigator.userAgent || '');
};
export const navItems = x => {
  let apps;
  if (validCoords(x.lat, x.lon)) {
    const ll = `${x.lat},${x.lon}`;
    apps = [
      { name: 'Waze', href: `https://waze.com/ul?ll=${ll}&navigate=yes` },
      { name: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${ll}` },
      { name: 'Plans', href: `https://maps.apple.com/?daddr=${ll}&dirflg=d` },
    ];
  } else {
    const q = [x.adresse, x.ville].filter(Boolean).join(' ').trim();
    if (!q) return ['Waze', 'Google Maps', 'Plans'].map(name => ({ name, href: null }));
    const dest = encodeURIComponent(q);
    apps = [
      { name: 'Waze', href: `https://waze.com/ul?q=${dest}&navigate=yes` },
      { name: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${dest}` },
      { name: 'Plans', href: `https://maps.apple.com/?daddr=${dest}&dirflg=d` },
    ];
  }
  return isApple() ? [apps[2], apps[0], apps[1]] : [apps[0], apps[1], { ...apps[2], name: 'Plans (Apple)' }];
};
export async function copyAddr(text) {
  const done = ok => {
    const m = document.getElementById('copy-msg');
    if (!m) return;
    m.textContent = ok ? 'Adresse copiée' : 'Copie impossible : sélectionne l’adresse manuellement.';
    m.hidden = false;
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      done(true);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      done(!!ok);
    }
  } catch {
    done(false);
  }
}
export const navLink = ({ name, href }) => href
  ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>`
  : `<span class="off" aria-disabled="true">${name}</span>`;
export const navUrls = x => Object.fromEntries(navItems(x).filter(i => i.href).map(i => [i.name, i.href]));
export const navLinks = x => 'Y aller : ' + navItems(x).map(navLink).join('');
export function sheetLinks(x) {
  return navItems(x).map(navLink).join('');
}
export function copyButton(x) {
  const addr = [x.adresse, x.ville].filter(Boolean).join(' ').trim();
  return addr
    ? `<button type="button" class="copy" data-copy="${esc(addr)}">Copier l’adresse</button>`
    : `<button type="button" class="copy" disabled aria-disabled="true">Copier l’adresse</button>`;
}
let sheetTrigger = null;
export function openSheet(x, trigger) {
  if (!x) return;
  const hasPlace = x.adresse || x.ville || x.enseigne || x.nom || (x.lat != null && x.lon != null);
  if (!hasPlace) return;
  const card = document.getElementById('sheet-card');
  card.innerHTML = `<h2 id="sheet-title">${esc(x.enseigne || x.nom || x.adresse) || 'Station'}</h2>`
    + `<p class="addr">${esc(x.adresse)} · ${esc(x.ville)}</p>`
    + sheetLinks(x)
    + copyButton(x)
    + `<p class="addr" id="copy-msg" hidden></p>`
    + `<button type="button" class="cancel" id="sheet-cancel">Annuler</button>`;
  document.getElementById('sheet').hidden = false;
  sheetTrigger = trigger || null;
  document.getElementById('sheet-cancel').addEventListener('click', closeSheet);
  const cb = card.querySelector('.copy');
  if (cb && cb.dataset.copy) cb.addEventListener('click', () => copyAddr(cb.dataset.copy));
  const first = card.querySelector('a,button');
  if (first) first.focus();
}
export function closeSheet() {
  document.getElementById('sheet').hidden = true;
  if (sheetTrigger && sheetTrigger.focus) sheetTrigger.focus();
  sheetTrigger = null;
}
export function initSheet() {
  document.getElementById('sheet').addEventListener('click', e => {
    if (e.target.id === 'sheet') closeSheet();
  });
  document.getElementById('sheet-card').addEventListener('click', e => {
    if (e.target.closest('a')) closeSheet();
  });
  document.getElementById('sheet-card').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const items = [...document.querySelectorAll('#sheet-card a[href], #sheet-card button')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('sheet').hidden) closeSheet();
  });
}
export function setTestState({ stations, stats, plein = 50 }) {
  lastS = stations; lastT = stats; lastMax = stats.max; lastL = plein;
}
export const FUEL_ORDER = ['gazole', 'sp95', 'e10', 'sp98', 'e85', 'gplc'];
export const fuelName = c => ({ gazole: 'Gazole', sp95: 'SP95', e10: 'E10', sp98: 'SP98', e85: 'E85', gplc: 'GPLc' }[c] || c);
export const fuelsRows = (x, carb = '') => Object.entries(x.carburants || {})
  .sort(([a], [b]) => FUEL_ORDER.indexOf(a) - FUEL_ORDER.indexOf(b))
  .map(([c, f]) => `<div class="fuel${c === carb ? ' cur' : ''}"><span>${fuelName(c)}</span><span>${f.prix != null ? `<span class="led sm">${pf(f.prix)} €</span>` : '<span class="dash">—</span>'}</span><span>${f.perime ? `<span class="badge old">Prix ancien (${f.jours} j)</span>` : ''}${f.rupture ? `<span class="badge rup">Rupture ${esc(ruptureLabel(f.rupture))}</span>` : ''}</span></div>`).join('');
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
export function stationsHTML(arr, { mn, mx, L, carb = '' }) {
  return arr.map((x, i) => `
<div class="st" data-i="${i}" tabindex="0" role="button"><div class="top"><span class="rk">${i + 1}</span><span class="prix">${pf(x.prix)}<small>€/L</small></span>
${x.prix === mn ? '<span class="badge">Meilleur prix</span>' : ''}</div>
<div><b>${esc(x.enseigne || x.nom || x.adresse) || 'Adresse inconnue'}</b></div>
<div class="addr">${(x.enseigne || x.nom) && x.adresse ? esc(x.adresse) + ' · ' : ''}${esc(x.ville)}${x.distance_km != null ? ` · à ${String(x.distance_km).replace('.', ',')} km` : ''} · ${x.date ? new Date(x.date).toLocaleDateString('fr-FR') : ''}${x.jours != null ? ` · il y a ${x.jours} j` : ''}</div>
<div class="fiab">${x.perime ? `<span class="badge old">Prix vieux de ${x.jours} j</span>` : ''}${x.rupture ? `<span class="badge rup">Rupture ${esc(ruptureLabel(x.rupture))}</span>` : ''}${x.affluence ? affBadge(x.affluence) : ''}</div>
<div class="tot">Plein ${L} L : ${pf2(x.total_cost)} €${x.distance_km != null ? ' détour inclus' : ''}</div>
<div class="eco">${x.prix === mn ? '—' : `Économie : ${pf2((mx - x.prix) * L)} € sur un plein de ${L} L`}</div>
<div class="detail" hidden>
<div class="fuels">${fuelsRows(x, carb)}</div>
${(x.services || []).length ? `<div class="fiab">${x.services.map(s => `<span class="badge">${esc(s)}</span>`).join('')}</div>` : ''}
<div class="curve">${curve(x.histo)}</div>
</div>
<div class="go">Y aller ›</div>
</div>`).join('');
}
export function suggestHTML(fs) {
  return (fs || []).map((f, i) => `<button type="button" data-i="${i}">${esc(f.properties && f.properties.label || 'Adresse')}</button>`).join('');
}
export function zoneSentence(nombre, dist, lieu, carb) {
  return `${nombre} station(s) dans un rayon de ${dist} km autour de ${lieu} · ${carb.toUpperCase()}`;
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
let sort = 'tot', lastS = null, lastT = null, lastMax = 0, lastL = 50, lastCarb = '';
let lastCenter = null, lastDist = 0;
let sel = null, ctl = null, req = 0;
const jd = async r => { try { return await r.json() } catch { return {} } };

const getDist = () => document.getElementById('dist').value;
const zoneP = () => {
  const z = pos ? `lat=${pos.lat}&lon=${pos.lon}` : `cp=${encodeURIComponent(document.getElementById('cp').value.trim())}`;
  const d = getDist();
  return z + ((d !== '' && d != null) ? `&dist=${encodeURIComponent(d)}` : '');
};
const zoneL = () => {
  const d = getDist();
  return pos ? `autour de moi (${d || 10} km)` : document.getElementById('cp').value.trim() + (d ? ` · rayon ${d} km` : '');
};

function sortedStations() {
  const a = [...lastS];
  if (sort === 'pr') a.sort((x, y) => x.prix - y.prix);
  else if (sort === 'd') a.sort((x, y) => (x.distance_km ?? 1e9) - (y.distance_km ?? 1e9));
  else a.sort((x, y) => (x.total_cost ?? 1e9) - (y.total_cost ?? 1e9));
  return a;
}
export function renderList() {
  const arr = sortedStations(), mn = lastT.min;
  const bx = box || document.getElementById('stations');
  bx.innerHTML = stationsHTML(arr, { mn, mx: lastMax, L: lastL, carb: lastCarb });
  bx.querySelectorAll('.st').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('a,button')) return;
    const x = sortedStations()[+el.dataset.i];
    if (x) openSheet(x, el);
  }));
  bx.querySelectorAll('.st').forEach(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const x = sortedStations()[+el.dataset.i];
      if (x) openSheet(x, el);
    }
  }));
  drawPlan(arr);
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
    popup: `<b>${pf(x.prix)} €${(x.enseigne || x.nom) ? ' · ' + esc(x.enseigne || x.nom) : ''}</b><br>${esc(x.adresse)}<br>${esc(x.ville)}`,
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
  w.textContent = 'Carte indisponible (hors ligne ou tuiles injoignables).';
  w.hidden = false;
}
function drawPlan(arr) {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : undefined;
  const hasL = typeof window !== 'undefined' && !!window.L;
  if (!hasL || online === false) {
    showMapWarn();
    document.getElementById('map').hidden = true;
    return;
  }
  if (!tilesOK) showMapWarn(); else document.getElementById('mapwarn').hidden = true;
  drawLeaflet(arr);
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
let lmap = null, llayer = null;
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
  if (lastCenter) window.L.circle([lastCenter.lat, lastCenter.lon], { radius: lastDist * 1000, color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.08, interactive: false }).addTo(llayer);
  plan.markers.forEach(d => {
    const m = window.L.marker([d.lat, d.lon], { icon: window.L.divIcon({ className: '', html: d.html, iconSize: null }) }).addTo(llayer);
    m.bindPopup(d.popup);
    m.on('click', () => selectStation(d.i));
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
      document.getElementById('cp').value = '';
      document.getElementById('adr').value = '';
      document.getElementById('sugg').innerHTML = '';
      document.getElementById('geo').style.display = 'flex';
      msg.textContent = 'Position détectée, clique Rechercher.'; msg.className = '';
    }, () => { msg.textContent = 'Position refusée ou indisponible.'; msg.className = 'err'; });
  });
  document.getElementById('unclear').addEventListener('click', e => {
    e.preventDefault();
    pos = null;
    document.getElementById('geo').style.display = 'none';
    document.getElementById('adr').value = '';
    document.getElementById('sugg').innerHTML = '';
  });
  document.getElementById('cp').addEventListener('input', () => {
    if (pos) {
      pos = null;
      document.getElementById('geo').style.display = 'none';
      document.getElementById('adr').value = '';
      document.getElementById('sugg').innerHTML = '';
    }
  });
  let sugT = null, sugCtl = null, lastFs = [];
  const renderSugg = fs => {
    lastFs = fs;
    const bx = document.getElementById('sugg');
    bx.innerHTML = suggestHTML(fs);
    bx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => pickAddr(+b.dataset.i)));
  };
  const pickAddr = i => {
    const f = lastFs[i];
    if (!f || !f.geometry) return;
    const [lon, lat] = f.geometry.coordinates;
    pos = { lat: +lat.toFixed(4), lon: +lon.toFixed(4) };
    document.getElementById('cp').value = '';
    document.getElementById('adr').value = f.properties.label;
    document.getElementById('sugg').innerHTML = '';
    document.getElementById('geo').style.display = 'flex';
    msg.textContent = 'Adresse détectée, clique Rechercher.'; msg.className = '';
  };
  document.getElementById('adr').addEventListener('input', e => {
    const q = e.target.value.trim();
    clearTimeout(sugT);
    if (pos) {
      pos = null;
      document.getElementById('geo').style.display = 'none';
    }
    if (sugCtl) sugCtl.abort();
    if (q.length < 3) { document.getElementById('sugg').innerHTML = ''; return; }
    sugT = setTimeout(async () => {
      try {
        sugCtl = new AbortController();
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`, { signal: sugCtl.signal });
        const d = await r.json();
        if ((d.features || []).length) renderSugg(d.features);
        else document.getElementById('sugg').innerHTML = '<span class="addr">Adresse introuvable, utilise le code postal.</span>';
      } catch (err) { if (!err || err.name !== 'AbortError') document.getElementById('sugg').innerHTML = '<span class="addr">Géocodage indisponible, utilise le code postal.</span>'; }
    }, 300);
  });
  document.getElementById('dt').addEventListener('change', e => {
    document.getElementById('dopts').style.display = e.target.checked ? 'flex' : 'none';
  });
  initSheet();
  document.querySelectorAll('#sortTabs button').forEach(b => b.addEventListener('click', () => {
    sort = b.dataset.s;
    document.querySelectorAll('#sortTabs button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (lastS) renderList();
  }));

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const carb = document.getElementById('carb').value,
      useD = document.getElementById('dt').checked,
      kp = document.getElementById('kp').value, kl = document.getElementById('kl').value,
      co = document.getElementById('co').value || '6.5', vo = document.getElementById('vo').value || '50';
    if (!pos && !document.getElementById('cp').value.trim()) { msg.textContent = 'Indique un code postal ou localise-toi.'; msg.className = 'err'; return; }
    const dd = getDist();
    if (dd !== '' && !(+dd > 0 && +dd <= 100)) { msg.textContent = 'Rayon invalide : entre 1 et 100 km.'; msg.className = 'err'; return; }
    if (ctl) ctl.abort();
    ctl = new AbortController(); const my = ++req, sig = ctl.signal;
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    box.innerHTML = ''; cards.hidden = true; document.getElementById('detour').hidden = true; sel = null;
    document.getElementById('sheet').hidden = true;
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
      const lieu = (s.centre && s.centre.label) ? s.centre.label : (pos ? 'ta position' : document.getElementById('cp').value.trim());
      msg.textContent = zoneSentence(t.nombre, s.position.dist, lieu, carb);
      if (s.stations.length === 1) msg.textContent += ' · Peu de résultats : essaie un rayon plus grand ou un autre carburant.';
      const max = t.max, per = s.prix_perimes || 0, rup = (s.ruptures || []).length;
      const ouv = s.stations.filter(x => { const o = openState(x.affluence); return o === 'open' || o === '24h'; }).length;
      if (per || rup) msg.textContent += ` · ${per ? per + ' prix de + de 7 j' : ''}${per && rup ? ' · ' : ''}${rup ? rup + ' station(s) en rupture' : ''}`;
      msg.textContent += ` · ${ouv}/${s.stations.length} ouverte(s)`;
      if (s.detour) {
        const d = s.detour, el = document.getElementById('detour'), lo = d.station_loin;
        el.hidden = false;
        el.innerHTML = `<b>${d.vaut_le_coup ? '✅' : '❌'} ${d.message}</b><br><span class="addr">${esc(lo.adresse)} · ${esc(lo.ville)} · à ${String(lo.distance_km).replace('.', ',')} km · Plein : <span class="led sm">${pf2(lo.total_cost)} €</span> détour inclus · Économie vs plus proche : <span class="led sm">${d.economy_vs_nearest >= 0 ? '+' : ''}${pf2(d.economy_vs_nearest)} €</span></span>`;
      }
      lastS = s.stations; lastT = t; lastMax = t.max; lastL = +vo || 50; lastCarb = carb;
      if (s.position) { lastCenter = { lat: s.position.lat, lon: s.position.lon }; lastDist = s.position.dist; }
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
  if (document.getElementById('cp').value.trim()) f.requestSubmit();
}
