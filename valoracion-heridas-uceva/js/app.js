/* =========================================================================
   app.js — Navegación, buscador y vistas del estudiante
   ========================================================================= */

const APP = { user: { role: 'guest' }, route: 'inicio', calendarDate: new Date() };
const SESSION_KEY = 'hcv_session_role';

/* ------------------------------- Utilidades ------------------------------- */
function $(s, c) { return (c || document).querySelector(s); }
function $all(s, c) { return Array.from((c || document).querySelectorAll(s)); }
function el(tag, attrs, children) {
  const n = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  });
  (children || []).forEach(c => c != null && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function parseDate(iso) { if (!iso) return null; const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso); return isNaN(d) ? null : d; }
function fmtDate(iso, long) {
  const d = parseDate(iso); if (!d) return iso || '—';
  return d.toLocaleDateString('es-CO', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' });
}
function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function toast(msg, type) {
  const t = el('div', { class: 'toast ' + (type || '') }, [msg]);
  $('#toastStack').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3200);
}
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) {
  $('#' + id).classList.remove('open');
  if (id === 'viewerModal') $('#viewerBody').innerHTML = ''; // detiene audio/video al cerrar
}
$all('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.closeModal)));
$all('.modal-overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $all('.modal-overlay.open').forEach(m => closeModal(m.id)); });
function emptyState(icon, title, text) { return `<div class="empty-state"><div class="icon">${icon}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`; }
function svgIcon(id, size) { return `<svg width="${size || 16}" height="${size || 16}"><use href="#${id}"/></svg>`; }

/* --------------------------- Visor en pantalla --------------------------- */
function canvaEmbed(url) {
  const m = (url || '').match(/canva\.com\/design\/([\w-]+)\/([\w-]+)/);
  return m ? `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed` : null;
}
function embedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return 'https://www.youtube.com/embed/' + yt[1];
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return 'https://drive.google.com/file/d/' + drive[1] + '/preview';
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return 'https://player.vimeo.com/video/' + vimeo[1];
  return canvaEmbed(url);
}
function guessMedia(url, media) {
  if (media) return media;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video';
  if (/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(url)) return 'audio';
  if (/\.pdf(\?|$)/i.test(url) || /^data:application\/pdf/.test(url)) return 'pdf';
  if (/\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(url) || /^data:image\//.test(url)) return 'imagen';
  return 'enlace';
}
function openViewer(title, url, media) {
  $('#viewerTitle').textContent = title || 'Visor';
  const body = $('#viewerBody'); body.innerHTML = '';
  if (!url) { body.innerHTML = emptyState('📄', 'Sin enlace configurado', 'El docente aún no ha agregado el archivo o el enlace de este recurso.'); openModal('viewerModal'); return; }
  const kind = guessMedia(url, media);
  const fallback = el('p', { class: 'viewer-foot' }, [
    el('a', { class: 'btn btn-outline btn-sm', href: url, target: '_blank', rel: 'noopener' }, ['Abrir en pestaña nueva ↗']),
    (kind === 'pdf' || kind === 'imagen' || kind === 'audio' || kind === 'video') ? el('a', { class: 'btn btn-primary btn-sm', href: url, download: '', target: '_blank', rel: 'noopener' }, ['Descargar']) : null
  ]);
  if (kind === 'video') {
    const v = el('video', { src: url, controls: '', playsinline: '', preload: 'metadata', class: 'viewer-media' });
    v.addEventListener('error', () => showMediaError(body, url));
    body.appendChild(v);
  } else if (kind === 'audio') {
    body.appendChild(el('div', { class: 'audio-box' }, [el('div', { class: 'audio-icon' }, ['🎙️'])]));
    const a = el('audio', { src: url, controls: '', preload: 'metadata', class: 'viewer-audio' });
    a.addEventListener('error', () => showMediaError(body, url));
    body.appendChild(a);
  } else if (kind === 'imagen') {
    body.appendChild(el('img', { src: url, alt: title || 'Imagen', class: 'viewer-img' }));
  } else if (kind === 'pdf') {
    body.appendChild(el('iframe', { src: url, class: 'viewer-frame', title: title || 'Documento' }));
  } else {
    const embed = embedUrl(url);
    if (embed) body.appendChild(el('iframe', { src: embed, class: 'viewer-frame', allowfullscreen: 'true', allow: 'fullscreen', title: title || 'Contenido' }));
    else body.innerHTML = emptyState('🔗', 'Este contenido se abre en su sitio original', 'El sitio no permite mostrarse dentro de esta página. Usa el botón para abrirlo.');
  }
  body.appendChild(fallback);
  openModal('viewerModal');
}
function showMediaError(body, url) {
  if (body.querySelector('.media-error')) return;
  body.insertBefore(el('div', { class: 'media-error', html: '⚠️ No se pudo cargar el archivo desde su origen. Prueba abrirlo en una pestaña nueva o avisa al docente para revisar el enlace.' }), body.firstChild);
}

/* --------------------------------- Rutas --------------------------------- */
const ROUTES = ['inicio', 'presentacion', 'objetivo', 'programacion', 'recursos', 'clases', 'biblioteca', 'casos', 'resvech', 'calendario', 'faq', 'contacto', 'perfil', 'docente'];
const RENDER = {};

function navigate(route, after) {
  if (!ROUTES.includes(route)) route = 'inicio';
  if (route === 'docente' && APP.user.role !== 'teacher') { openLogin(true); return; }
  APP.route = route;
  if (location.hash !== '#/' + route) history.pushState(null, '', '#/' + route);
  renderRoute();
  if (after) setTimeout(after, 60);
}
function renderRoute() {
  $all('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + APP.route));
  $all('.nav-item, .bn-item').forEach(b => b.classList.toggle('active', b.dataset.route === APP.route));
  $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show');
  window.scrollTo({ top: 0 });
  if (RENDER[APP.route]) RENDER[APP.route]();
  updateProgressUI();
}
window.addEventListener('popstate', () => {
  const r = location.hash.replace('#/', '') || 'inicio';
  if (r === 'docente' && APP.user.role !== 'teacher') { openLogin(true); return; }
  APP.route = ROUTES.includes(r) ? r : 'inicio'; renderRoute();
});
document.addEventListener('click', e => {
  const r = e.target.closest('[data-route]'); if (r) { navigate(r.dataset.route); return; }
  const g = e.target.closest('[data-goto]'); if (g) { navigate(g.dataset.goto); return; }
  const a = e.target.closest('a[href^="#/"]'); if (a) { e.preventDefault(); navigate(a.getAttribute('href').slice(2)); }
});
$('#menuToggle').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#sidebarOverlay').classList.toggle('show'); });
$('#sidebarOverlay').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); });
function flash(node) { if (!node) return; node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.classList.add('flash'); setTimeout(() => node.classList.remove('flash'), 1800); }

