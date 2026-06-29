// ======== USUARIOS (no se persisten, son fijos de demo) ========
const USERS = {
  'ana@hospital.com':  { pass:'1234', role:'medico',   name:'Ana García',  title:'Dr.', esp:'Medicina General', avatar:'AG' },
  'luis@hospital.com': { pass:'1234', role:'medico',   name:'Luis Martín', title:'Dr.', esp:'Cardiología',       avatar:'LM' },
  'maria@email.com':   { pass:'1234', role:'paciente', name:'María López', pacId:'PAC-00101', avatar:'ML' },
  'carlos@email.com':  { pass:'1234', role:'paciente', name:'Carlos Ruiz', pacId:'PAC-00102', avatar:'CR' },
  // Modo cuidador/familiar: cuenta vinculada de solo lectura a un paciente, sin compartir su contraseña.
  'carmen@email.com':  { pass:'1234', role:'cuidador', name:'Carmen López', linkedPacId:'PAC-00101', parentesco:'Hija de María López', avatar:'CL' },
};

// ======== DATOS POR DEFECTO (semilla inicial para localStorage) ========
const DEFAULT_PATIENTS = [
  { id:'PAC-00101', name:'María López García',  age:34, gender:'Mujer',  blood:'A+',  diag:'Hipertensión arterial',   lastVisit:'15 Jun 2026', status:'activo',     alergias:'Penicilina', medico:'Dr. Ana García',  initials:'ML', color:'var(--blue)', sosCode:'SOS-7421',
    meds:['Enalapril 10mg — 1/día en ayunas','Lorazepam 1mg — si ansiedad'],
    historial:[
      {dot:'blue',icon:'🩺',title:'Revisión general',date:'15 Jun 2026',text:'Tensión controlada. Analítica normal. Continúa tratamiento.'},
      {dot:'green',icon:'💉',title:'Análisis de sangre',date:'02 May 2026',text:'Colesterol LDL 142 mg/dL. Dieta baja en grasas.'},
      {dot:'amber',icon:'❤️',title:'ECG cardíaco',date:'10 Mar 2026',text:'Sin alteraciones. Tensión: 128/82 mmHg.'},
    ]
  },
  { id:'PAC-00102', name:'Carlos Ruiz Fernández', age:52, gender:'Hombre', blood:'O+', diag:'Diabetes tipo 2',         lastVisit:'20 Jun 2026', status:'seguimiento', alergias:'Ninguna',    medico:'Dr. Ana García',  initials:'CR', color:'var(--purple)', sosCode:'SOS-3098',
    meds:['Metformina 850mg — 2/día con comidas','Linagliptina 5mg — 1/día'],
    historial:[
      {dot:'amber',icon:'🩸',title:'Control glucémico',date:'20 Jun 2026',text:'HbA1c: 7.2%. Dentro del objetivo terapéutico.'},
      {dot:'blue',icon:'🩺',title:'Revisión diabetes',date:'01 Abr 2026',text:'Se ajusta dosis de Metformina. Buen cumplimiento.'},
    ]
  },
  { id:'PAC-00103', name:'Elena Martín Soto',    age:28, gender:'Mujer',  blood:'B-',  diag:'Anemia ferropénica',      lastVisit:'10 Jun 2026', status:'activo',     alergias:'Ibuprofeno', medico:'Dr. Luis Martín', initials:'EM', color:'var(--green)', sosCode:'SOS-5512',
    meds:['Sulfato ferroso 325mg — 1/día','Vitamina C 500mg — con hierro'],
    historial:[
      {dot:'green',icon:'💊',title:'Inicio tratamiento hierro',date:'10 Jun 2026',text:'Hemoglobina: 9.8 g/dL. Inicia suplementación.'},
      {dot:'blue',icon:'🩺',title:'Primera consulta',date:'20 May 2026',text:'Cansancio, palidez. Se solicita analítica completa.'},
    ]
  },
  { id:'PAC-00104', name:'Pedro Sánchez Mora',   age:67, gender:'Hombre', blood:'AB+', diag:'Insuficiencia cardíaca',  lastVisit:'05 Jun 2026', status:'seguimiento', alergias:'AAS',        medico:'Dr. Ana García',  initials:'PS', color:'var(--amber)', sosCode:'SOS-8847',
    meds:['Bisoprolol 5mg — 1/día','Furosemida 40mg — 1/día mañana','Espironolactona 25mg — 1/día'],
    historial:[
      {dot:'amber',icon:'❤️',title:'Ecocardiograma',date:'05 Jun 2026',text:'FE: 42%. Mejora leve respecto a control anterior.'},
      {dot:'blue',icon:'🩺',title:'Revisión mensual',date:'05 May 2026',text:'Edemas reducidos. Peso estable. Sin descompensaciones.'},
    ]
  },
  { id:'PAC-00105', name:'Laura Gómez Díaz',     age:41, gender:'Mujer',  blood:'A-',  diag:'Lumbalgia crónica',       lastVisit:'22 May 2026', status:'activo',     alergias:'Ninguna',     medico:'Dr. Luis Martín', initials:'LG', color:'#EC4899', sosCode:'SOS-2266',
    meds:['Diclofenaco 50mg — si dolor agudo','Omeprazol 20mg — protector gástrico'],
    historial:[
      {dot:'blue',icon:'🦴',title:'RX lumbar',date:'22 May 2026',text:'Artrosis L4-L5 moderada. Se recomienda fisioterapia.'},
    ]
  },
];

