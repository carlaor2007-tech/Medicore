let currentUser = null;
let currentRole = 'medico';
let chatHistory = []; // {role:'user'|'bot', text}
let statsChartsRendered = false;
let voiceEnabled = true;
let recognition = null;
let isListening = false;

// ======== TOASTS ========
function toast(msg, type='success') {
  const cont = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? '' : type);
  const icon = type === 'error' ? '❌' : type === 'info' ? 'ℹ️' : '✅';
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  cont.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
}

// ======== DARK MODE ========
function initTheme() {
  const saved = localStorage.getItem('medicore_theme');
  if (saved === 'dark') document.body.classList.add('dark');
  updateThemeIcon();
}
function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('medicore_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  updateThemeIcon();
}
function updateThemeIcon() {
  document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙');
}

// ======== AUTH ========
function openLogin(role) {
  currentRole = role;
  switchRole(role);
  document.getElementById('loginOverlay').classList.add('show');
}
function closeLogin() { document.getElementById('loginOverlay').classList.remove('show'); }

// ======== FICHA SOS DE EMERGENCIA (sin login) ========
function openSosLookup() {
  document.getElementById('sosLookupView').style.display = 'block';
  document.getElementById('sosResultView').style.display = 'none';
  document.getElementById('sosError').style.display = 'none';
  document.getElementById('sosCodeInput').value = '';
  document.getElementById('sosOverlay').classList.add('show');
}
function closeSosLookup() { document.getElementById('sosOverlay').classList.remove('show'); }
function lookupSos() {
  const code = document.getElementById('sosCodeInput').value.trim().toUpperCase();
  const p = PATIENTS.find(x => x.sosCode === code);
  const err = document.getElementById('sosError');
  if (!p) { err.style.display = 'block'; return; }
  err.style.display = 'none';
  document.getElementById('sosNombre').textContent = p.name;
  document.getElementById('sosEdadGenero').textContent = `${p.age} años · ${p.gender}`;
  document.getElementById('sosBlood').textContent = p.blood;
  document.getElementById('sosAlergias').textContent = p.alergias;
  document.getElementById('sosMeds').innerHTML = p.meds.length
    ? p.meds.map(m => `<div style="font-size:.85rem;padding:6px 0;border-bottom:1px solid var(--gray-100)">💊 ${m}</div>`).join('')
    : '<div style="font-size:.85rem;color:var(--gray-400)">Sin medicación activa registrada.</div>';
  document.getElementById('sosMedico').textContent = p.medico;
  document.getElementById('sosLookupView').style.display = 'none';
  document.getElementById('sosResultView').style.display = 'block';
}
function switchRole(role) {
  currentRole = role;
  document.querySelectorAll('#loginOverlay .role-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('roleBtn-'+role).classList.add('active');
  const hint = document.getElementById('demoHint');
  const hints = {
    medico: '<strong>Demo médico:</strong> ana@hospital.com / 1234<br><strong>Demo médico 2:</strong> luis@hospital.com / 1234',
    paciente: '<strong>Demo paciente:</strong> maria@email.com / 1234<br><strong>Demo paciente 2:</strong> carlos@email.com / 1234',
    cuidador: '<strong>Demo familiar:</strong> carmen@email.com / 1234 <span style="color:var(--gray-400)">(vinculada a María López)</span>',
  };
  hint.innerHTML = hints[role] || '';
}
function doLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  const u = USERS[email];
  if (!u || u.pass !== pass || u.role !== currentRole) { err.style.display = 'block'; return; }
  err.style.display = 'none';
  currentUser = { ...u, email };
  chatHistory = [];
  closeLogin();
  launchApp();
}
function logout() {
  currentUser = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('landing').style.display = 'flex';
  document.getElementById('chatWindow').classList.remove('open');
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ======== APP LAUNCH ========
function launchApp() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').classList.add('show');
  document.getElementById('chatFab').style.display = 'flex';
  document.getElementById('navUserName').textContent = (currentUser.title || '') + ' ' + currentUser.name;
  const roleLabels = { medico: currentUser.esp, paciente: 'Paciente · ' + currentUser.pacId, cuidador: 'Familiar · ' + currentUser.parentesco };
  document.getElementById('navUserRole').textContent = roleLabels[currentUser.role] || '';
  document.getElementById('navAvatar').textContent = currentUser.avatar;
  const avatarClass = { medico: 'avatar-blue', paciente: 'avatar-green', cuidador: 'avatar-purple' };
  document.getElementById('navAvatar').className = 'user-avatar ' + (avatarClass[currentUser.role] || 'avatar-green');

  buildSidebar();

  if (currentUser.role === 'medico') {
    document.getElementById('docWelcome').textContent = 'Buenos días, ' + currentUser.title + ' ' + currentUser.name + ' 👋';
    renderPatientTable(PATIENTS);
    renderInformes();
    renderCitasTable();
    renderDocStats();
    goTo('doc-dashboard');
    requestNotificationPermission();
    checkNewPatientRequests();
    setInterval(checkNewPatientRequests, 5 * 60 * 1000);
  } else if (currentUser.role === 'cuidador') {
    renderFamDashboard();
    goTo('fam-dashboard');
    requestNotificationPermission();
    checkAppointmentReminders(currentUser.linkedPacId, true);
    setInterval(() => checkAppointmentReminders(currentUser.linkedPacId, true), 5 * 60 * 1000);
    setTimeout(() => announceNextAppointment(currentUser.linkedPacId), 900);
  } else {
    const p = PATIENTS.find(x => x.id === currentUser.pacId);
    document.getElementById('pacWelcome').textContent = 'Hola, ' + currentUser.name.split(' ')[0] + ' 👋';
    document.getElementById('pacId').textContent = 'Tu identificador: ' + currentUser.pacId + ' · ' + (p ? p.diag : '');
    document.getElementById('pacSosCode').textContent = p ? p.sosCode : '—';
    renderPatientMeds();
    goTo('pac-dashboard');
    requestNotificationPermission();
    checkAppointmentReminders(currentUser.pacId);
    setInterval(() => checkAppointmentReminders(currentUser.pacId), 5 * 60 * 1000);
    setTimeout(() => announceNextAppointment(currentUser.pacId), 900);
  }
}

// ======== AVISO DE PRÓXIMA CITA AL ENTRAR ========
function nextAppointmentFor(pacId) {
  const mine = CITAS.filter(c => c.pacId === pacId && c.fechaISO).sort((a,b) => new Date(a.fechaISO) - new Date(b.fechaISO));
  const future = mine.find(c => new Date(c.fechaISO) > new Date());
  return future || mine[0] || null;
}
function announceNextAppointment(pacId) {
  const next = nextAppointmentFor(pacId);
  toast(next ? `Próxima cita: ${next.fecha} ${next.hora}` : 'No tienes citas programadas', 'info');
}