/* --------------------------------- Sesión --------------------------------- */
function setUserUI() {
  const t = APP.user.role === 'teacher';
  $('#navDocente').style.display = t ? 'flex' : 'none';
  $('#teacherNavLabel').style.display = t ? 'block' : 'none';
  const p = DB.getProfile();
  $('#userAvatar').textContent = t ? 'DO' : initials(p.nombre);
  $('#userLabel').textContent = t ? 'Docente' : APP.user.role === 'student' ? (p.nombre || 'Estudiante') : 'Invitado';
}
function initials(n) { return (n || 'Estudiante').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'ES'; }
function openLogin(teacher) {
  $('#teacherLoginForm').style.display = teacher ? 'block' : 'none';
  openModal('loginModal');
  if (teacher) setTimeout(() => $('#teacherPassInput').focus(), 100);
}
function setRole(role) { APP.user = { role }; try { sessionStorage.setItem(SESSION_KEY, role); } catch (e) {} setUserUI(); }
$('#userChip').addEventListener('click', () => { if (APP.user.role === 'guest') openLogin(false); else navigate(APP.user.role === 'teacher' ? 'docente' : 'perfil'); });
$('#switchUserBtn').addEventListener('click', () => { setRole('guest'); navigate('inicio'); openLogin(false); });
$('#loginStudent').addEventListener('click', () => { setRole('student'); closeModal('loginModal'); toast('¡Bienvenido(a)!', 'success'); renderRoute(); });
$('#loginTeacherOpen').addEventListener('click', () => { $('#teacherLoginForm').style.display = 'block'; $('#teacherPassInput').focus(); });
$('#teacherPassSubmit').addEventListener('click', () => TEACHER.tryLogin());
$('#teacherPassInput').addEventListener('keydown', e => { if (e.key === 'Enter') TEACHER.tryLogin(); });

$('#notifBtn').addEventListener('click', () => {
  const list = DB.Announcements.all().slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 6);
  $('#viewerTitle').textContent = 'Novedades';
  $('#viewerBody').innerHTML = list.length ? list.map(a => `<div class="ann-item"><strong>${esc(a.titulo)}</strong><p class="muted">${esc(a.mensaje)}</p><small class="muted">${fmtDate(a.fecha)}</small></div>`).join('') : '<p class="muted">Sin novedades.</p>';
  openModal('viewerModal'); $('#notifDot').style.display = 'none';
});
$('#contrastBtn').addEventListener('click', () => document.body.classList.toggle('high-contrast'));

/* ------------------------------- Progreso -------------------------------- */
function progressInfo() {
  const p = DB.getProgress();
  const ses = DB.Sessions.all().map(s => s.id), res = DB.Resources.all().map(r => r.id), cas = DB.Cases.all().map(c => c.id);
  const sv = p.sesionesVistas.filter(id => ses.includes(id)).length;
  const rv = p.recursosVistos.filter(id => res.includes(id)).length;
  const cv = p.casosVistos.filter(id => cas.includes(id)).length;
  const total = ses.length + res.length + cas.length + 1;
  const done = sv + rv + cv + (p.resvech ? 1 : 0);
  return { sv, rv, cv, resvech: p.resvech, ses: ses.length, res: res.length, cas: cas.length, pct: total ? Math.round(done / total * 100) : 0 };
}
function updateProgressUI() {
  const i = progressInfo();
  $all('.js-progress-fill').forEach(f => f.style.width = i.pct + '%');
  $all('.js-progress-text').forEach(t => t.textContent = i.pct + '% completado');
  const d = $('#progressDetail');
  if (d) d.innerHTML = `<li>📅 Sesiones revisadas: <strong>${i.sv}/${i.ses}</strong></li><li>📂 Recursos revisados: <strong>${i.rv}/${i.res}</strong></li><li>🩺 Casos clínicos revisados: <strong>${i.cv}/${i.cas}</strong></li><li>📏 Escala RESVECH aplicada: <strong>${i.resvech ? 'Sí' : 'Aún no'}</strong></li>`;
}

/* --------------------------------- Inicio --------------------------------- */
RENDER.inicio = function () {
  const p = DB.getProfile();
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  $('#heroGreeting').textContent = APP.user.role === 'student'
    ? `${saludo}, ${(p.nombre || 'estudiante').split(' ')[0]}: valoremos juntos la herida crónica`
    : 'Valoración del paciente con heridas crónicas';
  const i = progressInfo();
  $('#statSesiones').textContent = i.sv + '/' + i.ses;
  $('#statRecursos').textContent = i.rv + '/' + i.res;
  $('#statCasos').textContent = i.cv + '/' + i.cas;

  const anuncios = DB.Announcements.all().slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 4);
  $('#announcementList').innerHTML = anuncios.length ? anuncios.map(a => `
    <div class="ann-item"><div class="ann-head"><strong>${esc(a.titulo)}</strong><span class="muted">${fmtDate(a.fecha)}</span></div><p class="muted">${esc(a.mensaje)}</p></div>`).join('') : '<p class="muted">No hay anuncios todavía.</p>';

  const cont = $('#continueList'); cont.innerHTML = '';
  const seen = DB.getProgress().sesionesVistas;
  const sessions = DB.Sessions.all().sort((a, b) => a.numero - b.numero);
  const next = sessions.find(s => !seen.includes(s.id));
  if (next) cont.appendChild(el('div', { class: 'card hoverable', onclick: () => navigate('programacion', () => openSession(next.id, true)) }, [
    el('div', { class: 'session-card-head' }, [el('div', { class: 'session-num' }, [String(next.numero)]),
      el('div', { class: 'session-title' }, [el('h3', {}, ['Sesión ' + next.numero + ': ' + next.tema]), el('small', {}, [fmtDate(next.fecha, true)])])])]));
  const mine = upcomingPersonal()[0];
  if (mine) cont.appendChild(el('div', { class: 'card hoverable', onclick: () => navigate('calendario') }, [
    el('div', { class: 'session-card-head' }, [el('div', { class: 'session-num' }, ['🗓️']),
      el('div', { class: 'session-title' }, [el('h3', {}, [mine.titulo]), el('small', {}, ['Mi actividad · ' + fmtDate(mine.fecha) + (mine.hora ? ' · ' + mine.hora : '')])])])]));
  if (!DB.getProgress().resvech) cont.appendChild(el('div', { class: 'card hoverable', onclick: () => navigate('resvech') }, [
    el('div', { class: 'session-card-head' }, [el('div', { class: 'session-num' }, ['📏']),
      el('div', { class: 'session-title' }, [el('h3', {}, ['Practica la escala RESVECH 2.0']), el('small', {}, ['Calculadora y simulador'])])])]));
  if (!cont.children.length) cont.innerHTML = '<p class="muted">¡Vas al día! Ya revisaste todas las sesiones.</p>';
};

