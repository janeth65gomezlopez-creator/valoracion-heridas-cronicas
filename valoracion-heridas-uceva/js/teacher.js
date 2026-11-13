/* =========================================================================
   teacher.js — Panel Docente: editar todo el contenido y publicarlo
   ========================================================================= */

const TEACHER = (() => {
  const PASS_KEY = 'hcv_teacher_pass';
  const DEFAULT_PASS = 'uceva2025';
  let tab = 'anuncios';

  const getPass = () => localStorage.getItem(PASS_KEY) || DEFAULT_PASS;

  function tryLogin() {
    if ($('#teacherPassInput').value === getPass()) {
      setRole('teacher'); closeModal('loginModal');
      $('#teacherPassInput').value = ''; $('#teacherLoginForm').style.display = 'none';
      toast('Sesión docente iniciada', 'success'); navigate('docente');
    } else toast('Contraseña incorrecta', 'error');
  }
  $('#teacherLogoutBtn').addEventListener('click', () => { setRole('guest'); navigate('inicio'); toast('Sesión docente cerrada'); });

  function renderPanel() {
    if (APP.user.role !== 'teacher') { navigate('inicio'); return; }
    $all('#teacherTabs .tab-btn').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.onclick = () => { tab = b.dataset.tab; renderPanel(); }; });
    const c = $('#teacherPanelContent'); c.innerHTML = '';
    if (tab !== 'config') c.appendChild(el('div', { class: 'install-banner show', style: 'margin-bottom:16px' }, [
      el('p', {}, ['💾 Los cambios se guardan en este navegador. Para que los vean todos los estudiantes, publícalos en "Configuración y publicar".']),
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => { tab = 'config'; renderPanel(); } }, ['Ir a publicar'])
    ]));
    ({ anuncios, sesiones, recursos, biblioteca, casos, eventos, config }[tab] || anuncios)(c);
  }

  /* ---------- utilidades de tabla ---------- */
  function toolbar(c, title, onAdd) {
    c.appendChild(el('div', { class: 'admin-toolbar' }, [el('h3', {}, [title]), onAdd ? el('button', { class: 'btn btn-primary btn-sm', onclick: onAdd }, ['+ Agregar nuevo']) : null]));
  }
  function table(c, headers, rows, empty) {
    if (!rows.length) { c.insertAdjacentHTML('beforeend', emptyState('🗂️', 'Sin elementos', empty)); return; }
    const t = el('table', { class: 'admin-table' });
    t.appendChild(el('thead', {}, [el('tr', {}, headers.map(h => el('th', {}, [h])))]));
    const tb = el('tbody'); rows.forEach(r => tb.appendChild(el('tr', {}, r.map(x => el('td', {}, [typeof x === 'string' || typeof x === 'number' ? String(x) : x])))));
    t.appendChild(tb); c.appendChild(el('div', { class: 'table-wrap' }, [t]));
  }
  function actions(onEdit, onDel) {
    return el('div', { class: 'table-actions' }, [
      el('button', { title: 'Editar', onclick: onEdit, html: svgIcon('i-edit', 15) }),
      el('button', { class: 'del', title: 'Eliminar', onclick: () => { if (confirm('¿Eliminar este elemento?')) onDel(); }, html: svgIcon('i-trash', 15) })
    ]);
  }
  const short = (s, n) => { s = s || ''; return s.length > (n || 60) ? s.slice(0, n || 60) + '…' : s; };
  function saved(msg) { toast(msg || 'Cambios guardados', 'success'); renderPanel(); }

  /* Campo que acepta un enlace o un archivo pequeño (se guarda en el navegador) */
  function urlOrFile(name, label, value, accept) {
    const g = field('text', name, label, value, 'Pega un enlace (YouTube, Drive, Canva, PDF, MP4…)');
    const file = el('input', { type: 'file', accept: accept || '*/*', class: 'file-mini' });
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 3 * 1024 * 1024) { toast('El archivo pesa más de 3 MB: súbelo a Drive o al repositorio y pega el enlace.', 'error'); file.value = ''; return; }
      const rd = new FileReader(); rd.onload = () => { g.querySelector('[data-field]').value = rd.result; toast('Archivo cargado'); }; rd.readAsDataURL(f);
    });
    g.appendChild(el('small', { class: 'form-hint' }, ['o sube un archivo pequeño (máx. 3 MB): ']));
    g.appendChild(file);
    return g;
  }

  /* ---------- Anuncios ---------- */
  function anuncios(c) {
    toolbar(c, 'Anuncios y novedades', () => fAnuncio());
    const items = DB.Announcements.all().slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    table(c, ['Título', 'Mensaje', 'Fecha', ''], items.map(a => [a.titulo, short(a.mensaje), fmtDate(a.fecha), actions(() => fAnuncio(a), () => { DB.Announcements.remove(a.id); saved('Anuncio eliminado'); })]), 'Crea el primer anuncio.');
  }
  function fAnuncio(a) {
    openCrud(a ? 'Editar anuncio' : 'Nuevo anuncio', b => {
      b.appendChild(field('text', 'titulo', 'Título', a && a.titulo));
      b.appendChild(field('textarea', 'mensaje', 'Mensaje', a && a.mensaje));
      b.appendChild(field('date', 'fecha', 'Fecha', a ? (a.fecha || '').slice(0, 10) : isoOf(new Date())));
    }, d => { if (!d.titulo) { toast('Escribe un título', 'error'); return false; } a ? DB.Announcements.update(a.id, d) : DB.Announcements.add(d); saved('Anuncio guardado'); });
  }

  /* ---------- Programación ---------- */
  function sesiones(c) {
    toolbar(c, 'Programación (sesiones)', () => fSesion());
    const items = DB.Sessions.all().sort((a, b) => a.numero - b.numero);
    table(c, ['#', 'Tema', 'Fecha', 'Clase (Canva)', ''], items.map(s => [s.numero, s.tema, fmtDate(s.fecha), s.claseUrl ? '✅ enlace' : '—', actions(() => fSesion(s), () => { DB.Sessions.remove(s.id); syncClassEvents(); saved('Sesión eliminada'); })]), 'Agrega la primera sesión.');
  }
  function fSesion(s) {
    openCrud(s ? 'Editar sesión' : 'Nueva sesión', b => {
      const r = el('div', { class: 'form-row' });
      r.appendChild(field('number', 'numero', 'N.º de sesión', s ? s.numero : DB.Sessions.all().length + 1));
      r.appendChild(field('date', 'fecha', 'Fecha', s && s.fecha)); b.appendChild(r);
      b.appendChild(field('text', 'hora', 'Horario', s ? s.hora : '2:00 p. m. – 6:00 p. m.'));
      b.appendChild(field('text', 'tema', 'Tema', s && s.tema));
      b.appendChild(field('textarea', 'objetivos', 'Objetivos', s && s.objetivos));
      b.appendChild(field('textarea', 'contenido', 'Contenido', s && s.contenido));
      b.appendChild(field('textarea', 'actividad', 'Actividad', s && s.actividad));
      b.appendChild(field('text', 'material', 'Material de apoyo', s && s.material));
      b.appendChild(field('text', 'claseUrl', 'Enlace de la clase (Canva, YouTube, Drive…)', s && s.claseUrl, 'https://www.canva.com/design/…/view'));
      b.appendChild(el('p', { class: 'form-hint' }, ['Para que las diapositivas se vean dentro de la página, en Canva usa Compartir → Más → Insertar y pega aquí el enlace que termina en /view. Con un enlace corto (canva.link) se mostrará el botón para abrir Canva.']));
    }, d => {
      if (!d.tema || !d.fecha) { toast('Escribe el tema y la fecha', 'error'); return false; }
      s ? DB.Sessions.update(s.id, d) : DB.Sessions.add(d); syncClassEvents(); saved('Sesión guardada');
    });
  }
  // Mantiene las clases del calendario alineadas con la programación
  function syncClassEvents() {
    const others = DB.Events.all().filter(e => e.tipo !== 'Clase');
    const classes = DB.Sessions.all().sort((a, b) => a.numero - b.numero).map(s => ({ id: 'cls_' + s.id, tipo: 'Clase', titulo: 'Sesión ' + s.numero + ': ' + s.tema, fecha: s.fecha }));
    DB.Events.replaceAll(others.concat(classes));
  }

  /* ---------- Recursos ---------- */
  const CATS = ['Videos', 'Guías', 'Libros', 'Artículos científicos', 'Infografías', 'Podcasts'];
  function recursos(c) {
    toolbar(c, 'Recursos', () => fRecurso());
    const items = DB.Resources.all().slice().sort((a, b) => CATS.indexOf(a.categoria) - CATS.indexOf(b.categoria));
    table(c, ['Título', 'Categoría', 'Origen', ''], items.map(r => [short(r.titulo, 70), r.categoria, r.fuente || '—', actions(() => fRecurso(r), () => { DB.Resources.remove(r.id); saved('Recurso eliminado'); })]), 'Agrega videos, guías, libros…');
  }
  function fRecurso(r) {
    openCrud(r ? 'Editar recurso' : 'Nuevo recurso', b => {
      const row = el('div', { class: 'form-row' });
      row.appendChild(field('select', 'categoria', 'Categoría', r ? r.categoria : 'Videos', '', CATS));
      row.appendChild(field('select', 'media', 'Cómo se muestra', r ? (r.media || 'enlace') : 'enlace', '', ['video', 'audio', 'pdf', 'imagen', 'enlace']));
      b.appendChild(row);
      b.appendChild(field('text', 'titulo', 'Título', r && r.titulo));
      b.appendChild(field('text', 'autores', 'Autores (opcional)', r && r.autores));
      b.appendChild(field('textarea', 'descripcion', 'Descripción', r && r.descripcion));
      b.appendChild(urlOrFile('url', 'Enlace o archivo', r && r.url, 'video/*,audio/*,application/pdf,image/*'));
      const row2 = el('div', { class: 'form-row' });
      row2.appendChild(field('text', 'fuente', 'Origen (SIAA, GNEAUPP…)', r && r.fuente));
      row2.appendChild(field('text', 'doi', 'DOI (opcional)', r && r.doi)); b.appendChild(row2);
      b.appendChild(el('p', { class: 'form-hint' }, ['"video" y "audio" se reproducen en pantalla (MP4, M4A, MP3); "pdf" e "imagen" se ven en pantalla y se pueden descargar; "enlace" abre el sitio original.']));
    }, d => { if (!d.titulo) { toast('Escribe un título', 'error'); return false; } r ? DB.Resources.update(r.id, d) : DB.Resources.add(d); saved('Recurso guardado'); });
  }

  /* ---------- Biblioteca ---------- */
  function biblioteca(c) {
    toolbar(c, 'Biblioteca científica (un artículo por tema)', () => fLib());
    const items = DB.Library.all();
    table(c, ['Tema', 'Título', 'Año', ''], items.map(r => [r.tema, short(r.titulo, 70), r.anio || '—', actions(() => fLib(r), () => { DB.Library.remove(r.id); saved('Artículo eliminado'); })]), 'Agrega artículos por tema.');
  }
  function fLib(r) {
    openCrud(r ? 'Editar artículo' : 'Nuevo artículo', b => {
      const row = el('div', { class: 'form-row' });
      row.appendChild(field('select', 'tema', 'Tema', r ? r.tema : 'Heridas', '', BIBLIO_FILTERS.slice(1)));
      row.appendChild(field('number', 'anio', 'Año', r ? r.anio : new Date().getFullYear())); b.appendChild(row);
      b.appendChild(field('text', 'titulo', 'Título', r && r.titulo));
      b.appendChild(field('text', 'autores', 'Autores', r && r.autores));
      b.appendChild(field('text', 'revista', 'Revista / editorial', r && r.revista));
      b.appendChild(field('textarea', 'descripcion', 'Resumen breve', r && r.descripcion));
      b.appendChild(field('text', 'url', 'Enlace al texto completo', r && r.url));
      b.appendChild(field('text', 'doi', 'DOI (https://doi.org/…)', r && r.doi));
    }, d => { if (!d.titulo) { toast('Escribe un título', 'error'); return false; } r ? DB.Library.update(r.id, d) : DB.Library.add(d); saved('Artículo guardado'); });
  }

  /* ---------- Casos ---------- */
  function casos(c) {
    toolbar(c, 'Casos clínicos', () => fCaso());
    table(c, ['Título', 'Tipo', ''], DB.Cases.all().map(x => [x.titulo, x.tipo || '—', actions(() => fCaso(x), () => { DB.Cases.remove(x.id); saved('Caso eliminado'); })]), 'Agrega un caso clínico.');
  }
  function fCaso(x) {
    openCrud(x ? 'Editar caso' : 'Nuevo caso', b => {
      const row = el('div', { class: 'form-row' });
      row.appendChild(field('text', 'tipo', 'Tipo de herida', x && x.tipo)); row.appendChild(field('text', 'fuente', 'Origen', x ? x.fuente : 'SIAA')); b.appendChild(row);
      b.appendChild(field('text', 'titulo', 'Título', x && x.titulo));
      b.appendChild(field('textarea', 'motivo', 'Motivo de consulta', x && x.motivo));
      b.appendChild(field('text', 'paciente', 'Paciente', x && x.paciente));
      b.appendChild(field('textarea', 'datosTxt', 'Datos de valoración (una línea por dato: Categoría | descripción)', x ? (x.datos || []).map(d => d.join(' | ')).join('\n') : ''));
      b.appendChild(field('textarea', 'preguntasTxt', 'Preguntas (una por línea)', x ? (x.preguntas || []).join('\n') : ''));
      b.appendChild(field('text', 'siaaUrl', 'Enlace para resolver el caso (opcional)', x && x.siaaUrl));
    }, d => {
      if (!d.titulo) { toast('Escribe un título', 'error'); return false; }
      d.datos = d.datosTxt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? ['Dato', l] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
      d.preguntas = d.preguntasTxt.split('\n').map(l => l.trim()).filter(Boolean);
      delete d.datosTxt; delete d.preguntasTxt;
      x ? DB.Cases.update(x.id, d) : DB.Cases.add(d); saved('Caso guardado');
    });
  }

  /* ---------- Calendario del módulo ---------- */
  function eventos(c) {
    toolbar(c, 'Eventos del módulo en el calendario', () => fEvento());
    c.appendChild(el('p', { class: 'form-hint', style: 'margin:-6px 0 12px' }, ['Las clases se crean solas a partir de la Programación. Aquí puedes agregar otros eventos (jornadas, entregas, fechas importantes).']));
    const items = DB.Events.all().slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    table(c, ['Fecha', 'Tipo', 'Título', ''], items.map(e => [fmtDate(e.fecha), e.tipo, e.titulo, (e.tipo === 'Clase') ? el('span', { class: 'muted small' }, ['desde Programación']) : actions(() => fEvento(e), () => { DB.Events.remove(e.id); saved('Evento eliminado'); })]), 'Sin eventos.');
  }
  function fEvento(e) {
    openCrud(e ? 'Editar evento' : 'Nuevo evento', b => {
      b.appendChild(field('text', 'titulo', 'Título', e && e.titulo));
      const r = el('div', { class: 'form-row' });
      r.appendChild(field('date', 'fecha', 'Fecha', e && e.fecha)); r.appendChild(field('select', 'tipo', 'Tipo', e ? e.tipo : 'Evento', '', ['Evento', 'Entrega', 'Jornada']));
      b.appendChild(r);
    }, d => { if (!d.titulo || !d.fecha) { toast('Escribe título y fecha', 'error'); return false; } e ? DB.Events.update(e.id, d) : DB.Events.add(d); saved('Evento guardado'); });
  }

  /* ---------- Configuración y publicación ---------- */
  function config(c) {
    const cfg = DB.getConfig();
    const form = el('div', { class: 'card' }, [el('h3', { style: 'margin-bottom:12px' }, ['Datos generales'])]);
    const r1 = el('div', { class: 'form-row' });
    r1.appendChild(field('number', 'horasPresenciales', 'Horas presenciales', cfg.horasPresenciales));
    r1.appendChild(field('number', 'horasAutonomas', 'Horas de aprendizaje autónomo', cfg.horasAutonomas)); form.appendChild(r1);
    const r2 = el('div', { class: 'form-row' });
    r2.appendChild(field('number', 'sesiones', 'Número de sesiones', cfg.sesiones));
    r2.appendChild(field('text', 'docente', 'Docente', cfg.docente)); form.appendChild(r2);
    const r3 = el('div', { class: 'form-row' });
    r3.appendChild(field('email', 'correo', 'Correo', cfg.correo));
    r3.appendChild(field('text', 'atencion', 'Horario de atención', cfg.atencion)); form.appendChild(r3);
    const r4 = el('div', { class: 'form-row' });
    r4.appendChild(field('text', 'whatsapp', 'Enlace de WhatsApp', cfg.whatsapp));
    r4.appendChild(field('text', 'teams', 'Enlace de Teams', cfg.teams)); form.appendChild(r4);
    const r5 = el('div', { class: 'form-row' });
    r5.appendChild(field('text', 'resvechUrl', 'Enlace del simulador RESVECH', cfg.resvechUrl));
    r5.appendChild(field('text', 'siaaUrl', 'Enlace del SIAA', cfg.siaaUrl)); form.appendChild(r5);
    form.appendChild(el('button', { class: 'btn btn-primary', onclick: () => {
      const d = Object.assign({}, cfg); $all('[data-field]', form).forEach(i => d[i.dataset.field] = i.type === 'number' ? Number(i.value) : i.value.trim());
      DB.saveConfig(d); toast('Configuración guardada', 'success');
    } }, ['Guardar datos']));
    c.appendChild(form);

    const pub = el('div', { class: 'card section-gap' }, [
      el('h3', {}, ['Publicar para todos los estudiantes']),
      el('ol', { class: 'obj-list small' }, [
        el('li', {}, ['Pulsa "Descargar content.json".']),
        el('li', {}, ['En GitHub, abre el repositorio de la página → carpeta data → Add file → Upload files, y sube el archivo (reemplaza el anterior).']),
        el('li', {}, ['En 1–2 minutos los estudiantes verán los cambios al recargar la página.'])
      ]),
      el('p', { class: 'muted small mt8' }, ['Última publicación aplicada en este navegador: ' + DB.publishedLabel()]),
      el('div', { class: 'resource-actions mt12' }, [
        el('button', { class: 'btn btn-primary', onclick: download }, ['⬇ Descargar content.json']),
        (() => { const inp = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
          inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { DB.importContent(JSON.parse(rd.result)); toast('Contenido importado', 'success'); renderPanel(); } catch (e) { toast('Archivo no válido', 'error'); } }; rd.readAsText(f); });
          return el('label', { class: 'btn btn-outline' }, ['⬆ Importar content.json', inp]); })()
      ])
    ]);
    c.appendChild(pub);

    const sec = el('div', { class: 'card section-gap' }, [el('h3', { style: 'margin-bottom:10px' }, ['Seguridad'])]);
    sec.appendChild(field('password', 'newpass', 'Nueva contraseña docente', ''));
    sec.appendChild(el('div', { class: 'resource-actions' }, [
      el('button', { class: 'btn btn-outline', onclick: () => { const v = sec.querySelector('[data-field="newpass"]').value; if (v.length < 6) { toast('Mínimo 6 caracteres', 'error'); return; } localStorage.setItem(PASS_KEY, v); toast('Contraseña actualizada en este navegador', 'success'); } }, ['Cambiar contraseña']),
      el('button', { class: 'btn btn-danger', onclick: () => { if (confirm('Esto borra los cambios locales y vuelve al contenido inicial. ¿Continuar?')) { DB.resetAll(); location.reload(); } } }, ['Restablecer contenido inicial'])
    ]));
    c.appendChild(sec);
  }
  function download() {
    const blob = new Blob([JSON.stringify(DB.exportContent(), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'content.json' }); document.body.appendChild(a); a.click(); a.remove();
    toast('Archivo descargado: súbelo a la carpeta data del repositorio', 'success');
  }

  RENDER.docente = renderPanel;
  return { tryLogin, renderPanel };
})();