// ======== SIDEBAR ========
function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (currentUser.role === 'medico') {
    sidebar.innerHTML = `
      <div class="sidebar-section">Principal</div>
      <button class="nav-item" data-page="doc-dashboard" onclick="goTo('doc-dashboard')"><span class="icon">📊</span> Inicio</button>
      <button class="nav-item" data-page="doc-pacientes" onclick="goTo('doc-pacientes')"><span class="icon">👥</span> Pacientes <span class="badge">${PATIENTS.length}</span></button>
      <button class="nav-item" data-page="doc-citas" onclick="goTo('doc-citas')"><span class="icon">📅</span> Citas <span class="badge badge-green">${CITAS.length}</span></button>
      <div class="sidebar-section">Herramientas</div>
      <button class="nav-item" data-page="doc-informes" onclick="goTo('doc-informes')"><span class="icon">📋</span> Informes</button>
      <button class="nav-item" data-page="doc-nuevo-informe" onclick="goTo('doc-nuevo-informe')"><span class="icon">✏️</span> Nuevo informe</button>
      <button class="nav-item" data-page="doc-stats" onclick="goTo('doc-stats')"><span class="icon">📈</span> Estadísticas</button>`;
  } else if (currentUser.role === 'cuidador') {
    sidebar.innerHTML = `
      <div class="sidebar-section">Modo Familiar</div>
      <button class="nav-item" data-page="fam-dashboard" onclick="goTo('fam-dashboard')"><span class="icon">🏠</span> Inicio</button>
      <button class="nav-item" data-page="pac-farmacias" onclick="openPharmacyFinder()"><span class="icon">📍</span> Farmacias cercanas</button>`;
  } else {
    sidebar.innerHTML = `
      <div class="sidebar-section">Mi Portal</div>
      <button class="nav-item" data-page="pac-dashboard" onclick="goTo('pac-dashboard')"><span class="icon">🏠</span> Inicio</button>
      <button class="nav-item" data-page="pac-cita" onclick="goTo('pac-cita')"><span class="icon">📅</span> Pedir cita</button>
      <button class="nav-item" data-page="pac-informes" onclick="goTo('pac-informes')"><span class="icon">📋</span> Mis informes</button>
      <button class="nav-item" data-page="pac-farmacias" onclick="goTo('pac-farmacias')"><span class="icon">📍</span> Farmacias cercanas</button>
      <button class="nav-item" data-page="pac-perfil" onclick="goTo('pac-perfil')"><span class="icon">👤</span> Mi perfil</button>`;
  }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ======== NAVIGATION ========
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('#sidebar .nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  closeSidebarMobile();
  if (page === 'doc-stats') renderStatsCharts();
  if (page === 'doc-citas') clearNewCitasFlag();
  if (page === 'doc-dashboard' && currentUser?.role === 'medico') renderDocStats();
}