/* ------------------------------ Presentación ------------------------------ */
RENDER.presentacion = function () {
  const c = DB.getConfig();
  $('#durPres').textContent = c.horasPresenciales; $('#durAut').textContent = c.horasAutonomas;
  $('#durSes').textContent = c.sesiones; $('#durTotal').textContent = (Number(c.horasPresenciales) + Number(c.horasAutonomas)) + ' horas';
};

/* ------------------------------ Programación ------------------------------ */
let openSessionId = null;
RENDER.programacion = function () {
  const wrap = $('#sessionsTimeline'); wrap.innerHTML = '';
  const sessions = DB.Sessions.all().sort((a, b) => a.numero - b.numero);
  const seen = DB.getProgress().sesionesVistas;
  if (!sessions.length) { wrap.innerHTML = emptyState('📅', 'Sin sesiones', 'El docente aún no ha publicado la programación.'); return; }
  sessions.forEach(s => {
    const open = openSessionId === s.id;
    const head = el('button', { class: 'session-card-head', type: 'button', 'aria-expanded': open ? 'true' : 'false', onclick: () => openSession(s.id) }, [
      el('div', { class: 'session-num' }, [String(s.numero)]),
      el('div', { class: 'session-title' }, [el('h3', {}, ['Sesión ' + s.numero + ': ' + s.tema]),
        el('small', {}, [fmtDate(s.fecha, true) + (s.hora ? ' · ' + s.hora : '') + (seen.includes(s.id) ? ' · ✅ revisada' : '')])])
    ]);
    head.insertAdjacentHTML('beforeend', '<svg class="chevron" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 8 5 5 5-5"/></svg>');
    const body = el('div', { class: 'session-body' }, [
      el('div', { class: 'session-detail-grid' }, [
        detail('🎯 Objetivos', s.objetivos), detail('📘 Contenido', s.contenido),
        detail('📝 Actividad', s.actividad), detail('📎 Material de apoyo', s.material)
      ]),
      el('div', { class: 'resource-actions mt12' }, [
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => openClass(s) }, ['▶ Abrir clase']),
        el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate('recursos') }, ['Ver recursos'])
      ])
    ]);
    wrap.appendChild(el('div', { class: 'timeline-item', id: 'ses-' + s.id }, [el('div', { class: 'timeline-dot' }), el('div', { class: 'card session-card' + (open ? ' open' : '') }, [head, body])]));
  });
};
function detail(t, x) { return el('div', { class: 'detail-block' }, [el('h4', {}, [t]), el('p', {}, [x || '—'])]); }
function openSession(id, force) {
  openSessionId = (openSessionId === id && !force) ? null : id;
  DB.markSeen('sesion', id); RENDER.programacion(); updateProgressUI();
  if (force) flash($('#ses-' + id));
}

/* ------------------------------ Clases (Canva) ----------------------------- */
function openClass(s) {
  DB.markSeen('sesion', s.id); updateProgressUI();
  const url = s.claseUrl;
  $('#viewerTitle').textContent = 'Sesión ' + s.numero + ': ' + s.tema;
  const body = $('#viewerBody'); body.innerHTML = '';
  if (!url) { body.innerHTML = emptyState('🖥️', 'Diapositivas aún no disponibles', 'El docente publicará aquí el enlace de Canva de esta clase.'); openModal('viewerModal'); return; }
  const embed = embedUrl(url);
  if (embed) body.appendChild(el('iframe', { src: embed, class: 'viewer-frame', allowfullscreen: 'true', allow: 'fullscreen', title: 'Diapositivas' }));
  else body.appendChild(el('div', { class: 'canva-card' }, [
    el('div', { class: 'canva-logo' }, ['Canva']),
    el('h4', {}, ['Las diapositivas de esta clase están en Canva']),
    el('p', { class: 'muted' }, ['Haz clic para abrirlas en una pestaña nueva. Para verlas aquí mismo, el docente puede pegar el enlace "Insertar" (embed) de Canva en el Panel Docente.']),
    el('code', { class: 'canva-url' }, [url])
  ]));
  body.appendChild(el('p', { class: 'viewer-foot' }, [el('a', { class: 'btn btn-primary btn-sm', href: url, target: '_blank', rel: 'noopener' }, ['Abrir diapositivas en Canva ↗'])]));
  openModal('viewerModal');
}
RENDER.clases = function () {
  const grid = $('#clasesGrid'); grid.innerHTML = '';
  DB.Sessions.all().sort((a, b) => a.numero - b.numero).forEach(s => {
    const has = !!s.claseUrl;
    const thumb = el('div', { class: 'resource-thumb' }); thumb.innerHTML = svgIcon('i-play', 30);
    grid.appendChild(el('div', { class: 'card resource-card', id: 'clase-' + s.id }, [thumb,
      el('div', {}, [el('div', { class: 'chip-row' }, [el('span', { class: 'chip blue' }, ['Sesión ' + s.numero]), el('span', { class: 'chip ' + (has ? 'green' : '') }, [has ? 'Diapositivas disponibles' : 'Próximamente'])]),
        el('h3', { class: 'card-title' }, [s.tema]), el('p', { class: 'muted small' }, [fmtDate(s.fecha, true)])]),
      el('div', { class: 'resource-actions' }, [
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => openClass(s) }, ['▶ Abrir clase']),
        has ? el('a', { class: 'btn btn-outline btn-sm', href: s.claseUrl, target: '_blank', rel: 'noopener' }, ['Canva ↗']) : null
      ])]));
  });
};

