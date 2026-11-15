/* =========================================================================
   data.js — Capa de datos de la página "Valoración de heridas crónicas · UCEVA"
   -------------------------------------------------------------------------
   Todo el contenido editable vive en localStorage como colecciones JSON.
   La docente lo modifica desde el Panel Docente y lo "publica" subiendo el
   archivo data/content.json al repositorio; así todos los estudiantes ven
   la misma versión. Los eventos personales del calendario y el perfil del
   estudiante quedan solo en su propio navegador.
   ========================================================================= */

const DB = (() => {

  // Prefijo propio para no mezclarse con otras páginas publicadas en el mismo dominio
  const P = 'hcv_';
  const KEYS = {
    sessions: P + 'sessions', resources: P + 'resources', library: P + 'library',
    announcements: P + 'announcements', cases: P + 'cases', events: P + 'events',
    config: P + 'config', personal: P + 'personal_events', progress: P + 'progress',
    profile: P + 'profile', seeded: P + 'seeded_v1', published: P + 'published_version'
  };

  // Recursos que viven en el SIAA (solo se enlazan; no se modifica ese proyecto)
  const SIAA = 'https://siaa-heridas-ostomias.vercel.app';

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : []); }
    catch (e) { return fallback !== undefined ? fallback : []; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { alert('No se pudo guardar: el archivo adjunto puede ser demasiado pesado para el navegador. Usa un enlace en su lugar.'); return false; }
  }
  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  const collection = (key) => ({
    all: () => read(key),
    get: (id) => read(key).find(i => i.id === id) || null,
    add: (item) => { const items = read(key); const rec = Object.assign({ id: uid() }, item); items.push(rec); write(key, items); return rec; },
    update: (id, patch) => { const items = read(key); const i = items.findIndex(x => x.id === id); if (i < 0) return null; items[i] = Object.assign({}, items[i], patch); write(key, items); return items[i]; },
    remove: (id) => write(key, read(key).filter(i => i.id !== id)),
    replaceAll: (items) => write(key, items)
  });

  const Sessions = collection(KEYS.sessions);
  const Resources = collection(KEYS.resources);
  const Library = collection(KEYS.library);
  const Announcements = collection(KEYS.announcements);
  const Cases = collection(KEYS.cases);
  const Events = collection(KEYS.events);
  const Personal = collection(KEYS.personal); // eventos propios del estudiante (no se publican)

  const DEFAULT_CONFIG = {
    horasPresenciales: 32, horasAutonomas: 16, sesiones: 8,
    horario: 'Martes, 2:00 p. m. – 6:00 p. m.',
    docente: 'Yaneth Gómez López', correo: 'yaneth.gomez@uceva.edu.co',
    whatsapp: 'https://wa.me/573000000000', teams: 'https://teams.microsoft.com',
    atencion: 'Lunes a viernes, 2:00 – 4:00 p. m.',
    resvechUrl: 'https://silly-pithivier-6296a9.netlify.app',
    siaaUrl: SIAA
  };
  function getConfig() { return Object.assign({}, DEFAULT_CONFIG, read(KEYS.config, {})); }
  function saveConfig(c) { write(KEYS.config, c); }

  /* ---------------------- Publicar / sincronizar contenido ---------------------- */
  const SHARED = { sessions: Sessions, resources: Resources, library: Library, announcements: Announcements, cases: Cases, events: Events };

  function exportContent() {
    const data = { version: Date.now(), config: getConfig() };
    Object.entries(SHARED).forEach(([k, c]) => { data[k] = c.all(); });
    return data;
  }
  function importContent(json) {
    if (!json || typeof json !== 'object') return false;
    Object.entries(SHARED).forEach(([k, c]) => { if (Array.isArray(json[k])) c.replaceAll(json[k]); });
    if (json.config) saveConfig(json.config);
    if (json.version) localStorage.setItem(KEYS.published, String(json.version));
    localStorage.setItem(KEYS.seeded, '1');
    return true;
  }
  async function syncPublished() {
    try {
      const res = await fetch('data/content.json', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      if (String(json.version) !== String(localStorage.getItem(KEYS.published))) { importContent(json); return true; }
    } catch (e) { /* sin archivo publicado o sin conexión */ }
    return false;
  }
  function publishedLabel() {
    const v = localStorage.getItem(KEYS.published);
    return v ? new Date(Number(v)).toLocaleString('es-CO') : 'Aún no se ha publicado desde este navegador';
  }

  /* ------------------------------ Perfil y progreso ------------------------------ */
  function getProfile() { return read(KEYS.profile, { nombre: 'Estudiante UCEVA', correo: '', semestre: '' }); }
  function saveProfile(p) { write(KEYS.profile, p); }
  function getProgress() { return Object.assign({ sesionesVistas: [], recursosVistos: [], casosVistos: [], resvech: false, minutos: 0 }, read(KEYS.progress, {})); }
  function saveProgress(p) { write(KEYS.progress, p); }
  function markSeen(type, id) {
    const p = getProgress();
    const bucket = { sesion: 'sesionesVistas', recurso: 'recursosVistos', caso: 'casosVistos' }[type];
    if (bucket && !p[bucket].includes(id)) { p[bucket].push(id); saveProgress(p); }
    if (type === 'resvech' && !p.resvech) { p.resvech = true; saveProgress(p); }
    return p;
  }

  /* ---------------------------------- Semillas ---------------------------------- */
  function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;
    const hoy = '2026-11-13';

    const sesiones = [
      { numero: 1, fecha: '2027-02-02', tema: 'Presentación del módulo y bases de la cicatrización',
        objetivos: 'Describir la anatomía y fisiología de la piel, las fases de la cicatrización y diferenciar una herida aguda de una herida crónica.',
        contenido: 'Acuerdo pedagógico. Piel: epidermis, dermis, hipodermis y función de barrera. Fases de la cicatrización: hemostasia, inflamación, proliferación y remodelación. Concepto de herida crónica o de difícil cicatrización.',
        actividad: 'Mapa conceptual de las fases de cicatrización.', material: 'Diapositivas de la clase en Canva.',
        claseUrl: 'https://canva.link/86u93ieb61nx74x' },
      { numero: 2, fecha: '2027-02-09', tema: 'Valoración integral de la persona con herida crónica',
        objetivos: 'Aplicar la valoración integral (persona, herida y entorno) e identificar los factores sistémicos y locales que retrasan la cicatrización.',
        contenido: 'Historia clínica orientada a heridas: antecedentes, comorbilidades, nutrición, medicamentos, dolor, movilidad y factores psicosociales. Etiología de la herida. Perfusión: pulsos e índice tobillo-brazo.',
        actividad: 'Valoración guiada de un caso clínico.', material: 'Guía de valoración integral.', claseUrl: '' },
      { numero: 3, fecha: '2027-02-16', tema: 'Valoración de la herida y escala RESVECH 2.0',
        objetivos: 'Medir y describir una herida crónica con un instrumento validado y registrar su evolución hacia la cicatrización.',
        contenido: 'Medición del área y la profundidad. Bordes, tipo de tejido, exudado y signos de infección/biofilm. Índice RESVECH 2.0: ítems, puntuación de 0 a 35 e interpretación entre controles.',
        actividad: 'Aplicación de RESVECH 2.0 en el simulador.', material: 'Calculadora RESVECH de esta página y simulador.', claseUrl: '' },
      { numero: 4, fecha: '2027-02-23', tema: 'Infección de heridas y biopelícula',
        objetivos: 'Reconocer el continuo de la infección de heridas y los indicadores clínicos de biopelícula.',
        contenido: 'Continuo de infección del IWII: contaminación, colonización, infección local, propagación e infección sistémica. Signos ocultos y manifiestos. Biopelícula y cicatrización tardía.',
        actividad: 'Clasificar la etapa de infección en casos clínicos.', material: 'Consenso IWII 2022.', claseUrl: '' },
      { numero: 5, fecha: '2027-03-02', tema: 'Preparación del lecho: limpieza y desbridamiento',
        objetivos: 'Seleccionar la técnica de limpieza y el método de desbridamiento según la valoración de la herida.',
        contenido: 'Principios TIME/TIMERS. Limpieza terapéutica de la herida y la piel perilesional. Métodos de desbridamiento: autolítico, cortante conservador, mecánico, enzimático y biológico.',
        actividad: 'Taller simulado de limpieza y desbridamiento.', material: 'Guía de limpieza terapéutica 2025.', claseUrl: '' },
      { numero: 6, fecha: '2027-03-09', tema: 'Pie diabético: valoración y clasificación',
        objetivos: 'Valorar el pie de la persona con diabetes: neuropatía, enfermedad arterial, infección y riesgo de ulceración.',
        contenido: 'Exploración con monofilamento, pulsos e ITB. Clasificación de la úlcera de pie diabético. Descarga y educación para el autocuidado.',
        actividad: 'Caso clínico de pie diabético.', material: 'Guías IWGDF 2023.', claseUrl: '' },
      { numero: 7, fecha: '2027-03-16', tema: 'Úlceras de la extremidad inferior: insuficiencia venosa',
        objetivos: 'Diferenciar úlcera venosa, arterial y mixta, e indicar con seguridad la terapia compresiva.',
        contenido: 'Signos de insuficiencia venosa crónica. Índice tobillo-brazo antes de la compresión. Tipos de compresión y educación del paciente.',
        actividad: 'Caso clínico de insuficiencia venosa.', material: 'Consenso WUWHS 2024 sobre úlcera de pierna.', claseUrl: '' },
      { numero: 8, fecha: '2027-03-30', tema: 'Plan de cuidados, registro y seguimiento',
        objetivos: 'Construir un plan de cuidados basado en la valoración y hacer seguimiento con indicadores medibles.',
        contenido: 'Del dato al diagnóstico de enfermería. Objetivos medibles y reevaluación con RESVECH. Registro y fotografía clínica. Educación al paciente y su cuidador. Cierre del módulo.',
        actividad: 'Presentación de un plan de cuidados.', material: 'Plantilla de plan de cuidados.', claseUrl: '' }
    ];
    Sessions.replaceAll(sesiones.map((s, i) => Object.assign({ id: 'ses_' + (i + 1), hora: '2:00 p. m. – 6:00 p. m.' }, s)));

    Resources.replaceAll([
      // Videos del SIAA
      { id: 'res_v1', categoria: 'Videos', titulo: 'El instrumento SACS', descripcion: 'Video educativo del SIAA sobre el instrumento SACS para valorar y clasificar las lesiones de la piel periestomal.', url: SIAA + '/videos/video1.mp4', media: 'video', fuente: 'SIAA' },
      { id: 'res_v2', categoria: 'Videos', titulo: 'Valoración de heridas', descripcion: 'Video educativo del SIAA sobre la valoración de heridas, para repasar antes de aplicar la escala RESVECH 2.0.', url: SIAA + '/videos/video2.mp4', media: 'video', fuente: 'SIAA' },
      // Guías del SIAA
      { id: 'res_g1', categoria: 'Guías', titulo: 'Guías IWGDF para la prevención y el manejo de la enfermedad del pie relacionada con la diabetes (2023)', descripcion: 'Guías internacionales sobre prevención, clasificación, evaluación vascular, infección, descarga y manejo integral del pie diabético, en traducción oficial al español.', autores: 'International Working Group on the Diabetic Foot (IWGDF)', url: SIAA + '/pdfs/iwgdf-2023-pie-diabetico.pdf', media: 'pdf', fuente: 'SIAA' },
      { id: 'res_g2', categoria: 'Guías', titulo: 'Limpieza terapéutica de heridas y piel: evidencia clínica y recomendaciones (2025)', descripcion: 'Consenso internacional del IWII sobre agentes, técnica e indicaciones para limpiar la herida y la piel perilesional como parte de la preparación del lecho.', autores: 'Haesler E, Swanson T, Ousey K, Larsen D, Sussman G — IWII', url: SIAA + '/pdfs/limpieza-terapeutica-heridas-2025.pdf', media: 'pdf', fuente: 'SIAA' },
      // Libros y textos de valoración de heridas
      { id: 'res_l1', categoria: 'Libros', titulo: 'Atención integral de las heridas crónicas (2.ª edición)', descripcion: 'Libro de referencia en español del GNEAUPP. Sus capítulos de valoración integral del paciente, valoración de la lesión e instrumentos de medida son base para este módulo.', autores: 'García-Fernández FP, Soldevilla-Ágreda JJ, Torra-Bou JE (eds.). Logroño: GNEAUPP-FSJJ; 2016. ISBN 978-84-608-5924-6', url: 'https://gneaupp.info/', media: 'enlace', fuente: 'GNEAUPP' },
      { id: 'res_l2', categoria: 'Libros', titulo: 'Guía para la prevención y manejo de las UPP y heridas crónicas', descripcion: 'Guía del Instituto Nacional de Gestión Sanitaria (Ministerio de Sanidad de España) para unificar criterios de valoración, prevención y tratamiento de las úlceras por presión y heridas crónicas según la evidencia disponible.', autores: 'Barón Burgos MM, Benítez Ramírez MM, Caparrós Cervantes A, et al. Madrid: INGESA, Ministerio de Sanidad; 2015', url: 'https://ingesa.sanidad.gob.es/eu/dam/jcr:65f0eef2-7459-4389-93e6-45b8cfb32a6f/Guia_Prevencion_UPP.pdf', media: 'enlace', fuente: 'Ministerio de Sanidad' },
      // Artículos científicos (se conservan)
      { id: 'res_1', categoria: 'Artículos científicos', tema: 'Infección', titulo: 'IWII Wound Infection in Clinical Practice consensus document: 2022 update', autores: 'Swanson T, Ousey K, Haesler E, et al. — International Wound Infection Institute (IWII)', descripcion: 'Consenso internacional (Journal of Wound Care, 2022) sobre identificación, diagnóstico y tratamiento de la infección de heridas, biopelícula, limpieza, desbridamiento y uso prudente de antimicrobianos.', doi: 'https://doi.org/10.12968/jowc.2022.31.Sup12.S10', url: 'https://woundsinternational.com/wp-content/uploads/2023/05/IWII-CD-2022-web.pdf', media: 'pdf' },
      { id: 'res_2', categoria: 'Artículos científicos', tema: 'Insuficiencia venosa', titulo: 'Leg ulceration in venous and arteriovenous insufficiency: assessment and management with compression therapy', autores: 'Nair HK, Mosti G, Atkin L, et al. — World Union of Wound Healing Societies (WUWHS)', descripcion: 'Consenso internacional (Journal of Wound Care, 2024) sobre la valoración de la úlcera de pierna venosa, arterial y mixta, y el uso seguro de la terapia de compresión.', doi: 'https://doi.org/10.12968/jowc.2024.33.Sup10b.S1', url: 'https://www.journalofwoundcare.com/docs/Leg%20ulceration%20in%20venous%20and%20arteriovenous%20insuffeciency.pdf', media: 'pdf' },
      // Infografías (se ven en pantalla)
      { id: 'res_i1', categoria: 'Infografías', titulo: 'Valoración de la herida crónica paso a paso', descripcion: 'Infografía del módulo: de la valoración de la persona a la puntuación RESVECH 2.0 y su seguimiento.', url: 'assets/infografia-valoracion.svg', media: 'imagen', fuente: 'Módulo' },
      { id: 'res_i2', categoria: 'Infografías', titulo: 'Pie diabético y úlceras: diagnóstico diferencial', descripcion: 'Infografía del SIAA que compara úlcera neuropática, isquémica y venosa, con la clasificación PEDIS.', url: SIAA + '/pdfs/infografia-pie-diabetico-ulceras.pdf', media: 'pdf', fuente: 'SIAA' },
      // Podcasts del SIAA
      { id: 'res_p1', categoria: 'Podcasts', titulo: 'El fin de la colonización crítica', descripcion: 'Episodio 1 del podcast del SIAA sobre infección de heridas y el concepto de colonización crítica.', url: SIAA + '/podcasts/podcast1.m4a', media: 'audio', fuente: 'SIAA' },
      { id: 'res_p2', categoria: 'Podcasts', titulo: 'Clasifica la dermatitis DAI con GLOBIAD', descripcion: 'Episodio 2 del podcast del SIAA: cómo reconocer y clasificar la dermatitis asociada a la incontinencia con la herramienta GLOBIAD.', url: SIAA + '/podcasts/podcast2.m4a', media: 'audio', fuente: 'SIAA' }
    ]);

    Library.replaceAll([
      { id: 'lib_1', tema: 'Heridas', titulo: 'Validación para Colombia del índice RESVECH 2.0 para la valoración de cicatrización en heridas crónicas', autores: 'Restrepo-Medrano JC', revista: 'Revista Avances en Salud', anio: 2019, descripcion: 'Estudio de validación en tres hospitales colombianos: RESVECH 2.0 mostró alta fiabilidad y validez para valorar a pie de cama cualquier herida crónica, por lo que se recomienda en guías de cuidado.', doi: 'https://doi.org/10.21897/25394622.1748', url: 'https://bibliotecadigital.udea.edu.co/bitstream/10495/22884/1/RestrepoJuan_2019_%c3%8dndiceRESVECH.pdf' },
      { id: 'lib_2', tema: 'Ostomías', titulo: 'Implicaciones prácticas de la Guía Internacional de Ostomía WCET® 2020', autores: 'Chabal LO, Prentice JL, Ayello EA', revista: 'WCET® Journal', anio: 2021, descripcion: 'Presenta las 15 recomendaciones de la guía internacional de ostomía en educación, cuidado holístico y cuidados pre y posoperatorios, con versión en español.', doi: 'https://doi.org/10.33235/wcet.41.2.10-21', url: 'https://journals.cambridgemedia.com.au/wcetes/volume-41-number-2/practice-implications-wcetr-international-ostomy-guideline-2020' },
      { id: 'lib_3', tema: 'Biofilm', titulo: 'A proactive healing strategy for tackling biofilm-based surgical site complications: Wound Hygiene Surgical', autores: 'Murphy C, et al. — panel de consenso internacional', revista: 'Journal of Wound Care (supl.)', anio: 2024, descripcion: 'Consenso que aplica el protocolo de higiene de la herida (limpiar, desbridar, reavivar bordes y cubrir) para prevenir y manejar la biopelícula.', doi: 'https://doi.org/10.12968/jowc.2024.33.Sup5c.S1', url: 'https://www.journalofwoundcare.com/docs/SSI%20Consensus.pdf' },
      { id: 'lib_4', tema: 'Apósitos', titulo: 'Biomedical materials for wound dressing: recent advances and applications', autores: 'Nguyen HM, Ngoc Le TT, Nguyen AT, Thien Le HN, Pham TT', revista: 'RSC Advances', anio: 2023, descripcion: 'Revisión de los apósitos modernos (espumas, hidrocoloides, alginatos, hidrogeles, películas) y criterios para elegirlos según el tipo de herida.', doi: 'https://doi.org/10.1039/D2RA07673J', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9924226' },
      { id: 'lib_5', tema: 'NPWT', titulo: 'Revisiting negative pressure wound therapy from a mechanobiological perspective supported by clinical and pathological data', autores: 'Gefen A, Russo S, Ciliberti M', revista: 'International Wound Journal', anio: 2024, descripcion: 'Explica cómo actúa la terapia de presión negativa en heridas crónicas y quirúrgicas, y compara los sistemas tradicionales con los de un solo uso.', doi: 'https://doi.org/10.1111/iwj.70098', url: 'https://doi.org/10.1111/iwj.70098' },
      { id: 'lib_6', tema: 'Lesiones por presión', titulo: 'Prevention and Treatment of Pressure Ulcers/Injuries: The International Guideline (4.ª edición)', autores: 'NPIAP, EPUAP y PPPIA — Haesler E (ed.)', revista: 'International Guideline', anio: 2025, descripcion: 'Cuarta edición de la guía internacional, desarrollada con metodología GRADE, sobre valoración del riesgo, prevención y tratamiento de las lesiones por presión. Descarga gratuita.', doi: '', url: 'https://www.internationalguideline.com/the-international-guideline' },
      { id: 'lib_7', tema: 'Pie diabético', titulo: 'Practical guidelines on the prevention and management of diabetes-related foot disease (IWGDF 2023 update)', autores: 'Schaper NC, van Netten JJ, Apelqvist J, Bus SA, Fitridge R, Game F, et al.', revista: 'Diabetes/Metabolism Research and Reviews', anio: 2024, descripcion: 'Resumen práctico de las siete guías IWGDF 2023: prevención, clasificación, descarga, enfermedad arterial, infección e intervenciones para la cicatrización.', doi: 'https://doi.org/10.1002/dmrr.3657', url: 'https://iwgdfguidelines.org/practical-guidelines-2023/' },
      { id: 'lib_8', tema: 'Quemaduras', titulo: 'An overview of recent developments in the management of burn injuries', autores: 'Radzikowska-Büchner E, Łopuszyńska I, Flieger W, et al.', revista: 'International Journal of Molecular Sciences', anio: 2023, descripcion: 'Revisión de los avances en el manejo de las quemaduras: limpieza, tratamientos tópicos, tipos de apósitos, injertos, nutrición, dolor y cicatriz.', doi: 'https://doi.org/10.3390/ijms242216357', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10671630' },
      { id: 'lib_9', tema: 'Infección', titulo: 'IWII Wound Infection in Clinical Practice consensus document: 2022 update', autores: 'Swanson T, Ousey K, Haesler E, et al.', revista: 'Journal of Wound Care', anio: 2022, descripcion: 'Continuo de infección de heridas, signos clínicos, biopelícula, limpieza, desbridamiento y uso prudente de antimicrobianos.', doi: 'https://doi.org/10.12968/jowc.2022.31.Sup12.S10', url: 'https://woundsinternational.com/wp-content/uploads/2023/05/IWII-CD-2022-web.pdf' },
      { id: 'lib_10', tema: 'Insuficiencia venosa', titulo: 'Leg ulceration in venous and arteriovenous insufficiency: assessment and management with compression therapy', autores: 'Nair HK, Mosti G, Atkin L, et al. — WUWHS', revista: 'Journal of Wound Care (supl.)', anio: 2024, descripcion: 'Valoración vascular, del dolor, de la extremidad y de la herida, e indicaciones y técnica de la terapia de compresión.', doi: 'https://doi.org/10.12968/jowc.2024.33.Sup10b.S1', url: 'https://www.journalofwoundcare.com/docs/Leg%20ulceration%20in%20venous%20and%20arteriovenous%20insuffeciency.pdf' },
      { id: 'lib_11', tema: 'Desbridamiento', titulo: 'Best practice for wound debridement (International Consensus Document)', autores: 'Mayer DO, Tettelbach WH, Ciprandi G, et al.', revista: 'Journal of Wound Care (supl.)', anio: 2024, descripcion: 'Recomendaciones sobre cuándo y cómo desbridar, comparación de métodos e introducción del concepto de desbridamiento integral.', doi: 'https://doi.org/10.12968/jowc.2024.33.Sup6b.S1', url: 'https://journalofwoundcare.com/docs/debridementConsensus.pdf' }
    ]);

    Announcements.replaceAll([
      { id: 'anu_1', titulo: '¡Bienvenidos a la página de valoración de heridas crónicas!', mensaje: 'Aquí encontrarás la programación del primer semestre de 2027 (clases los martes), recursos, biblioteca científica, casos clínicos y la escala RESVECH 2.0 para practicar.', fecha: hoy },
      { id: 'anu_2', titulo: 'Nuevo: calculadora RESVECH 2.0', mensaje: 'Ya puedes aplicar la escala RESVECH 2.0 desde el menú Aprendizaje y practicar con el simulador del caso clínico.', fecha: hoy }
    ]);

    Cases.replaceAll([
      { id: 'caso_pd', titulo: 'Pie diabético: herida en talón derecho', tipo: 'Pie diabético',         motivo: 'Herida en talón derecho de 3 semanas de evolución, iniciada tras roce con calzado nuevo. Consulta ambulatoria porque no cicatriza.',
        paciente: 'Hombre de 62 años, trabaja de pie la mayor parte del día y vive solo.',
        datos: [
          ['Antecedentes', 'Diabetes mellitus tipo 2 de 12 años de evolución, control metabólico irregular (HbA1c 9,2 %).'],
          ['Medicamentos', 'Metformina 850 mg cada 12 h e insulina NPH nocturna; refiere olvidos frecuentes de la insulina.'],
          ['Signos vitales', 'TA 130/85 mmHg, FC 82 lpm, T 36,8 °C, afebril.'],
          ['Sensibilidad protectora', 'Prueba con monofilamento de 10 g: sensibilidad ausente en el pie derecho.'],
          ['Pulsos e ITB', 'Pulsos pedio y tibial posterior débiles pero palpables. ITB 0,8 (compromiso vascular leve).'],
          ['Herida', 'Lesión de 2,5 cm en el talón, lecho con granulación parcial y esfacelo amarillento, profundidad hasta tejido subcutáneo.'],
          ['Exudado', 'Moderado, seroso, sin mal olor.'],
          ['Piel perilesional', 'Callosidad marcada alrededor de la lesión, piel seca y con fisuras.'],
          ['Calzado y autocuidado', 'Calzado cerrado sin protección especial, sin plantillas. Revisión diaria de los pies irregular y poco apoyo familiar.']
        ],
        preguntas: [
          '¿Qué datos de la valoración son prioritarios y por qué?',
          '¿Qué hallazgos indican neuropatía y cuáles enfermedad arterial?',
          'Aplica RESVECH 2.0 con los datos disponibles: ¿qué ítems puedes puntuar y qué información te falta?',
          'Formula un diagnóstico de enfermería y dos intervenciones prioritarias (incluye descarga y educación).'
        ] },
      { id: 'caso_iv', titulo: 'Insuficiencia venosa: úlcera en maléolo interno', tipo: 'Insuficiencia venosa',         motivo: 'Úlcera en el maléolo interno derecho de 2 meses de evolución, con aumento progresivo de tamaño.',
        paciente: 'Mujer de 68 años, docente activa, permanece de pie entre 7 y 8 horas al día.',
        datos: [
          ['Antecedentes', 'Insuficiencia venosa crónica diagnosticada hace 10 años, con várices visibles en ambas piernas. Obesidad (IMC 32).'],
          ['Medicamentos', 'No toma medicamentos de forma regular.'],
          ['Signos vitales', 'TA 125/80 mmHg, FC 78 lpm, afebril.'],
          ['Pulsos e ITB', 'Pulsos pedio y tibial posterior presentes y simétricos. ITB 1,1 (sin compromiso arterial significativo).'],
          ['Sensibilidad', 'Conservada, sin alteraciones neurológicas.'],
          ['Úlcera', 'Maléolo interno derecho, 4 × 3 cm, bordes irregulares, lecho con granulación y algo de fibrina.'],
          ['Edema', 'Bilateral, con fóvea, aumenta al final del día.'],
          ['Piel perilesional', 'Hiperpigmentación (dermatitis ocre) e induración (lipodermatoesclerosis).'],
          ['Exudado y dolor', 'Exudado abundante, seroso, sin mal olor. Dolor leve que aumenta al final del día y mejora al elevar la pierna.']
        ],
        preguntas: [
          '¿Qué hallazgos confirman el origen venoso de la úlcera?',
          '¿Por qué el ITB es indispensable antes de indicar terapia compresiva?',
          'Aplica RESVECH 2.0: ¿qué puntaje obtienes en dimensiones, tejido y exudado?',
          'Plantea una meta medible para los próximos 7 días y las intervenciones educativas que la apoyan.'
        ] }
    ]);

    Events.replaceAll(sesiones.map((s, i) => ({ id: 'evt_' + (i + 1), tipo: 'Clase', titulo: 'Sesión ' + s.numero + ': ' + s.tema, fecha: s.fecha })));
    saveConfig(DEFAULT_CONFIG);
    localStorage.setItem(KEYS.seeded, '1');
  }

  return {
    KEYS, uid, SIAA,
    Sessions, Resources, Library, Announcements, Cases, Events, Personal,
    getConfig, saveConfig, getProfile, saveProfile, getProgress, saveProgress, markSeen,
    seed, exportContent, importContent, syncPublished, publishedLabel,
    resetAll: () => Object.values(KEYS).forEach(k => localStorage.removeItem(k))
  };
})();