// ======== PATIENTS TABLE ========
function renderPatientTable(list) {
  const statusMap = { activo:'tag-green', seguimiento:'tag-amber', alta:'tag-blue' };
  document.getElementById('patTableBody').innerHTML = list.map(p => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="user-avatar" style="background:${p.color};width:32px;height:32px;font-size:.75rem;flex-shrink:0">${p.initials}</div>
        <div><div style="font-weight:600">${p.name}</div><div style="font-size:.75rem;color:var(--gray-400)">${p.medico}</div></div>
      </div></td>
      <td><span class="pac-id">${p.id}</span></td>
      <td>${p.age} años</td>
      <td>${p.diag}</td>
      <td>${p.lastVisit}</td>
      <td><span class="tag ${statusMap[p.status]||'tag-gray'}">${p.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="openPatient('${p.id}')">Ver ficha</button></td>
    </tr>`).join('');
}
function highlight(text, q) {
  if (!q) return text;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return text.replace(re, '<mark class="hl">$1</mark>');
}
function filterPatients(v) {
  const q = v.trim();
  const lc = q.toLowerCase();
  const filtered = PATIENTS.filter(p => p.name.toLowerCase().includes(lc) || p.id.toLowerCase().includes(lc) || p.diag.toLowerCase().includes(lc));
  const statusMap = { activo:'tag-green', seguimiento:'tag-amber', alta:'tag-blue' };
  document.getElementById('patTableBody').innerHTML = filtered.length ? filtered.map(p => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="user-avatar" style="background:${p.color};width:32px;height:32px;font-size:.75rem;flex-shrink:0">${p.initials}</div>
        <div><div style="font-weight:600">${highlight(p.name, q)}</div><div style="font-size:.75rem;color:var(--gray-400)">${p.medico}</div></div>
      </div></td>
      <td><span class="pac-id">${highlight(p.id, q)}</span></td>
      <td>${p.age} años</td>
      <td>${highlight(p.diag, q)}</td>
      <td>${p.lastVisit}</td>
      <td><span class="tag ${statusMap[p.status]||'tag-gray'}">${p.status}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="openPatient('${p.id}')">Ver ficha</button></td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:24px">Sin resultados para "' + q + '".</td></tr>';
}

// ======== PATIENT DETAIL ========
function openPatient(id) {
  const p = PATIENTS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('fichaHeader').innerHTML = `
    <div class="patient-avatar">${p.initials}</div>
    <div class="patient-info">
      <h3>${p.name}</h3>
      <div class="patient-meta">
        <span class="pac-id">${p.id}</span>
        <span class="meta-item">⚧ ${p.gender}</span>
        <span class="meta-item">🎂 ${p.age} años</span>
        <span class="meta-item">🩸 ${p.blood}</span>
        <span class="meta-item">👨‍⚕️ ${p.medico}</span>
      </div>
      ${p.alergias !== 'Ninguna' ? `<div style="margin-top:8px;font-size:.8rem;background:var(--red-light);color:var(--red);padding:4px 10px;border-radius:99px;display:inline-block">⚠️ Alergia: ${p.alergias}</div>` : ''}
    </div>`;
  document.getElementById('fichaInfo').innerHTML = `
    <div class="info-item"><div class="label">Diagnóstico</div><div class="value">${p.diag}</div></div>
    <div class="info-item"><div class="label">Grupo sanguíneo</div><div class="value">${p.blood}</div></div>
    <div class="info-item"><div class="label">Alergias</div><div class="value">${p.alergias}</div></div>
    <div class="info-item"><div class="label">Última visita</div><div class="value">${p.lastVisit}</div></div>
    <div class="info-item"><div class="label">Médico asignado</div><div class="value">${p.medico}</div></div>
    <div class="info-item"><div class="label">Estado</div><div class="value">${p.status}</div></div>`;
  document.getElementById('fichaHistorial').innerHTML = p.historial.map(h => `
    <div class="timeline-item">
      <div class="timeline-dot ${h.dot}">${h.icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">${h.title}</div>
        <div class="timeline-date">${h.date}</div>
        <div class="timeline-text">${h.text}</div>
      </div>
    </div>`).join('');
  currentFichaPacId = p.id;
  renderFichaMedicacion(p);
  goTo('doc-ficha');
}

// ======== INTERACCIONES MEDICAMENTOSAS ========
function findMedInteractions(medsList) {
  const lower = medsList.map(m => m.toLowerCase());
  return INTERACCIONES_CONOCIDAS.filter(rule =>
    lower.some(m => m.includes(rule.a)) && lower.some(m => m.includes(rule.b))
  );
}
function interactionsBannerHtml(medsList) {
  const found = findMedInteractions(medsList);
  if (!found.length) return '';
  const nivelColor = { alta:'var(--red)', media:'var(--amber)', baja:'var(--gray-600)' };
  return `<div style="margin-bottom:14px;padding:12px 14px;background:var(--red-light);border-radius:var(--radius-sm)">
    <div style="font-weight:700;font-size:.85rem;color:var(--red);margin-bottom:6px">⚠️ Posibles interacciones detectadas</div>
    ${found.map(f => `<div style="font-size:.8rem;color:${nivelColor[f.nivel]};margin-bottom:4px">• ${f.texto}</div>`).join('')}
  </div>`;
}

// Refresca cualquier vista (paciente o familiar vinculado) que esté mostrando la medicación de este paciente.
function refreshMedsViewsFor(pacId) {
  if (!currentUser) return;
  if (currentUser.role === 'paciente' && currentUser.pacId === pacId) renderPatientMeds();
  if (currentUser.role === 'cuidador' && currentUser.linkedPacId === pacId) renderFamDashboard();
}

// ======== INFORMES EN LENGUAJE SENCILLO ========
// Traductor básico por patrones (no es IA real): sustituye jerga médica frecuente
// y números de tensión/analítica por frases llanas. Pensado como ayuda de accesibilidad,
// no como sustituto de la explicación del médico.
const GLOSARIO_SENCILLO = [
  [/hba1c/gi, 'tu nivel de azúcar en sangre a largo plazo (HbA1c)'],
  [/colesterol ldl/gi, 'tu nivel de colesterol "malo" (LDL)'],
  [/colesterol(?!\s*"malo")/gi, 'el colesterol (la grasa en la sangre)'],
  [/glucosa en ayunas/gi, 'tu nivel de azúcar en sangre en ayunas'],
  [/glucémic[oa]/gi, 'relacionado con el azúcar en sangre'],
  [/hemoglobina/gi, 'la hemoglobina (lo que lleva el oxígeno en la sangre)'],
  [/anemia ferropénica/gi, 'anemia por falta de hierro'],
  [/analítica/gi, 'el análisis de sangre'],
  [/ecg|electrocardiograma/gi, 'el electrocardiograma (la prueba del corazón)'],
  [/ecocardiograma/gi, 'la ecografía del corazón'],
  [/edemas/gi, 'la hinchazón'],
  [/artrosis/gi, 'el desgaste en las articulaciones'],
  [/protector gástrico/gi, 'el medicamento para proteger el estómago'],
  [/descompensaciones/gi, 'empeoramientos'],
  [/cumplimiento/gi, 'que sigue bien el tratamiento'],
  [/fe:\s*(\d+)%/gi, 'el corazón bombea con un $1% de eficacia'],
  [/(\d+)\/(\d+)\s*mmhg/gi, 'tensión $1 sobre $2'],
  [/(\d+(\.\d+)?)\s*mg\/dl/gi, '$1 (en una unidad de laboratorio)'],
];
function simplifyText(text) {
  let out = text;
  for (const [pattern, replacement] of GLOSARIO_SENCILLO) out = out.replace(pattern, replacement);
  return '🗣️ En palabras sencillas: ' + out;
}
function toggleSimpleExplain(btn) {
  const card = btn.closest('.report-card');
  const textEl = card.querySelector('.r-text');
  if (!textEl.dataset.original) textEl.dataset.original = textEl.textContent;
  if (btn.dataset.simple === '1') {
    textEl.textContent = textEl.dataset.original;
    btn.textContent = '🗣️ Explicar en sencillo';
    btn.dataset.simple = '0';
  } else {
    textEl.textContent = simplifyText(textEl.dataset.original);
    btn.textContent = '↩️ Ver texto original';
    btn.dataset.simple = '1';
  }
}

// ======== MEDICACIÓN (vista médico: editar/borrar) ========
let currentFichaPacId = null;
function renderFichaMedicacion(p) {
  const banner = interactionsBannerHtml(p.meds);
  const lista = p.meds.length ? p.meds.map((m, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <span style="font-size:1.2rem">💊</span>
      <span style="font-size:.88rem;flex:1">${m}</span>
      <button class="btn btn-ghost btn-sm" onclick="editMed(${i})" title="Editar">✏️</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteMed(${i})" title="Eliminar">🗑️</button>
    </div>`).join('') : '<p style="font-size:.85rem;color:var(--gray-400)">Sin medicación activa.</p>';
  document.getElementById('fichaMedicacion').innerHTML = banner + lista;
}
function editMed(i) {
  const p = PATIENTS.find(x => x.id === currentFichaPacId);
  if (!p) return;
  const nuevo = prompt('Editar medicación:', p.meds[i]);
  if (nuevo === null) return;
  const limpio = nuevo.trim();
  if (!limpio) { toast('La medicación no puede quedar vacía.', 'error'); return; }
  p.meds[i] = limpio;
  persistPatients();
  renderFichaMedicacion(p);
  refreshMedsViewsFor(p.id);
  toast('Medicación actualizada');
}
function deleteMed(i) {
  const p = PATIENTS.find(x => x.id === currentFichaPacId);
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.meds[i]}" de la medicación del paciente?`)) return;
  p.meds.splice(i, 1);
  persistPatients();
  renderFichaMedicacion(p);
  refreshMedsViewsFor(p.id);
  toast('Medicación eliminada');
}

// ======== MEDICACIÓN (vista paciente) ========
function renderPatientMeds() {
  const container = document.getElementById('pacMedsList');
  if (!container) return;
  const p = PATIENTS.find(x => x.id === currentUser.pacId);
  const meds = p ? p.meds : [];
  if (!meds.length) { container.innerHTML = '<p style="font-size:.85rem;color:var(--gray-400)">No tienes medicación activa registrada.</p>'; return; }
  container.innerHTML = interactionsBannerHtml(meds) + meds.map(m => `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600;font-size:.9rem">${m}</div>
        <span class="tag tag-green">Activo</span>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="openPharmacyFinder('${m.replace(/'/g, "\\'")}')">📍 Buscar dónde comprarlo</button>
    </div>`).join('');
}

// ======== MODO FAMILIAR / CUIDADOR (solo lectura) ========
function renderFamDashboard() {
  const pacId = currentUser.linkedPacId;
  const p = PATIENTS.find(x => x.id === pacId);
  if (!p) return;
  document.getElementById('famWelcome').textContent = `👨‍👩‍👧 Hola, ${currentUser.name.split(' ')[0]}`;
  document.getElementById('famPacienteNombre').textContent = p.name;

  const next = nextAppointmentFor(pacId);
  document.getElementById('famProximaCita').innerHTML = next
    ? `<div class="appt-item"><div class="appt-time">${next.fecha}<br>${next.hora}</div><div class="appt-info"><div class="appt-name">${next.motivo}</div><div class="appt-detail">PAC-ID: ${pacId}</div></div><span class="tag tag-blue">${next.estado}</span></div>`
    : '<p style="font-size:.85rem;color:var(--gray-400)">No hay citas programadas.</p>';

  const medsContainer = document.getElementById('famMedsList');
  medsContainer.innerHTML = p.meds.length
    ? interactionsBannerHtml(p.meds) + p.meds.map(m => `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600;font-size:.9rem">${m}</div>
        <span class="tag tag-green">Activo</span>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="openPharmacyFinder('${m.replace(/'/g, "\\'")}')">📍 Buscar dónde comprarlo</button>
    </div>`).join('')
    : '<p style="font-size:.85rem;color:var(--gray-400)">Sin medicación activa registrada.</p>';

  const informesPaciente = userInformes.filter(inf => inf.pacId === pacId);
  document.getElementById('famInformesList').innerHTML = informesPaciente.length ? informesPaciente.map(inf => `
    <div class="report-card">
      <div class="r-header"><div class="r-title">${inf.tipo}</div><div class="r-date">${inf.fecha}</div></div>
      <div class="r-text">${inf.diag}</div>
      <div style="margin-top:8px;font-size:.8rem;color:var(--gray-600)">💊 ${inf.med} · Próxima revisión: ${inf.next}</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="toggleSimpleExplain(this)">🗣️ Explicar en sencillo</button>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="downloadReportPDF(this)">📄 Descargar PDF</button>
    </div>`).join('') : '<p style="font-size:.85rem;color:var(--gray-400)">Sin informes registrados todavía.</p>';
}

// ======== INFORMES ========
function renderInformes() {
  document.getElementById('listaInformes').innerHTML = userInformes.length ? userInformes.map(inf => `
    <div class="report-card">
      <div class="r-header">
        <div class="r-title">${inf.tipo}</div>
        <div style="display:flex;gap:8px;align-items:center"><div class="r-date">${inf.fecha}</div></div>
      </div>
      <div class="r-doctor">👤 ${inf.pacNombre} · <span class="pac-id">${inf.pacId}</span></div>
      <div class="r-text">${inf.diag}</div>
      <div style="margin-top:8px;font-size:.8rem;color:var(--gray-600)">💊 ${inf.med} · Próxima revisión: ${inf.next}</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="toggleSimpleExplain(this)">🗣️ Explicar en sencillo</button>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="downloadReportPDF(this)">📄 Descargar PDF</button>
    </div>`).join('') : '<p style="font-size:.85rem;color:var(--gray-400)">Aún no has emitido ningún informe.</p>';
}
function autoFillPatient(v) {
  const p = PATIENTS.find(x => x.id === v.toUpperCase());
  document.getElementById('infPacNombre').value = p ? p.name : '';
}
function guardarInforme() {
  const pacId = document.getElementById('infPacId').value.toUpperCase();
  const tipo = document.getElementById('infTipo').value;
  const diag = document.getElementById('infDiag').value;
  const med = document.getElementById('infMed').value;
  const fecha = document.getElementById('infFecha').value;
  const p = PATIENTS.find(x => x.id === pacId);
  if (!p || !diag) { toast('Rellena al menos el PAC-ID y el diagnóstico.', 'error'); return; }
  userInformes.unshift({ pacId, pacNombre: p.name, tipo, fecha: new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}), diag, med: med || 'Sin medicación nueva', next: fecha || '—' });
  persistInformes();
  renderInformes();
  let nuevasMeds = 0, repetidas = 0;
  if (med.trim()) {
    med.split('\n').map(l => l.trim()).filter(Boolean).forEach(linea => {
      const yaExiste = p.meds.some(m => m.toLowerCase() === linea.toLowerCase());
      if (yaExiste) { repetidas++; return; }
      p.meds.unshift(linea);
      nuevasMeds++;
    });
    if (nuevasMeds) persistPatients();
    refreshMedsViewsFor(pacId);
  }
  let msg = 'Informe guardado correctamente';
  if (nuevasMeds) msg += ' · medicación añadida a la ficha del paciente';
  if (repetidas) msg += ` · ${repetidas} medicación${repetidas > 1 ? 'es' : ''} ya existía${repetidas > 1 ? 'n' : ''} y no se duplicó${repetidas > 1 ? 'aron' : ''}`;
  toast(msg);
  if (nuevasMeds) {
    findMedInteractions(p.meds).forEach(int => toast('⚠️ ' + int.texto, 'error'));
  }
  document.getElementById('infPacId').value = '';
  document.getElementById('infPacNombre').value = '';
  document.getElementById('infDiag').value = '';
  document.getElementById('infMed').value = '';
  document.getElementById('infFecha').value = '';
  setTimeout(() => goTo('doc-informes'), 600);
}