/* -------------------------------- Recursos -------------------------------- */
const RESOURCE_CATEGORIES = ['Todos', 'Videos', 'Guías', 'Libros', 'Artículos científicos', 'Infografías', 'Podcasts'];
const CAT_ICON = { Videos: '🎬', Guías: '📘', Libros: '📖', 'Artículos científicos': '🔬', Infografías: '🖼️', Podcasts: '🎙️' };
let activeResourceTab = 'Todos';
RENDER.recursos = function () {
  const tabs = $('#resourceTabs'); tabs.innerHTML = '';
  RESOURCE_CATEGORIES.forEach(c => tabs.appendChild(el('button', { class: 'tab-btn' + (activeResourceTab === c ? ' active' : ''), onclick: () => { activeResourceTab = c; RENDER.recursos(); } }, [c])));
  const all = DB.Resources.all();
  const list = activeResourceTab === 'Todos' ? all : all.filter(r => r.categoria === activeResourceTab);
  const grid = $('#resourcesGrid'); grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = emptyState('📚', 'Sin recursos en esta categoría', 'El docente puede agregarlos desde el Panel Docente.'); return; }
  const seen = DB.getProgress().recursosVistos;
  list.forEach(r => grid.appendChild(resourceCard(r, seen.includes(r.id))));
};
function resourceCard(r, seen) {
  const kind = guessMedia(r.url, r.media);
  const label = { video: '▶ Ver video', audio: '▶ Escuchar', pdf: 'Ver en pantalla', imagen: 'Ver en pantalla', enlace: 'Abrir' }[kind];
  const open = () => { DB.markSeen('recurso', r.id); openViewer(r.titulo, r.url, kind); updateProgressUI(); if (APP.route === 'recursos') RENDER.recursos(); };
  return el('div', { class: 'card resource-card', id: 'res-' + r.id }, [
    el('div', { class: 'resource-thumb' }, [CAT_ICON[r.categoria] || '📄']),
    el('div', {}, [
      el('div', { class: 'chip-row' }, [el('span', { class: 'chip green' }, [r.categoria]), r.fuente ? el('span', { class: 'chip blue' }, [r.fuente]) : null, seen ? el('span', { class: 'chip' }, ['✓ Revisado']) : null]),
      el('h3', { class: 'card-title' }, [r.titulo]),
      r.autores ? el('p', { class: 'muted small' }, [r.autores]) : null,
      el('p', { class: 'muted small mt4' }, [r.descripcion || ''])
    ]),
    el('div', { class: 'resource-actions' }, [
      kind === 'enlace'
        ? el('a', { class: 'btn btn-primary btn-sm', href: r.url || '#', target: '_blank', rel: 'noopener', onclick: () => { DB.markSeen('recurso', r.id); updateProgressUI(); } }, ['Ir al recurso ↗'])
        : el('button', { class: 'btn btn-primary btn-sm', onclick: open }, [label]),
      (kind === 'pdf' || kind === 'imagen') ? el('a', { class: 'btn btn-outline btn-sm', href: r.url, download: '', target: '_blank', rel: 'noopener' }, ['Descargar']) : null,
      r.doi ? el('a', { class: 'btn btn-ghost btn-sm', href: r.doi, target: '_blank', rel: 'noopener' }, ['DOI']) : null
    ])
  ]);
}

/* ------------------------------- Biblioteca ------------------------------- */
const BIBLIO_FILTERS = ['Todos', 'Heridas', 'Ostomías', 'Biofilm', 'Apósitos', 'NPWT', 'Lesiones por presión', 'Pie diabético', 'Quemaduras', 'Infección', 'Insuficiencia venosa', 'Desbridamiento'];
let activeBiblio = 'Todos';
RENDER.biblioteca = function () {
  const tabs = $('#biblioFilters'); tabs.innerHTML = '';
  BIBLIO_FILTERS.forEach(f => tabs.appendChild(el('button', { class: 'tab-btn' + (activeBiblio === f ? ' active' : ''), onclick: () => { activeBiblio = f; RENDER.biblioteca(); } }, [f])));
  const all = DB.Library.all().slice().sort((a, b) => BIBLIO_FILTERS.indexOf(a.tema) - BIBLIO_FILTERS.indexOf(b.tema));
  const list = activeBiblio === 'Todos' ? all : all.filter(r => norm(r.tema) === norm(activeBiblio));
  const grid = $('#biblioGrid'); grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = emptyState('🔬', 'Sin artículos en este tema', 'El docente puede agregarlos desde Panel Docente → Biblioteca.'); return; }
  list.forEach(r => grid.appendChild(el('div', { class: 'card biblio-card', id: 'lib-' + r.id }, [
    el('div', { class: 'chip-row' }, [el('span', { class: 'chip green' }, [r.tema || 'General']), r.anio ? el('span', { class: 'chip blue' }, [String(r.anio)]) : null]),
    el('h3', { class: 'card-title' }, [r.titulo]),
    el('p', { class: 'muted small' }, [(r.autores || '—') + (r.revista ? ' · ' + r.revista : '')]),
    el('p', { class: 'small mt8' }, [r.descripcion || '']),
    el('div', { class: 'resource-actions mt12' }, [
      el('a', { class: 'btn btn-primary btn-sm', href: r.url || r.doi || '#', target: '_blank', rel: 'noopener' }, ['Leer artículo ↗']),
      r.doi ? el('a', { class: 'btn btn-outline btn-sm', href: r.doi, target: '_blank', rel: 'noopener' }, ['DOI']) : null
    ])
  ])));
};

/* ---------------------------------- Casos --------------------------------- */
RENDER.casos = function () {
  const grid = $('#casosGrid'); grid.innerHTML = '';
  const casos = DB.Cases.all(); const seen = DB.getProgress().casosVistos;
  if (!casos.length) { grid.innerHTML = emptyState('🩺', 'Aún no hay casos', 'El docente puede crearlos desde el Panel Docente.'); return; }
  casos.forEach(c => grid.appendChild(el('div', { class: 'card hoverable case-card', id: 'caso-' + c.id, onclick: () => openCase(c) }, [
    el('div', { class: 'chip-row' }, [el('span', { class: 'chip danger' }, [c.tipo || 'Caso clínico']), c.fuente ? el('span', { class: 'chip blue' }, [c.fuente]) : null, seen.includes(c.id) ? el('span', { class: 'chip' }, ['✓ Revisado']) : null]),
    el('h3', { class: 'card-title' }, [c.titulo]),
    el('p', { class: 'muted small mt4' }, [c.paciente || '']),
    el('p', { class: 'small mt8' }, [c.motivo || '']),
    el('div', { class: 'resource-actions mt12' }, [el('span', { class: 'btn btn-primary btn-sm' }, ['Abrir caso'])])
  ])));
};
function openCase(c) {
  DB.markSeen('caso', c.id); updateProgressUI();
  $('#viewerTitle').textContent = c.titulo;
  const datos = (c.datos || []).map(d => `<div class="case-data"><span>${esc(d[0])}</span><p>${esc(d[1])}</p></div>`).join('');
  const preg = (c.preguntas || []).map(q => `<li>${esc(q)}</li>`).join('');
  $('#viewerBody').innerHTML = `
    <div class="case-head"><span class="chip danger">${esc(c.tipo || 'Caso clínico')}</span>${c.fuente ? `<span class="chip blue">${esc(c.fuente)}</span>` : ''}</div>
    <div class="detail-block mt12"><h4>Motivo de consulta</h4><p>${esc(c.motivo)}</p></div>
    <div class="detail-block mt12"><h4>Paciente</h4><p>${esc(c.paciente)}</p></div>
    <h4 class="case-sub">Datos de la valoración</h4><div class="case-grid">${datos}</div>
    ${preg ? `<h4 class="case-sub">Preguntas para tu razonamiento clínico</h4><ol class="case-q">${preg}</ol>` : ''}
    <div class="viewer-foot">
      <button class="btn btn-primary btn-sm" id="caseToResvech">Aplicar RESVECH 2.0</button>
      ${c.siaaUrl ? `<a class="btn btn-outline btn-sm" href="${esc(c.siaaUrl)}" target="_blank" rel="noopener">Abrir enlace del caso ↗</a>` : ''}
    </div>`;
  $('#caseToResvech').onclick = () => { closeModal('viewerModal'); navigate('resvech'); };
  openModal('viewerModal'); RENDER.casos();
}