const DEFAULT_INFORMES = [
  { pacId:'PAC-00101', pacNombre:'María López',  tipo:'Revisión general',   fecha:'15 Jun 2026', diag:'Tensión controlada. Analítica normal.',            med:'Enalapril 10mg · 1/día',   next:'15 Sep 2026' },
  { pacId:'PAC-00102', pacNombre:'Carlos Ruiz',  tipo:'Control glucémico',  fecha:'20 Jun 2026', diag:'HbA1c 7.2%. Buen control. Continúa tratamiento.',   med:'Metformina 850mg · 2/día', next:'20 Sep 2026' },
  { pacId:'PAC-00103', pacNombre:'Elena Martín', tipo:'Diagnóstico anemia', fecha:'10 Jun 2026', diag:'Anemia ferropénica. Inicio suplementación hierro.', med:'Sulfato ferroso 325mg',    next:'10 Jul 2026' },
];

// Farmacias reales de Vila-real (Castellón). Nombre, dirección, teléfono y coordenadas (lat/lng)
// verificados por búsqueda online (OpenStreetMap/Nominatim) para poder calcular distancia real.
// "sponsored" es un campo simulado para explorar a futuro un modelo de farmacias patrocinadas.
// El orden de la lista siempre se calcula por distancia real; sponsored solo añade una etiqueta visual.
const PHARMACIES = [
  { name:'Farmacia Latorre',        address:'Calle Juan Bta. Llorens, 70, Vila-real', lat:39.9426081, lng:-0.0998058, horario:'09:00–14:00, 17:00–20:30', tel:'964 52 14 45', sponsored:false },
  { name:'Farmacia Vilanova Gil',   address:'Calle Mayor San Jaime, 17, Vila-real',   lat:39.9376401, lng:-0.1003883, horario:'09:00–13:30, 17:00–20:30', tel:'964 52 16 02', sponsored:true },
  { name:'Farmacia Font de Mora',   address:'Calle Ermita, 213, Vila-real',           lat:39.9395842, lng:-0.1019603, horario:'09:00–13:30, 17:00–20:30', tel:'964 52 05 12', sponsored:false },
  { name:'Farmacia Clerigues Grau', address:'Calle Valencia, 13, Vila-real',          lat:39.9312370, lng:-0.1059763, horario:'09:00–14:00, 17:00–20:00', tel:'964 52 08 77', sponsored:false },
];

const DEFAULT_CITAS = [
  { fecha:'28 Jun 2026', fechaISO:'2026-06-28T09:00:00', hora:'09:00', paciente:'María López',   pacId:'PAC-00101', motivo:'Revisión general',    estado:'Confirmada' },
  { fecha:'28 Jun 2026', fechaISO:'2026-06-28T10:30:00', hora:'10:30', paciente:'Carlos Ruiz',   pacId:'PAC-00102', motivo:'Análisis de sangre',  estado:'Confirmada' },
  { fecha:'28 Jun 2026', fechaISO:'2026-06-28T12:00:00', hora:'12:00', paciente:'Elena Martín',  pacId:'PAC-00103', motivo:'Seguimiento anemia',  estado:'Pendiente' },
  { fecha:'28 Jun 2026', fechaISO:'2026-06-28T16:00:00', hora:'16:00', paciente:'Pedro Sánchez', pacId:'PAC-00104', motivo:'Primera visita',      estado:'Pendiente' },
  { fecha:'30 Jun 2026', fechaISO:'2026-06-30T11:00:00', hora:'11:00', paciente:'María López',   pacId:'PAC-00101', motivo:'Revisión tensión',    estado:'Programada' },
  { fecha:'02 Jul 2026', fechaISO:'2026-07-02T09:30:00', hora:'09:30', paciente:'Laura Gómez',   pacId:'PAC-00105', motivo:'Consulta dolor espalda', estado:'Programada' },
];

// ======== PERSISTENCIA EN LOCALSTORAGE ========
const STORAGE_KEYS = { patients:'medicore_patients', informes:'medicore_informes', citas:'medicore_citas' };

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch (e) {
    return structuredClone(fallback);
  }
}
function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let PATIENTS = loadFromStorage(STORAGE_KEYS.patients, DEFAULT_PATIENTS);
let userInformes = loadFromStorage(STORAGE_KEYS.informes, DEFAULT_INFORMES);
let CITAS = loadFromStorage(STORAGE_KEYS.citas, DEFAULT_CITAS);

function persistPatients() { saveToStorage(STORAGE_KEYS.patients, PATIENTS); }
function persistInformes() { saveToStorage(STORAGE_KEYS.informes, userInformes); }
function persistCitas() { saveToStorage(STORAGE_KEYS.citas, CITAS); }

function resetDemoData() {
  PATIENTS = structuredClone(DEFAULT_PATIENTS);
  userInformes = structuredClone(DEFAULT_INFORMES);
  CITAS = structuredClone(DEFAULT_CITAS);
  persistPatients(); persistInformes(); persistCitas();
}