// ======== CITAS (médico) ========
function citaCategoria(c) {
  const fecha = c.fechaISO ? new Date(c.fechaISO) : null;
  if (!fecha || isNaN(fecha)) return 'proximas';
  const now = new Date();
  const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const finHoy = new Date(inicioHoy.getTime() + 24 * 3600 * 1000);
  if (fecha < inicioHoy) return 'historico';
  if (fecha < finHoy) return 'hoy';
  return 'proximas';
}
function markPastCitasNoShow() {
  let changed = false;
  CITAS.forEach(c => {
    if (citaCategoria(c) === 'historico' && (c.estado === 'Pendiente' || c.estado === 'Programada')) {
      c.estado = 'No asistió';
      changed = true;
    }
  });
  if (changed) persistCitas();
}
let citasFilter = 'hoy';
function setCitasFilter(f) {
  citasFilter = f;
  document.querySelectorAll('#citasFilterTabs .role-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderCitasTable();
}
function renderCitasTable() {
  markPastCitasNoShow();
  const tagMap = { Confirmada:'tag-green', Pendiente:'tag-amber', Programada:'tag-blue', Completada:'tag-purple', 'No asistió':'tag-red' };
  const actionMap = { Confirmada:'Completar', Pendiente:'Confirmar', Programada:'Confirmar' };
  const filtered = CITAS
    .map((c, i) => ({ c, i, cat: citaCategoria(c) }))
    .filter(({ cat }) => citasFilter === 'todas' || cat === citasFilter);
  document.getElementById('citasTableBody').innerHTML = filtered.length ? filtered.map(({ c, i, cat }) => `
    <tr${c.nueva ? ' style="background:var(--blue-light)"' : ''}>
      <td>${c.fecha}${c.nueva ? ' <span class="tag tag-blue" style="font-size:.65rem">🆕 Nueva</span>' : ''}${cat === 'hoy' ? ' <span class="tag tag-green" style="font-size:.65rem">Hoy</span>' : ''}</td><td>${c.hora}</td><td>${c.paciente}</td>
      <td><span class="pac-id">${c.pacId}</span></td><td>${c.motivo}</td>
      <td><span class="tag ${tagMap[c.estado]||'tag-gray'}">${c.estado}</span></td>
      <td>${actionMap[c.estado] ? `<button class="btn btn-ghost btn-sm" onclick="advanceCita(${i})">${actionMap[c.estado]}</button>` : '—'}</td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:24px">No hay citas en este filtro.</td></tr>';
}
function renderDocStats() {
  const hoy = CITAS.filter(c => citaCategoria(c) === 'hoy');
  const pendientesHoy = hoy.filter(c => c.estado === 'Pendiente').length;
  const now = new Date();
  const en7dias = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const citasPendientes7d = CITAS.filter(c => {
    if (!c.fechaISO || (c.estado !== 'Pendiente' && c.estado !== 'Programada')) return false;
    const f = new Date(c.fechaISO);
    return f >= now && f <= en7dias;
  }).length;
  document.getElementById('statPacientesHoy').textContent = hoy.length;
  document.getElementById('statPacientesHoySub').textContent = pendientesHoy ? `${pendientesHoy} pendientes` : 'todas gestionadas';
  document.getElementById('statTotalPacientes').textContent = PATIENTS.length;
  document.getElementById('statInformes').textContent = userInformes.length;
  document.getElementById('statCitasPendientes').textContent = citasPendientes7d;
}
function clearNewCitasFlag() {
  let changed = false;
  CITAS.forEach(c => { if (c.nueva) { c.nueva = false; changed = true; } });
  if (changed) { persistCitas(); renderCitasTable(); }
  document.querySelector('#sidebar [data-page="doc-citas"] .dot-alert')?.remove();
}
function checkNewPatientRequests() {
  const nuevas = CITAS.filter(c => c.nueva);
  if (!nuevas.length) return;
  toast(`📅 Tienes ${nuevas.length} cita${nuevas.length > 1 ? 's' : ''} nueva${nuevas.length > 1 ? 's' : ''} solicitada${nuevas.length > 1 ? 's' : ''} por pacientes`, 'info');
  if ('Notification' in window && Notification.permission === 'granted') {
    nuevas.forEach(c => new Notification('📅 MediCore — Nueva cita solicitada', { body: `${c.paciente} solicita cita: ${c.motivo} (${c.fecha} ${c.hora})` }));
  }
  const navItem = document.querySelector('#sidebar [data-page="doc-citas"]');
  if (navItem && !navItem.querySelector('.dot-alert')) {
    const dot = document.createElement('span');
    dot.className = 'dot-alert';
    navItem.appendChild(dot);
  }
}
function advanceCita(i) {
  const flow = { Pendiente:'Confirmada', Confirmada:'Completada', Programada:'Confirmada' };
  const c = CITAS[i];
  if (flow[c.estado]) { c.estado = flow[c.estado]; persistCitas(); renderCitasTable(); toast(`Cita de ${c.paciente} actualizada a "${c.estado}"`); }
}

// ======== CITAS (paciente) ========
function updateDoctores() {
  const esp = document.getElementById('citaEsp').value;
  const map = {
    'Medicina General': ['Dr. Ana García','Dr. Luis Martín'],
    'Cardiología': ['Dr. Ana García'],
    'Traumatología': ['Dr. Luis Martín'],
    'Neurología': ['Dra. Carmen Vega'],
    'Dermatología': ['Dr. Javier Pons'],
  };
  const sel = document.getElementById('citaMedico');
  sel.innerHTML = (map[esp]||[]).map(d => `<option>${d}</option>`).join('') || '<option>— Selecciona especialidad —</option>';
}
function pedirCita() {
  const esp = document.getElementById('citaEsp').value;
  const motivo = document.getElementById('citaMotivo').value;
  const fecha = document.getElementById('citaFecha').value;
  const hora = document.getElementById('citaHora').value;
  const medico = document.getElementById('citaMedico').value;
  if (!esp || !motivo) { toast('Selecciona especialidad y describe el motivo.', 'error'); return; }
  const fechaISO = fecha ? new Date(`${fecha}T${hora || '09:00'}:00`).toISOString() : null;
  CITAS.unshift({
    fecha: fecha ? new Date(fecha).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '—',
    fechaISO, hora, paciente: currentUser.name, pacId: currentUser.pacId, motivo, estado:'Programada', medico, nueva:true
  });
  persistCitas();
  document.getElementById('citaSuccess').style.display = 'block';
  toast('Cita confirmada correctamente');
  setTimeout(() => { document.getElementById('citaSuccess').style.display='none'; }, 4000);
}

// ======== ESTADÍSTICAS (médico) ========
let chartCitas, chartDiag, chartEvolucion;
function renderStatsCharts() {
  if (statsChartsRendered) { chartCitas.destroy(); chartDiag.destroy(); chartEvolucion.destroy(); }
  statsChartsRendered = true;

  // Citas por semana (simulado a partir de fechas conocidas, agrupado simplificado)
  const semanas = ['Sem 1','Sem 2','Sem 3','Sem 4'];
  const citasPorSemana = [3, 5, 4, CITAS.length];

  // Diagnósticos más frecuentes
  const diagCount = {};
  PATIENTS.forEach(p => { diagCount[p.diag] = (diagCount[p.diag]||0) + 1; });
  const diagLabels = Object.keys(diagCount);
  const diagData = Object.values(diagCount);

  // Evolución de pacientes (simulado por meses recientes)
  const meses = ['Feb','Mar','Abr','May','Jun'];
  const pacientesNuevos = [2, 3, 1, 4, PATIENTS.length];

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#CBD5E1' : '#475569';
  Chart.defaults.color = textColor;
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

  chartCitas = new Chart(document.getElementById('chartCitas'), {
    type:'bar',
    data:{ labels: semanas, datasets:[{ label:'Citas', data: citasPorSemana, backgroundColor:'#2563EB', borderRadius:6 }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
  chartDiag = new Chart(document.getElementById('chartDiag'), {
    type:'pie',
    data:{ labels: diagLabels, datasets:[{ data: diagData, backgroundColor:['#2563EB','#10B981','#F59E0B','#8B5CF6','#EC4899','#EF4444'] }] },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{size:11} } } } }
  });
  chartEvolucion = new Chart(document.getElementById('chartEvolucion'), {
    type:'line',
    data:{ labels: meses, datasets:[{ label:'Pacientes nuevos', data: pacientesNuevos, borderColor:'#10B981', backgroundColor:'rgba(16,185,129,.15)', tension:.35, fill:true }] },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });
}

// ======== CHATBOT ========
const botAnswers = [
  { keys:['cita','pedir','solicitar','reservar'], answer:`Claro, te explico paso a paso cómo pedir una cita:<br><br>
    <strong>1.</strong> Mira el menú de la izquierda de tu pantalla y busca donde dice <strong>"📅 Pedir cita"</strong>. Pulsa ahí.<br><br>
    <strong>2.</strong> Te aparecerá un formulario. Primero elige la <strong>Especialidad</strong> (por ejemplo, "Medicina General" si es una revisión normal, o "Cardiología" si es del corazón).<br><br>
    <strong>3.</strong> Después elige el <strong>médico</strong> de la lista que aparece.<br><br>
    <strong>4.</strong> Elige el <strong>día</strong> que quieras venir y la <strong>hora</strong> que más te convenga.<br><br>
    <strong>5.</strong> Escribe brevemente el <strong>motivo</strong> de la visita (por ejemplo: "dolor de espalda" o "revisión de la tensión").<br><br>
    <strong>6.</strong> Por último, pulsa el botón verde que dice <strong>"✅ Confirmar cita"</strong>.<br><br>
    Y ya está, tu cita queda guardada. Si tienes dudas mientras lo haces, vuelve a preguntarme aquí.` },
  { keys:['cancelar cita','anular cita'], answer:'Para cancelar una cita tienes que llamar por teléfono a recepción del hospital y decirles el día y la hora de tu cita, o pedirle a tu médico que la anule. De momento no se puede cancelar sola desde aquí, pero estamos trabajando para añadirlo pronto.' },
  { keys:['portal del paciente','portal paciente','entrar como paciente','iniciar sesión','cómo entro','cómo accedo','acceder a mi cuenta'], answer:`Te explico cómo entrar a tu cuenta, paso a paso:<br><br>
    <strong>1.</strong> En la pantalla principal, arriba a la derecha, busca el botón que dice <strong>"Soy Paciente"</strong> y pulsa ahí.<br><br>
    <strong>2.</strong> Se abrirá una ventana pequeña para iniciar sesión. Asegúrate de que está seleccionada la pestaña <strong>"👤 Paciente"</strong> (si no, pulsa sobre ella).<br><br>
    <strong>3.</strong> Donde dice <strong>"Correo electrónico"</strong>, escribe el correo que te dio el hospital (por ejemplo: maria@email.com).<br><br>
    <strong>4.</strong> Donde dice <strong>"Contraseña"</strong>, escribe tu contraseña (las letras o números secretos que usas para entrar).<br><br>
    <strong>5.</strong> Por último, pulsa el botón azul que dice <strong>"Entrar →"</strong>.<br><br>
    Si no recuerdas tu correo o tu contraseña, lo mejor es llamar a recepción del hospital para que te ayuden a recuperarlos.` },
  { keys:['informe','document','resultado'], answer:'Tus informes están en 📋 <strong>Mis informes</strong>. Solo tú puedes verlos — están cifrados y son privados.' },
  { keys:['pac-id','identificador','código','pac'], answer:'El <strong>PAC-ID</strong> es tu número único de paciente (ej. PAC-00101). Te identifica de forma segura en el sistema sin exponer datos personales como el DNI.' },
  { keys:['medicamento','medicina','pastilla','fármaco'], answer:'Puedes ver tu medicación activa en <strong>Mi panel → Mis medicamentos</strong>. Te avisamos cuando quedan pocos días de tratamiento.' },
  { keys:['médico','doctor','especialista'], answer:'Puedes ver qué médico tienes asignado en 👤 <strong>Mi perfil</strong>. Para cambiar de médico, contacta con administración.' },
  { keys:['especialidad'], answer:'Disponemos de Medicina General, Cardiología, Traumatología, Neurología y Dermatología. Puedes elegir la especialidad al pedir cita.' },
  { keys:['horario','hora de atención','abre','cierra'], answer:'El hospital atiende de 08:00 a 12:00 y de 16:00 a 17:30, de lunes a viernes. Urgencias está disponible 24h.' },
  { keys:['contraseña','pass','cuenta','acceso'], answer:'Si olvidaste tu contraseña, contacta con el equipo del hospital para restablecerla.' },
  { keys:['alergia'], answer:'Tus alergias registradas aparecen en 👤 <strong>Mi perfil</strong>. Si detectas un error, avisa a tu médico para que lo actualice.' },
  { keys:['hola','buenos días','buenas','hey'], answer:null }, // se gestiona aparte para personalizar
  { keys:['gracias','perfecto','genial','vale'], answer:'¡De nada! 😊 Si tienes más preguntas, estoy aquí para ayudarte.' },
  { keys:['urgencia','urgente','emergencia'], answer:'⚠️ Para urgencias médicas llama al <strong>112</strong> o acude directamente a urgencias del hospital. Este chat es solo para gestión administrativa.' },
  { keys:['adiós','chao','bye'], answer:'¡Hasta pronto! Si necesitas algo más, aquí estaré. 👋' },
];

// Respuestas para visitantes que aún no han iniciado sesión (landing pública)
const guestAnswers = [
  { keys:['servicio','especialidad','ofrece','ofrecéis','tratáis'], answer:'En MediCore ofrecemos Medicina General, Cardiología, Traumatología, Neurología y Dermatología. Una vez tengas cuenta, puedes pedir cita en cualquiera de ellas.' },
  { keys:['registrar','crear cuenta','soy nuevo','nuevo paciente','darme de alta'], answer:'Para registrarte como paciente nuevo, contacta con recepción del hospital o pide a tu médico que cree tu ficha. Una vez tengas tus credenciales, podrás entrar como "Paciente".' },
  { keys:['horario','hora de atención','abre','cierra'], answer:'El hospital atiende de 08:00 a 12:00 y de 16:00 a 17:30, de lunes a viernes. Urgencias está disponible 24h.' },
  { keys:['precio','coste','cuesta','gratis','pago'], answer:'MediCore es la plataforma de gestión del hospital; las tarifas de consulta dependen de tu seguro o convenio. Pregunta en recepción para más detalles.' },
  { keys:['médico','doctor','especialista','quién atiende'], answer:'Contamos con un equipo de médicos en distintas especialidades. Podrás ver el tuyo asignado una vez inicies sesión como paciente.' },
  { keys:['urgencia','urgente','emergencia'], answer:'⚠️ Para urgencias médicas llama al <strong>112</strong> o acude directamente a urgencias del hospital. Este chat es solo informativo.' },
];

function getGuestName() { return localStorage.getItem('medicore_guest_name') || null; }
function setGuestName(n) { localStorage.setItem('medicore_guest_name', n); }

function currentDisplayName() {
  if (currentUser) return currentUser.name.split(' ')[0];
  return getGuestName();
}

function toggleChat() {
  const win = document.getElementById('chatWindow');
  win.classList.toggle('open');
  if (win.classList.contains('open') && chatHistory.length === 0) {
    const name = currentDisplayName();
    const greeting = currentUser
      ? `¡Hola, ${name}! 👋 Soy la Dra. MediCore IA, tu asistente médico personal. Puedo ayudarte con citas, informes, medicación y dudas generales. ¿En qué puedo ayudarte?`
      : (name
          ? `¡Hola de nuevo, ${name}! 👋 Soy la Dra. MediCore IA. ¿En qué puedo ayudarte hoy?`
          : `¡Hola! 👋 Soy la Dra. MediCore IA, tu asistente virtual. Puedo resolver dudas sobre el hospital, especialidades, horarios o cómo registrarte. ¿Cómo te llamas?`);
    addChatMsg(greeting, 'bot', false);
    if (!currentUser) speak(greeting);
  }
}
function quickMsg(txt) { document.getElementById('chatInput').value = txt; sendChat(); }

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  addChatMsg(msg, 'user');
  input.value = '';
  document.getElementById('chatChips').style.display = 'none';
  showTyping();
  setTimeout(() => {
    hideTyping();
    const reply = buildBotReply(msg);
    addChatMsg(reply.text, 'bot');
    if (!currentUser) speak(reply.spoken || reply.text);
  }, 700);
}

function buildBotReply(msg) {
  const lc = msg.toLowerCase();

  // Si es un visitante sin nombre guardado y el mensaje parece ser su nombre tras el saludo inicial
  if (!currentUser && !getGuestName() && chatHistory.length <= 2 && /^[a-záéíóúñ\s]{2,30}$/i.test(msg) && !/(hola|cita|informe|hospital|gracias|adiós|urgencia)/.test(lc)) {
    const name = msg.trim().split(' ')[0];
    setGuestName(name.charAt(0).toUpperCase() + name.slice(1));
    return { text: `Encantada de conocerte, ${name}! 😊 Pregúntame lo que necesites sobre el hospital, especialidades, horarios o cómo pedir cita.` };
  }

  if (/(hola|buenos días|buenas|hey)/.test(lc)) {
    const name = currentDisplayName();
    return { text: `¡Hola${name ? ', ' + name : ''}! 😊 Estoy aquí para ayudarte. Puedes preguntarme sobre citas, informes, medicación o el funcionamiento del hospital.` };
  }

  // Prioridad: respuestas del área logueada, luego generales de invitado
  const found = botAnswers.find(a => a.answer && a.keys.some(k => lc.includes(k)))
             || guestAnswers.find(a => a.keys.some(k => lc.includes(k)));

  if (found) return { text: found.answer.replace(/<[^>]+>/g, m => m) , spoken: found.answer.replace(/<[^>]*>/g, '') };

  const name = currentDisplayName();
  return { text: `No tengo información exacta sobre eso${name ? ', ' + name : ''}. Para dudas específicas, contacta con el personal del hospital o llama a recepción. ¿Puedo ayudarte con algo más?` };
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'chat-typing';
  div.id = 'typingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  document.getElementById('chatMessages').appendChild(div);
  document.getElementById('chatMessages').scrollTop = 9999;
}
function hideTyping() { document.getElementById('typingIndicator')?.remove(); }
function addChatMsg(text, who, record = true) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + who;
  div.innerHTML = text;
  document.getElementById('chatMessages').appendChild(div);
  document.getElementById('chatMessages').scrollTop = 9999;
  if (record) chatHistory.push({ role: who, text });
}

// ======== VOZ: texto-a-voz (TTS) ========
function toggleVoice() {
  voiceEnabled = !voiceEnabled;
  document.getElementById('voiceToggleBtn').textContent = voiceEnabled ? '🔊' : '🔇';
  if (!voiceEnabled) window.speechSynthesis?.cancel();
}
let fixedVoice = null;
function pickFixedVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prioridad: voz española de España, femenina conocida > cualquier española > cualquier es-*
  const candidates = [
    v => v.lang === 'es-ES' && /helena|elvira|laura|lucia|mujer|female|sabina|paulina|esperanza/i.test(v.name),
    v => v.lang === 'es-ES',
    v => v.lang.startsWith('es') && /female|mujer|maria|lucia|monica/i.test(v.name),
    v => v.lang.startsWith('es'),
  ];
  for (const test of candidates) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0] || null;
}
function speak(text, onEnd) {
  if (!voiceEnabled || !('speechSynthesis' in window)) { onEnd?.(); return; }
  const clean = text.replace(/<[^>]*>/g, '').replace(/[*_#]/g, '');
  window.speechSynthesis.cancel();
  if (!fixedVoice) fixedVoice = pickFixedVoice();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = 'es-ES';
  utter.rate = 1.0;
  utter.pitch = 1.35;
  if (fixedVoice) utter.voice = fixedVoice;
  const avatar = document.getElementById('chatAvatar3d');
  utter.onstart = () => avatar?.classList.add('speaking');
  utter.onend = () => { avatar?.classList.remove('speaking'); onEnd?.(); };
  window.speechSynthesis.speak(utter);
}
function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('chatAvatar3d')?.classList.remove('speaking');
}

// ======== VOZ: voz-a-texto (STT) ========
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('chatInput').value = text;
    sendChat();
  };
  recognition.onend = () => { isListening = false; document.getElementById('micBtn')?.classList.remove('listening'); };
  recognition.onerror = () => { isListening = false; document.getElementById('micBtn')?.classList.remove('listening'); };
}
function toggleMic() {
  if (!recognition) { toast('Tu navegador no soporta reconocimiento de voz.', 'error'); return; }
  if (isListening) { recognition.stop(); return; }
  isListening = true;
  document.getElementById('micBtn').classList.add('listening');
  recognition.start();
}

// ======== FARMACIAS CERCANAS ========
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function openPharmacyFinder(medName) {
  document.getElementById('pharmacyFinderSub').textContent = medName
    ? `Farmacias donde puedes comprar: ${medName}`
    : 'Farmacias donde puedes comprar tu medicación';
  renderPharmacyList(PHARMACIES.map(f => ({ ...f, distKm: null })));
  goTo('pac-farmacias');
}
function locateUserForPharmacies() {
  if (!('geolocation' in navigator)) { toast('Tu navegador no soporta geolocalización.', 'error'); return; }
  const btn = document.getElementById('locateBtn');
  btn.textContent = '📡 Buscando tu ubicación...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.textContent = '📡 Usar mi ubicación';
      toast('Ubicación detectada. Mostrando las farmacias más cercanas.');
      const { latitude, longitude } = pos.coords;
      const withDist = PHARMACIES.map(f => ({ ...f, distKm: haversineKm(latitude, longitude, f.lat, f.lng) }));
      withDist.sort((a, b) => a.distKm - b.distKm);
      renderPharmacyList(withDist);
    },
    () => {
      btn.textContent = '📡 Usar mi ubicación';
      toast('No se ha podido acceder a tu ubicación. Te mostramos las farmacias de ejemplo.', 'error');
    }
  );
}
function renderPharmacyList(list) {
  // El orden de "list" llega ya calculado por distancia real cuando hay geolocalización (ver locateUserForPharmacies).
  // sponsored solo cambia el estilo de la tarjeta, nunca la posición.
  currentPharmacyList = list;
  document.getElementById('pharmacyList').innerHTML = list.map((f, i) => `
    <div class="card" style="margin-bottom:14px;overflow:hidden;cursor:pointer${f.sponsored ? ';border:1.5px solid var(--amber);background:var(--amber-light, #FFF8E8)' : ''}" onclick="openPharmacyDetail(${i})">
      <div class="pharm-icon-box${f.sponsored ? ' sponsored' : ''}">
        <div class="pharm-cross"></div>
        <div class="pharm-pill p1"></div>
        <div class="pharm-pill p2"></div>
        <div class="pharm-pill p3"></div>
      </div>
      <div class="card-header" style="margin-bottom:8px">
        <div>
          <div class="card-title">💊 ${f.name}${f.sponsored ? ' <span class="tag tag-amber" style="margin-left:6px;font-size:.68rem">★ Patrocinado</span>' : ''}</div>
          <div class="card-sub">${f.address}</div>
        </div>
        ${f.distKm != null ? `<span class="tag tag-blue">${f.distKm.toFixed(1)} km</span>` : `<span class="tag tag-gray">📍 sin ubicar</span>`}
      </div>
      <div style="font-size:.85rem;color:var(--gray-600);display:flex;gap:18px;flex-wrap:wrap;margin-top:6px">
        <span>🕒 ${f.horario}</span>
        <span>📞 ${f.tel}</span>
      </div>
    </div>`).join('');
}
let currentPharmacyList = [];
function openPharmacyDetail(i) {
  const f = currentPharmacyList[i];
  if (!f) return;
  document.getElementById('pharmacyDetailIconBox').className = 'pharm-icon-box detail' + (f.sponsored ? ' sponsored' : '');
  document.getElementById('pharmacyDetailName').textContent = '💊 ' + f.name;
  document.getElementById('pharmacyDetailSponsor').style.display = f.sponsored ? 'block' : 'none';
  document.getElementById('pharmacyDetailAddress').textContent = f.address;
  document.getElementById('pharmacyDetailDistance').textContent = f.distKm != null ? f.distKm.toFixed(1) + ' km' : 'Activa tu ubicación para ver la distancia';
  document.getElementById('pharmacyDetailHorario').textContent = f.horario;
  document.getElementById('pharmacyDetailTel').textContent = f.tel;
  document.getElementById('pharmacyDetailMapsBtn').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(f.address);
  document.getElementById('pharmacyOverlay').classList.add('show');
}
function closePharmacyDetail() {
  document.getElementById('pharmacyOverlay').classList.remove('show');
}

// ======== LEER INFORME EN VOZ ALTA ========
function speakReport(btn) {
  if (btn.dataset.speaking === '1') {
    stopSpeaking();
    btn.dataset.speaking = '0';
    btn.textContent = '🔊 Leer en voz alta';
    return;
  }
  const card = btn.closest('.report-card');
  const title = card.querySelector('.r-title')?.textContent || '';
  const doctor = card.querySelector('.r-doctor')?.textContent || '';
  const text = card.querySelector('.r-text')?.textContent || '';
  btn.dataset.speaking = '1';
  btn.textContent = '⏹ Detener lectura';
  speak(`Informe: ${title}. ${doctor}. ${text}`, () => {
    btn.dataset.speaking = '0';
    btn.textContent = '🔊 Leer en voz alta';
  });
  toast('Leyendo informe en voz alta...', 'info');
}

// ======== RECORDATORIO DE CITA 24H ANTES (notificación del navegador / móvil) ========
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}
function getNotifiedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('medicore_notified') || '[]')); }
  catch (e) { return new Set(); }
}
function saveNotifiedSet(set) { localStorage.setItem('medicore_notified', JSON.stringify([...set])); }

function checkAppointmentReminders(pacId, esFamiliar) {
  if (!currentUser || (currentUser.role !== 'paciente' && currentUser.role !== 'cuidador')) return;
  const notified = getNotifiedSet();
  const now = new Date();
  CITAS.filter(c => c.pacId === pacId && c.fechaISO).forEach(c => {
    const citaDate = new Date(c.fechaISO);
    const hoursLeft = (citaDate - now) / 36e5;
    const key = (esFamiliar ? 'fam-' : '') + c.pacId + '|' + c.fechaISO;
    if (hoursLeft > 0 && hoursLeft <= 24 && !notified.has(key)) {
      const msg = esFamiliar
        ? `Recordatorio: ${c.paciente} tiene una cita el ${c.fecha} a las ${c.hora} (${c.motivo}). ¡Faltan menos de 24 horas!`
        : `Recordatorio: tienes una cita el ${c.fecha} a las ${c.hora} (${c.motivo}). ¡Faltan menos de 24 horas!`;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('📅 MediCore — Recordatorio de cita', { body: msg, icon: '' });
      }
      toast(msg, 'info');
      notified.add(key);
      saveNotifiedSet(notified);
    }
  });
}

// ======== ACCESIBILIDAD: TEXTO GRANDE ========
function initAccessibility() {
  if (localStorage.getItem('medicore_largetext') === '1') {
    document.body.classList.add('large-text');
    updateAccessibilityIcon();
  }
}
function toggleLargeText() {
  document.body.classList.toggle('large-text');
  localStorage.setItem('medicore_largetext', document.body.classList.contains('large-text') ? '1' : '0');
  updateAccessibilityIcon();
}
function updateAccessibilityIcon() {
  document.querySelectorAll('.accessibility-toggle').forEach(b => b.classList.toggle('active', document.body.classList.contains('large-text')));
}

// ======== EXPORTAR CONVERSACIÓN DEL CHAT A PDF ========
function exportChatPDF() {
  if (!chatHistory.length) { toast('Aún no hay conversación para exportar.', 'error'); return; }
  if (typeof window.jspdf === 'undefined') { toast('No se pudo cargar el generador de PDF.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Conversación con la Dra. MediCore IA', 14, 18);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString('es-ES'), 14, 25);
  doc.setFontSize(11);
  let y = 36;
  chatHistory.forEach(m => {
    const who = m.role === 'user' ? 'Tú: ' : 'Dra. MediCore: ';
    const clean = (who + m.text).replace(/<[^>]*>/g, '');
    const lines = doc.splitTextToSize(clean, 180);
    lines.forEach(line => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 7;
    });
    y += 3;
  });
  doc.save('conversacion-medicore.pdf');
  toast('Conversación exportada a PDF');
}

// ======== DESCARGAR INFORME MÉDICO EN PDF ========
function downloadReportPDF(btn) {
  if (typeof window.jspdf === 'undefined') { toast('No se pudo cargar el generador de PDF.', 'error'); return; }
  const card = btn.closest('.report-card');
  const titulo = card.querySelector('.r-title')?.textContent || 'Informe médico';
  const fecha = card.querySelector('.r-date')?.textContent || '';
  const doctorLine = card.querySelector('.r-doctor')?.textContent || '';
  const texto = (card.querySelector('.r-text')?.dataset.original) || card.querySelector('.r-text')?.textContent || '';
  const medLine = Array.from(card.querySelectorAll('div')).find(d => d.textContent.includes('💊') && d.textContent.includes('revisión'))?.textContent || '';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('MediCore — Informe médico', 14, 18);
  doc.setFontSize(13);
  doc.text(titulo, 14, 30);
  doc.setFontSize(10);
  doc.text(fecha, 14, 37);
  let y = 47;
  if (doctorLine) {
    doc.setFontSize(11);
    doc.splitTextToSize(doctorLine.replace(/^👤\s*/, '').replace(/^🩺\s*/, ''), 180).forEach(line => { doc.text(line, 14, y); y += 7; });
    y += 3;
  }
  doc.setFontSize(11);
  doc.splitTextToSize(texto, 180).forEach(line => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 7;
  });
  if (medLine) {
    y += 5;
    doc.setFontSize(10);
    doc.splitTextToSize(medLine.trim(), 180).forEach(line => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 7;
    });
  }
  doc.setFontSize(8);
  doc.text('Generado desde MediCore · ' + new Date().toLocaleString('es-ES'), 14, 290);
  const nombreArchivo = 'informe-' + titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.pdf';
  doc.save(nombreArchivo);
  toast('Informe descargado en PDF');
}

// ======== INIT ========
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAccessibility();
  initSpeechRecognition();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => { fixedVoice = pickFixedVoice(); };
  }
});