/* --------------------------------- RESVECH -------------------------------- */
const RV_ITEMS = [
  { id: 'i1', t: 'Dimensiones de la lesión', sub: 'Largo × ancho mayores (cm²)', tipo: 'radio', ops: [
    [0, 'Superficie = 0 cm²', 'Herida cicatrizada'], [1, 'Menos de 4 cm²'], [2, 'De 4 a menos de 16 cm²'], [3, 'De 16 a menos de 36 cm²'],
    [4, 'De 36 a menos de 64 cm²'], [5, 'De 64 a menos de 100 cm²'], [6, '100 cm² o más']] },
  { id: 'i2', t: 'Profundidad / tejidos afectados', sub: 'Hasta dónde llega la lesión', tipo: 'radio', ops: [
    [0, 'Piel intacta cicatrizada'], [1, 'Afectación de la dermis-epidermis'], [2, 'Afectación del tejido subcutáneo', 'Tejido adiposo sin llegar a la fascia del músculo'],
    [3, 'Afectación del músculo'], [4, 'Afectación de hueso y/o tejidos anexos', 'Tendones, ligamentos, cápsula articular o escara negra que no permite ver los tejidos debajo']] },
  { id: 'i3', t: 'Bordes', sub: 'Aspecto del contorno', tipo: 'radio', ops: [
    [0, 'No distinguibles', 'No hay bordes de herida'], [1, 'Difusos'], [2, 'Delimitados'], [3, 'Dañados'], [4, 'Engrosados', '«Envejecidos», «evertidos»']] },
  { id: 'i4', t: 'Tipo de tejido en el lecho', sub: 'Tejido predominante', tipo: 'radio', ops: [
    [4, 'Necrótico', 'Escara negra seca o húmeda'], [3, 'Tejido necrótico y/o esfacelos en el lecho'], [2, 'Tejido de granulación'], [1, 'Tejido epitelial'], [0, 'Cerrada / cicatrizada']] },
  { id: 'i5', t: 'Exudado', sub: 'Cómo sale el apósito', tipo: 'radio', ops: [
    [3, 'Seco'], [0, 'Húmedo'], [1, 'Mojado'], [2, 'Saturado'], [3, 'Con fuga de exudado']] },
  { id: 'i6', t: 'Infección / inflamación (signos de biofilm)', sub: 'Marca todos los signos presentes · 1 punto cada uno', tipo: 'check', ops: [
    'Dolor que va en aumento', 'Eritema en la perilesión', 'Edema en la perilesión', 'Aumento de la temperatura', 'Exudado que va en aumento', 'Exudado purulento',
    'Tejido friable o que sangra con facilidad', 'Herida estancada, que no progresa', 'Tejido compatible con biofilm', 'Olor', 'Hipergranulación',
    'Aumento del tamaño de la herida', 'Lesiones satélite', 'Palidez del tejido'].map(l => [1, l]) }
];
const RV_HIST = 'hcv_resvech_history';
function buildResvech() {
  const form = $('#resvechForm'); if (form.dataset.built) return; form.dataset.built = '1';
  RV_ITEMS.forEach((it, n) => {
    const max = it.tipo === 'radio' ? Math.max(...it.ops.map(o => o[0])) : it.ops.length;
    const box = el('div', { class: 'card rv-item', role: 'group', 'aria-label': it.t }, [
      el('div', { class: 'rv-head' }, [el('span', { class: 'session-num' }, [String(n + 1)]), el('span', {}, [el('strong', {}, [it.t]), el('small', {}, [it.sub])]), el('span', { class: 'rv-pts', 'data-pts': it.id }, ['0 / ' + max])])
    ]);
    const ops = el('div', { class: 'rv-ops' });
    it.ops.forEach((o, j) => ops.appendChild(el('label', { class: 'rv-op' }, [
      el('input', { type: it.tipo === 'radio' ? 'radio' : 'checkbox', name: it.id, value: String(o[0]), 'data-g': it.id, onchange: calcResvech }),
      el('span', { class: 'rv-txt' }, [o[1], o[2] ? el('em', {}, [o[2]]) : null]),
      el('span', { class: 'rv-val' }, [String(o[0])])
    ])));
    box.appendChild(ops); form.appendChild(box);
  });
}
function calcResvech() {
  let total = 0;
  RV_ITEMS.forEach(it => {
    let s = 0; const checked = $all(`input[data-g="${it.id}"]:checked`);
    checked.forEach(i => s += Number(i.value));
    total += s;
    const max = it.tipo === 'radio' ? Math.max(...it.ops.map(o => o[0])) : it.ops.length;
    const chip = $(`[data-pts="${it.id}"]`); chip.textContent = s + ' / ' + max; chip.classList.toggle('on', checked.length > 0);
  });
  $all('.rv-op').forEach(l => l.classList.toggle('sel', l.querySelector('input').checked));
  $('#rvScore').textContent = total;
  $('#rvMeter').style.width = (total / 35 * 100) + '%';
  const radiosDone = RV_ITEMS.filter(it => it.tipo === 'radio').every(it => $(`input[data-g="${it.id}"]:checked`));
  let msg;
  if (!radiosDone) msg = 'Completa los ítems 1 a 5 (el 6 suma solo los signos presentes).';
  else if (total === 0) msg = 'Puntaje 0: herida cicatrizada.';
  else msg = `Puntaje ${total} de 35. Regístralo y compáralo en el próximo control: si baja, la herida avanza hacia la cicatrización; si sube o se mantiene, revisa el plan de cuidados.`;
  $('#rvMsg').textContent = msg;
  if (radiosDone) { DB.markSeen('resvech'); updateProgressUI(); }
  return { total, complete: radiosDone };
}
function renderRvHistory() {
  let h = []; try { h = JSON.parse(localStorage.getItem(RV_HIST) || '[]'); } catch (e) {}
  $('#rvHistory').innerHTML = h.length ? '<h4 class="rv-hist-title">Mis valoraciones guardadas</h4>' + h.slice(-6).reverse().map(x => `<div class="rv-hist"><span>${fmtDate(x.fecha)}</span><strong>${x.total}</strong></div>`).join('') : '';
}
RENDER.resvech = function () { buildResvech(); calcResvech(); renderRvHistory(); $('#resvechSimLink').href = DB.getConfig().resvechUrl; };
$('#rvReset').addEventListener('click', () => { $all('#resvechForm input').forEach(i => i.checked = false); calcResvech(); });
$('#rvSave').addEventListener('click', () => {
  const r = calcResvech();
  if (!r.complete) { toast('Completa los ítems 1 a 5 antes de guardar', 'error'); return; }
  const fecha = isoOf(new Date());
  let h = []; try { h = JSON.parse(localStorage.getItem(RV_HIST) || '[]'); } catch (e) {}
  h.push({ fecha, total: r.total }); localStorage.setItem(RV_HIST, JSON.stringify(h));
  DB.Personal.add({ titulo: 'Valoración RESVECH: ' + r.total + '/35', fecha, hora: '', nota: 'Guardado desde la calculadora RESVECH 2.0.' });
  renderRvHistory(); toast('Valoración guardada en tu calendario', 'success');
});

/* -------------------------------- Calendario ------------------------------- */
function upcomingPersonal() {
  const today = isoOf(new Date());
  return DB.Personal.all().filter(e => e.fecha >= today).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
}
function calendarEvents() {
  const ev = DB.Events.all().map(e => ({ tipo: e.tipo || 'Evento', titulo: e.titulo, fecha: e.fecha, hora: e.hora, own: false }));
  DB.Personal.all().forEach(e => ev.push({ id: e.id, tipo: 'Mía', titulo: e.titulo, fecha: e.fecha, hora: e.hora, nota: e.nota, own: true }));
  return ev.filter(e => e.fecha);
}
RENDER.calendario = function () {
  const d = APP.calendarDate, y = d.getFullYear(), m = d.getMonth();
  const lbl = new Date(y, m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); $('#calLabel').textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
  const grid = $('#calendarGrid'); grid.innerHTML = '';
  ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].forEach(x => grid.appendChild(el('div', { class: 'dow' }, [x])));
  const start = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const evs = calendarEvents(), todayIso = isoOf(new Date());
  for (let i = 0; i < start; i++) grid.appendChild(el('div', { class: 'cal-cell other-month' }));
  for (let day = 1; day <= days; day++) {
    const iso = isoOf(new Date(y, m, day));
    const cell = el('div', { class: 'cal-cell clickable' + (iso === todayIso ? ' today' : ''), tabindex: '0', role: 'button', 'aria-label': 'Programar actividad el ' + fmtDate(iso, true) }, [el('div', { class: 'cal-num' }, [String(day)])]);
    cell.addEventListener('click', e => { if (!e.target.closest('.cal-evt')) personalForm(null, iso); });
    cell.addEventListener('keydown', e => { if (e.key === 'Enter') personalForm(null, iso); });
    const list = evs.filter(e => e.fecha.slice(0, 10) === iso);
    list.slice(0, 3).forEach(ev => {
      const cls = ev.own ? 'warn' : ev.tipo === 'Clase' ? 'green' : 'blue';
      const chip = el('div', { class: 'cal-evt ' + cls, title: ev.titulo }, [ev.titulo]);
      chip.addEventListener('click', () => ev.own ? personalForm(DB.Personal.get(ev.id)) : showEvent(ev));
      cell.appendChild(chip);
    });
    if (list.length > 3) cell.appendChild(el('div', { class: 'cal-more' }, ['+' + (list.length - 3) + ' más']));
    grid.appendChild(cell);
  }
  const mine = upcomingPersonal();
  $('#myEventsList').innerHTML = '';
  if (!mine.length) $('#myEventsList').innerHTML = '<p class="muted">Aún no has programado actividades. Haz clic en cualquier día del calendario.</p>';
  mine.slice(0, 8).forEach(e => $('#myEventsList').appendChild(el('div', { class: 'my-evt' }, [
    el('div', {}, [el('strong', {}, [e.titulo]), el('small', { class: 'muted' }, [fmtDate(e.fecha, true) + (e.hora ? ' · ' + e.hora : '') + (e.nota ? ' — ' + e.nota : '')])]),
    el('div', { class: 'table-actions' }, [el('button', { title: 'Editar', onclick: () => personalForm(e), html: svgIcon('i-edit', 15) }), el('button', { class: 'del', title: 'Eliminar', onclick: () => { DB.Personal.remove(e.id); RENDER.calendario(); toast('Actividad eliminada'); }, html: svgIcon('i-trash', 15) })])
  ])));
};
function showEvent(ev) {
  $('#viewerTitle').textContent = ev.tipo;
  $('#viewerBody').innerHTML = `<h3>${esc(ev.titulo)}</h3><p class="muted mt8">${fmtDate(ev.fecha, true)}${ev.hora ? ' · ' + esc(ev.hora) : ''}</p>`;
  openModal('viewerModal');
}
function personalForm(item, fecha) {
  openCrud(item ? 'Editar mi actividad' : 'Programar actividad', body => {
    body.appendChild(field('text', 'titulo', 'Actividad', item ? item.titulo : '', 'Ej.: Leer consenso IWII, repasar RESVECH…'));
    const row = el('div', { class: 'form-row' });
    row.appendChild(field('date', 'fecha', 'Fecha', item ? item.fecha : (fecha || isoOf(new Date()))));
    row.appendChild(field('time', 'hora', 'Hora (opcional)', item ? item.hora : ''));
    body.appendChild(row);
    body.appendChild(field('textarea', 'nota', 'Nota (opcional)', item ? item.nota : ''));
    body.appendChild(el('p', { class: 'form-hint' }, ['Tus actividades se guardan solo en este navegador.']));
  }, data => {
    if (!data.titulo || !data.fecha) { toast('Escribe la actividad y la fecha', 'error'); return false; }
    if (item) DB.Personal.update(item.id, data); else DB.Personal.add(data);
    const d = parseDate(data.fecha); if (d) APP.calendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
    toast('Actividad guardada', 'success'); RENDER.calendario();
  }, item ? () => { DB.Personal.remove(item.id); RENDER.calendario(); toast('Actividad eliminada'); } : null);
}
$('#calPrev').addEventListener('click', () => { APP.calendarDate = new Date(APP.calendarDate.getFullYear(), APP.calendarDate.getMonth() - 1, 1); RENDER.calendario(); });
$('#calNext').addEventListener('click', () => { APP.calendarDate = new Date(APP.calendarDate.getFullYear(), APP.calendarDate.getMonth() + 1, 1); RENDER.calendario(); });
$('#calToday').addEventListener('click', () => { APP.calendarDate = new Date(); RENDER.calendario(); });
$('#calAdd').addEventListener('click', () => personalForm(null));

/* --------------------- Formulario genérico (modal) --------------------- */
let crudSave = null, crudDelete = null;
function openCrud(title, build, onSave, onDelete) {
  $('#crudModalTitle').textContent = title;
  const body = $('#crudModalBody'); body.innerHTML = ''; build(body);
  crudSave = onSave; crudDelete = onDelete;
  $('#crudModalDelete').style.display = onDelete ? 'inline-flex' : 'none';
  openModal('crudModal');
  const first = body.querySelector('input,textarea,select'); if (first) setTimeout(() => first.focus(), 80);
}
$('#crudModalSave').addEventListener('click', () => {
  const data = {};
  $all('[data-field]', $('#crudModalBody')).forEach(i => { data[i.dataset.field] = i.type === 'number' ? Number(i.value) : i.value.trim(); });
  if (crudSave && crudSave(data) !== false) closeModal('crudModal');
});
$('#crudModalDelete').addEventListener('click', () => { if (crudDelete && confirm('¿Eliminar este elemento?')) { crudDelete(); closeModal('crudModal'); } });
function field(type, name, label, value, placeholder, options) {
  const id = 'f_' + name;
  let input;
  if (type === 'textarea') input = el('textarea', { id, 'data-field': name, placeholder: placeholder || '' }, [value || '']);
  else if (type === 'select') { input = el('select', { id, 'data-field': name }); (options || []).forEach(o => input.appendChild(el('option', { value: o, selected: o === value ? 'selected' : null }, [o]))); }
  else input = el('input', { id, type, 'data-field': name, value: value == null ? '' : value, placeholder: placeholder || '' });
  return el('div', { class: 'form-group' }, [el('label', { for: id }, [label]), input]);
}

/* ---------------------------------- FAQ ----------------------------------- */
const FAQ = [
  ['¿Qué encuentro en esta página?', 'Información para valorar a pacientes con heridas crónicas: programación de clases, recursos (videos, guías, libros, artículos, infografías y podcasts), biblioteca científica por temas, casos clínicos y la escala RESVECH 2.0.'],
  ['¿Cómo veo un video, una infografía o un podcast?', 'En Recursos, elige la categoría y pulsa "Ver video", "Ver en pantalla" o "Escuchar". Se abre aquí mismo; también puedes descargar los documentos.'],
  ['¿Cómo abro las diapositivas de una clase?', 'Ve a Sesiones de clase y pulsa "Abrir clase". Si el docente publicó el enlace de Canva, puedes abrirlo con el botón "Abrir diapositivas en Canva".'],
  ['¿Cómo programo mis actividades en el calendario?', 'En Calendario haz clic sobre un día o en "+ Programar actividad". Tus actividades se guardan en tu navegador y aparecen en color amarillo.'],
  ['¿Cómo uso la escala RESVECH 2.0?', 'En Escala RESVECH 2.0 marca una opción en los ítems 1 a 5 y todos los signos presentes del ítem 6. El total (0–35) se calcula solo; puedes guardarlo en tu calendario para comparar en el siguiente control.'],
  ['¿Funciona el buscador?', 'Sí. Escribe al menos dos letras en la barra superior: busca en sesiones, recursos, biblioteca, casos y preguntas frecuentes, sin importar tildes. Pulsa Enter para ir al primer resultado.'],
  ['¿Cómo contacto a mi docente?', 'En Contacto docente encontrarás el formulario, WhatsApp, Teams y el correo institucional.'],
  ['¿Quién puede editar el contenido?', 'Solo la docente, desde el Panel Docente protegido con contraseña.']
];
RENDER.faq = function () {
  $('#faqList').innerHTML = FAQ.map((f, i) => `<details class="faq-item" id="faq-${i}"><summary>${esc(f[0])}</summary><p class="muted">${esc(f[1])}</p></details>`).join('');
};

/* -------------------------------- Contacto -------------------------------- */
RENDER.contacto = function () {
  const c = DB.getConfig();
  $('#ctNombre').textContent = c.docente; $('#ctCorreo').textContent = c.correo;
  $('#ctAtencion').textContent = 'Horario de atención: ' + c.atencion;
  $('#ctWhats').href = c.whatsapp; $('#ctTeams').href = c.teams; $('#ctMail').href = 'mailto:' + c.correo;
  const p = DB.getProfile(); if (!$('#cfNombre').value && APP.user.role === 'student') { $('#cfNombre').value = p.nombre || ''; $('#cfCorreo').value = p.correo || ''; }
};
$('#contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = DB.getConfig();
  const body = `Nombre: ${$('#cfNombre').value}\nCorreo: ${$('#cfCorreo').value}\n\n${$('#cfMensaje').value}`;
  location.href = `mailto:${c.correo}?subject=${encodeURIComponent($('#cfAsunto').value)}&body=${encodeURIComponent(body)}`;
  toast('Abriendo tu correo para enviar el mensaje…', 'success');
});

/* --------------------------------- Perfil --------------------------------- */
RENDER.perfil = function () {
  const p = DB.getProfile();
  $('#profileNameBig').textContent = p.nombre || 'Estudiante UCEVA';
  $('#profileSemesterBig').textContent = 'Semestre ' + (p.semestre || '—');
  $('#profileAvatarBig').textContent = initials(p.nombre);
  $('#pfNombre').value = p.nombre || ''; $('#pfCorreo').value = p.correo || ''; $('#pfSemestre').value = p.semestre || '';
};
$('#profileForm').addEventListener('submit', e => {
  e.preventDefault();
  DB.saveProfile({ nombre: $('#pfNombre').value.trim(), correo: $('#pfCorreo').value.trim(), semestre: $('#pfSemestre').value.trim() });
  toast('Perfil actualizado', 'success'); setUserUI(); RENDER.perfil();
});

/* -------------------------------- Buscador -------------------------------- */
const SECTIONS = [
  ['inicio', 'Inicio', 'anuncios novedades accesos rapidos'], ['presentacion', 'Presentación', 'duracion horas presenciales autonomo metodologia competencias'],
  ['objetivo', 'Objetivo de aprendizaje', 'objetivo general especificos'], ['programacion', 'Programación', 'cronograma sesiones martes 2027 semestre'],
  ['recursos', 'Recursos', 'videos guias libros articulos infografias podcasts'], ['clases', 'Sesiones de clase', 'diapositivas canva clases'],
  ['biblioteca', 'Biblioteca científica', 'articulos evidencia'], ['casos', 'Casos clínicos', 'pie diabetico insuficiencia venosa'],
  ['resvech', 'Escala RESVECH 2.0', 'escala puntaje valoracion cicatrizacion simulador bordes exudado tejido biofilm'],
  ['calendario', 'Calendario', 'programar actividades fechas'], ['faq', 'Preguntas frecuentes', 'ayuda dudas'],
  ['contacto', 'Contacto docente', 'correo whatsapp teams docente'], ['perfil', 'Mi perfil', 'cuenta progreso']
];
function buildIndex() {
  const idx = [];
  SECTIONS.forEach(s => idx.push({ tipo: 'Sección', titulo: s[1], texto: s[2], go: () => navigate(s[0]) }));
  DB.Sessions.all().forEach(s => idx.push({ tipo: 'Sesión ' + s.numero, titulo: s.tema, texto: [s.objetivos, s.contenido, s.actividad, s.material, fmtDate(s.fecha, true)].join(' '), go: () => navigate('programacion', () => openSession(s.id, true)) }));
  DB.Resources.all().forEach(r => idx.push({ tipo: r.categoria, titulo: r.titulo, texto: [r.descripcion, r.autores, r.tema, r.fuente].join(' '), go: () => { activeResourceTab = 'Todos'; navigate('recursos', () => flash($('#res-' + r.id))); } }));
  DB.Library.all().forEach(r => idx.push({ tipo: 'Biblioteca · ' + r.tema, titulo: r.titulo, texto: [r.descripcion, r.autores, r.revista, r.tema].join(' '), go: () => { activeBiblio = 'Todos'; navigate('biblioteca', () => flash($('#lib-' + r.id))); } }));
  DB.Cases.all().forEach(c => idx.push({ tipo: 'Caso clínico', titulo: c.titulo, texto: [c.tipo, c.motivo, c.paciente, (c.datos || []).map(d => d.join(' ')).join(' ')].join(' '), go: () => navigate('casos', () => openCase(c)) }));
  RV_ITEMS.forEach(it => idx.push({ tipo: 'RESVECH 2.0', titulo: it.t, texto: it.sub + ' ' + it.ops.map(o => o[1]).join(' '), go: () => navigate('resvech') }));
  FAQ.forEach((f, i) => idx.push({ tipo: 'Pregunta frecuente', titulo: f[0], texto: f[1], go: () => navigate('faq', () => { const d = $('#faq-' + i); if (d) { d.open = true; flash(d); } }) }));
  DB.Announcements.all().forEach(a => idx.push({ tipo: 'Anuncio', titulo: a.titulo, texto: a.mensaje, go: () => navigate('inicio') }));
  return idx;
}
let searchHits = [], searchSel = -1;
function runSearch(q) {
  const box = $('#searchResults');
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (norm(q).trim().length < 2) { box.hidden = true; searchHits = []; return; }
  searchHits = buildIndex().map(it => {
    const t = norm(it.titulo), x = norm(it.texto + ' ' + it.tipo);
    let score = 0;
    for (const term of terms) { if (t.includes(term)) score += 3; else if (x.includes(term)) score += 1; else return null; }
    return Object.assign({ score }, it);
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
  searchSel = searchHits.length ? 0 : -1;
  box.innerHTML = searchHits.length
    ? `<div class="sr-count">${searchHits.length} resultado${searchHits.length > 1 ? 's' : ''}</div>` + searchHits.map((h, i) => `<button type="button" class="sr-item${i === 0 ? ' sel' : ''}" role="option" data-i="${i}"><span class="chip green">${esc(h.tipo)}</span><span class="sr-title">${highlight(h.titulo, terms)}</span></button>`).join('')
    : `<div class="sr-empty">No se encontraron resultados para «${esc(q)}».<br><small>Prueba con otra palabra: «exudado», «venosa», «RESVECH», «martes»…</small></div>`;
  box.hidden = false;
}
function highlight(text, terms) {
  const n = norm(text);
  if (n.length !== text.length) return esc(text);
  const marks = [];
  terms.forEach(t => { let i = n.indexOf(t); while (i >= 0) { marks.push([i, i + t.length]); i = n.indexOf(t, i + t.length); } });
  marks.sort((a, b) => a[0] - b[0]);
  let res = '', last = 0;
  marks.forEach(([a, b]) => { if (a < last) return; res += esc(text.slice(last, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; last = b; });
  return res + esc(text.slice(last));
}
function chooseHit(i) {
  const h = searchHits[i]; if (!h) return;
  $('#searchResults').hidden = true; $('#headerSearch').classList.remove('mobile-open');
  $('#globalSearch').blur(); h.go();
}
const gs = $('#globalSearch');
gs.addEventListener('input', () => { $('#searchClear').hidden = !gs.value; clearTimeout(window._st); window._st = setTimeout(() => runSearch(gs.value), 120); });
gs.addEventListener('focus', () => { if (gs.value.trim().length >= 2) runSearch(gs.value); });
gs.addEventListener('keydown', e => {
  const items = $all('.sr-item');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!items.length) return;
    searchSel = (searchSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((b, i) => b.classList.toggle('sel', i === searchSel)); items[searchSel].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); if (gs.value.trim().length >= 2 && !searchHits.length) runSearch(gs.value); chooseHit(Math.max(0, searchSel)); }
  else if (e.key === 'Escape') { $('#searchResults').hidden = true; $('#headerSearch').classList.remove('mobile-open'); }
});
$('#searchResults').addEventListener('mousedown', e => { const b = e.target.closest('.sr-item'); if (b) { e.preventDefault(); chooseHit(Number(b.dataset.i)); } });
$('#searchClear').addEventListener('click', () => { gs.value = ''; $('#searchClear').hidden = true; $('#searchResults').hidden = true; gs.focus(); });
document.addEventListener('click', e => { if (!e.target.closest('#headerSearch') && !e.target.closest('#searchMobileBtn')) { $('#searchResults').hidden = true; $('#headerSearch').classList.remove('mobile-open'); } });
$('#searchMobileBtn').addEventListener('click', () => { $('#headerSearch').classList.toggle('mobile-open'); if ($('#headerSearch').classList.contains('mobile-open')) gs.focus(); });

/* ---------------------------------- Init ---------------------------------- */
async function init() {
  DB.seed();
  $('#year').textContent = new Date().getFullYear();
  await Promise.race([DB.syncPublished(), new Promise(r => setTimeout(r, 2500))]);
  let role = 'guest'; try { role = sessionStorage.getItem(SESSION_KEY) || 'guest'; } catch (e) {}
  APP.user = { role }; setUserUI();
  const start = location.hash.replace('#/', '') || 'inicio';
  APP.route = ROUTES.includes(start) ? start : 'inicio';
  if (APP.route === 'docente' && role !== 'teacher') APP.route = 'inicio';
  history.replaceState(null, '', '#/' + APP.route);
  renderRoute();
  setTimeout(() => $('#splash').classList.add('hidden'), 350);
  if (role === 'guest') setTimeout(() => openLogin(start === 'docente'), 600);
  // Retira el service worker de la versión anterior para que no muestre contenido viejo
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (r.scope === new URL('./', location.href).href) r.unregister(); })).catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);
