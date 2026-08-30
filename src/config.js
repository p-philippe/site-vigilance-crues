// ── CONFIG — Constantes globales ──────────────────────────────────────────

export const ST = {
'J061161001':{n:"St-Jouan-de-l'Isle [Pont Rimbert]",c:"Rance",p:false,s:{s1:1.20,s2:1.80,s3:2.40},lat:48.254107,lon:-2.167618,h:[{l:"28/02/2010 — Xynthia",v:2.60},{l:"16/01/2008",v:2.44},{l:"12/02/2026",v:1.98}]},
'J100452001':{n:"Pleslin-Trigavou [Vieux Moulin]",c:"Frémur",p:false,s:{s1:0.70,s2:1.10,s3:1.50},lat:48.550659,lon:-2.074754,h:[{l:"25/05/2010",v:1.92},{l:"28/02/2010 — Xynthia",v:1.49},{l:"17/01/2024",v:1.27}]},
'J110301001':{n:"Jugon-les-Lacs [Bois Léard]",c:"Arguenon",p:true,s:{s1:1.00,s2:1.50,s3:2.00},lat:48.402669,lon:-2.333372,h:[{l:"28/02/2010 — Xynthia",v:2.17},{l:"06/01/2001",v:2.12}]},
'J110581001':{n:"Plénée-Jugon [La Salle ès Pies]",c:"Quiloury",p:false,s:{s1:1.00,s2:1.50,s3:1.90},lat:48.371178,lon:-2.383216,h:[{l:"28/02/2010 — Xynthia",v:2.06},{l:"05/01/2001",v:2.04},{l:"18/01/2024",v:2.02}]},
'J111401001':{n:"Mégrit [Pont D 19]",c:"Rosette",p:true,s:{s1:0.80,s2:1.20,s3:1.55},lat:48.364962,lon:-2.248394,h:[{l:"07/02/2014",v:1.72},{l:"28/02/2010 — Xynthia",v:1.60},{l:"12/02/2026",v:1.46}]},
'J131301001':{n:"Andel [Le Quingueret]",c:"Gouessant",p:true,s:{s1:1.20,s2:1.80,s3:2.40},lat:48.484562,lon:-2.567963,h:[{l:"28/12/1999 — Martin",v:2.94},{l:"18/01/2024",v:2.59},{l:"12/02/2026",v:2.29}]},
'J132401001':{n:"Coëtmieux [La Rue]",c:"Evron",p:false,s:{s1:1.00,s2:1.50,s3:2.10},lat:48.490325,lon:-2.606063,h:[{l:"28/02/2010 — Xynthia",v:2.66},{l:"12/02/1988",v:2.27},{l:"18/01/2024",v:2.01}]},
'J140531001':{n:"Plédran [Magenta]",c:"Urne",p:false,s:{s1:0.70,s2:1.00,s3:1.40},lat:48.466786,lon:-2.751962,h:[{l:"03/10/2020",v:1.66},{l:"28/12/1999 — Martin",v:1.57},{l:"27/01/2025",v:1.47}]},
'J151301001':{n:"St-Julien [La Saudraie]",c:"Gouët",p:true,s:{s1:0.90,s2:1.30,s3:1.80},lat:48.446553,lon:-2.833334,h:[{l:"06/02/2014 & Xynthia",v:2.24},{l:"01/05/2001",v:2.18},{l:"19/02/2026",v:1.95}]},
'J161401002':{n:"Binic [Saint Gilles]",c:"Ic",p:false,s:{s1:0.90,s2:1.30,s3:1.80},lat:48.601097,lon:-2.852455,h:[{l:"03/10/2020",v:2.16},{l:"28/02/2010 — Xynthia",v:1.92},{l:"22/09/2025",v:1.78}]},
'J171171001':{n:"St-Péver [Pont Locminé]",c:"Trieux",p:true,s:{s1:0.90,s2:1.30,s3:1.80},lat:48.483218,lon:-3.114503,h:[{l:"28/02/2010 — Xynthia",v:2.22},{l:"26/01/1995",v:2.14},{l:"19/02/2026",v:1.74}]},
'J172172001':{n:"St-Clet [Chateaulin]",c:"Trieux",p:false,s:{s1:1.10,s2:1.60,s3:2.20},lat:48.690103,lon:-3.167077,h:[{l:"28/02/2010 — Xynthia",v:2.50},{l:"13/12/2000",v:2.25},{l:"18/01/2024",v:2.01}]},
'J180301001':{n:"Boqueho [Moulin Neuf]",c:"Leff",p:true,s:{s1:0.80,s2:1.20,s3:1.70},lat:48.481872,lon:-2.951262,h:[{l:"28/02/2010 — Xynthia",v:1.88},{l:"01/05/2001",v:1.86},{l:"19/02/2026",v:1.75}]},
'J181301001':{n:"Quemper-Guézennec [Rivoallan]",c:"Leff",p:false,s:{s1:1.00,s2:1.50,s3:2.10},lat:48.705903,lon:-3.068189,h:[{l:"28/02/2010 — Xynthia",v:2.61},{l:"10/01/1982",v:2.26},{l:"18/01/2024",v:1.87}]},
'J202301001':{n:"Mantallot [Kerbrido]",c:"Jaudy",p:true,s:{s1:1.20,s2:1.80,s3:2.50},lat:48.713855,lon:-3.270272,h:[{l:"28/02/2010 — Xynthia",v:3.25},{l:"11/12/2017",v:3.21},{l:"03/10/2020",v:3.08}]},
'J203401001':{n:"Plouguiel [Kerallio]",c:"Guindy",p:true,s:{s1:0.60,s2:0.90,s3:1.15},lat:48.782555,lon:-3.256646,h:[{l:"26/01/1995",v:1.33},{l:"28/12/1999 & 09/02/2001",v:1.29},{l:"01/03/2010 — Xynthia",v:1.20}]},
'J223301001':{n:"Belle-Isle-en-Terre",c:"Léguer",p:true,s:{s1:1.00,s2:1.50,s3:2.10},lat:48.547094,lon:-3.398424,h:[{l:"12/12/2000",v:2.95},{l:"24/12/2013",v:2.45},{l:"28/02/2010 — Xynthia",v:2.18}]},
'J223302001':{n:"Pluzunet [Pont Coat Dunois]",c:"Léguer",p:true,s:{s1:1.10,s2:1.70,s3:2.30},lat:48.635780,lon:-3.414355,h:[{l:"13/12/2000",v:2.89},{l:"24/12/2013",v:2.71},{l:"28/02/2010 — Xynthia",v:2.57}]},
'J371301001':{n:"Trébrivan [Le Nezert]",c:"Hyère",p:false,s:{s1:1.20,s2:1.80,s3:2.40},lat:48.321005,lon:-3.510224,h:[{l:"13/12/2000",v:2.87},{l:"26/01/1995 & Martin 99",v:2.61},{l:"02/01/2024",v:2.56}]},
'J520211001':{n:"Kerien [Kerlouët]",c:"Blavet",p:false,s:{s1:0.40,s2:0.60,s3:0.75},lat:48.391519,lon:-3.250834,h:[{l:"26/01/1995",v:0.82},{l:"12/12/2000",v:0.78},{l:"28/02/2010 — Xynthia",v:0.72}]},
'J520521001':{n:"Kerien [Moulin de Camel]",c:"Moulin Estolet",p:false,s:{s1:0.60,s2:0.90,s3:1.10},lat:48.387442,lon:-3.244292,h:[{l:"19/07/2007",v:1.22},{l:"28/02/2010 — Xynthia",v:1.19},{l:"02/01/2024",v:1.12}]},
'J521212001':{n:"Lanrivain [Pont D 87]",c:"Blavet aval Kerné-Uhel",p:false,s:{s1:0.80,s2:1.20,s3:1.60},lat:48.342317,lon:-3.248554,h:[{l:"13/12/2000",v:1.80},{l:"28/02/2010 — Xynthia",v:1.76},{l:"30/01/2025",v:1.29}]},
'J522401002':{n:"Ste-Tréphine [Trozulon]",c:"Sulon",p:false,s:{s1:0.70,s2:1.00,s3:1.35},lat:48.255921,lon:-3.152622,h:[{l:"29/12/2020",v:1.53},{l:"31/12/2022",v:1.53},{l:"27/01/2025",v:1.36}]},
'J540212001':{n:"Plélauff [Bon-Repos] ★",c:"Blavet",p:true,s:{s1:1.65,s2:1.90,s3:2.10},lat:48.212660,lon:-3.130689,h:[{l:"07/02/2014",v:2.33},{l:"28/02/2010 — Xynthia",v:2.23},{l:"27/01/2025",v:2.14}]},
'J800231002':{n:"St-Martin-des-Prés",c:"Oust",p:false,s:{s1:0.70,s2:1.00,s3:1.40},lat:48.321917,lon:-2.965181,h:[{l:"01/05/2001",v:1.61},{l:"11/02/1988",v:1.60},{l:"27/01/2025",v:1.27}]},
'J802231003':{n:"Hémonstoir [Pont D 69]",c:"Oust",p:false,s:{s1:1.20,s2:1.80,s3:2.30},lat:48.158519,lon:-2.816776,h:[{l:"02/01/2014",v:2.54},{l:"28/02/2010 — Xynthia",v:2.52},{l:"27/01/2025",v:2.29}]},
'J813301001':{n:"Plémet [St-Sauveur-le-Haut]",c:"Lié",p:false,s:{s1:1.20,s2:1.80,s3:2.30},lat:48.201986,lon:-2.622115,h:[{l:"12/02/1988 & 04/10/2020",v:2.43},{l:"05/01/2001",v:2.34},{l:"28/02/2010 — Xynthia",v:2.11}]},
};

export const CODES = Object.keys(ST);

export const VC = {'-1':'#c8d0c8','0':'#00A000','1':'#FFFF00','2':'#FF7F00','3':'#FF0000'};
export const VT = {'-1':'#5a6b5a','0':'#fff','1':'#333','2':'#fff','3':'#fff'};
export const VL = {'-1':'N/A','0':'Vert — normal','1':'Jaune — vigilance','2':'Orange — important','3':'Rouge — majeur'};

export const API = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie';
export const VIGICRUES_GEOJSON = '/api/vigicrues';
export const VIGICRUES_OBS = '/api/vigicrues-obs';

export const REF_COLORS = {s1:'#7dd3fc', s2:'#2563eb', s3:'#7c3aed'};
export const REF_TEXT   = {s1:'#075985', s2:'#fff',    s3:'#fff'};

export const VIGICRUES_TRONCON_BY_STATION = {
  J061161001:'BT15', J100452001:'BT15', J110301001:'BT15', J110581001:'BT15', J111401001:'BT15',
  J131301001:'BT15', J132401001:'BT15',
  J140531001:'BT14', J151301001:'BT14', J161401002:'BT14', J171171001:'BT14', J172172001:'BT14',
  J180301001:'BT14', J181301001:'BT14',
  J202301001:'BT13', J203401001:'BT13', J223301001:'BT13', J223302001:'BT13',
  J371301001:'BT2',
  J520211001:'BT5', J520521001:'BT5', J521212001:'BT5', J522401002:'BT5', J540212001:'BT5',
  J800231002:'BT7', J802231003:'BT7', J813301001:'BT7'
};

export const BASSINS = [
  { id:"rance", nom:"Rance", desc:"Bassin de la Rance (versant nord-est)", couleur:"#2980b9",
    stations:[{code:"J061161001", pos:"aval"}]
  },
  { id:"fremur", nom:"Frémur · Arguenon · Rosette · Quiloury", desc:"Côtiers nord-est — baie de Saint-Brieuc est", couleur:"#8e44ad",
    stations:[
      {code:"J100452001", pos:"aval"},{code:"J110301001", pos:"aval"},
      {code:"J110581001", pos:"amont"},{code:"J111401001", pos:"aval"}
    ]
  },
  { id:"gouessant", nom:"Gouessant · Evron · Urne", desc:"Côtiers baie de Saint-Brieuc centre", couleur:"#16a085",
    stations:[
      {code:"J140531001", pos:"amont"},{code:"J131301001", pos:"aval"},{code:"J132401001", pos:"aval"}
    ]
  },
  { id:"gouet", nom:"Gouët · Ic", desc:"Côtiers baie de Saint-Brieuc ouest", couleur:"#d35400",
    stations:[{code:"J151301001", pos:"aval"},{code:"J161401002", pos:"aval"}]
  },
  { id:"trieux", nom:"Trieux · Leff", desc:"Bassin du Trieux et du Leff", couleur:"#c0392b",
    stations:[
      {code:"J171171001", pos:"amont"},{code:"J172172001", pos:"aval"},
      {code:"J180301001", pos:"amont"},{code:"J181301001", pos:"aval"}
    ]
  },
  { id:"jaudy", nom:"Jaudy · Guindy · Léguer", desc:"Côtiers nord — Trégor", couleur:"#1abc9c",
    stations:[
      {code:"J223302001", pos:"amont"},{code:"J223301001", pos:"amont"},
      {code:"J202301001", pos:"amont"},{code:"J203401001", pos:"aval"}
    ]
  },
  { id:"blavet", nom:"Blavet · Hyère · Sulon", desc:"Blavet amont et affluents — Argoat", couleur:"#e67e22",
    stations:[
      {code:"J371301001", pos:"amont"},{code:"J520211001", pos:"amont"},
      {code:"J520521001", pos:"amont"},{code:"J521212001", pos:"milieu"},
      {code:"J522401002", pos:"milieu"},{code:"J540212001", pos:"aval"}
    ]
  },
  { id:"oust", nom:"Oust · Lié", desc:"Canal de Nantes à Brest — versant sud", couleur:"#7f8c8d",
    stations:[
      {code:"J800231002", pos:"amont"},{code:"J802231003", pos:"aval"},{code:"J813301001", pos:"aval"}
    ]
  }
];

export const POINTS_22 = [
  {id:'st-brieuc', nom:'Saint-Brieuc',  zone:'Baie de Saint-Brieuc', lat:48.51, lon:-2.77},
  {id:'lannion',   nom:'Lannion',       zone:'Trégor',                lat:48.73, lon:-3.46},
  {id:'guingamp',  nom:'Guingamp',      zone:'Argoat',                lat:48.56, lon:-3.15},
  {id:'loudéac',   nom:'Loudéac',       zone:'Centre',                lat:48.18, lon:-2.75},
  {id:'dinan',     nom:'Dinan',         zone:'Rance / est',           lat:48.45, lon:-2.04},
];

export const SOL_POINTS = [
  {id:'st-brieuc', nom:'Saint-Brieuc',  zone:'Baie de Saint-Brieuc', lat:48.51, lon:-2.77, bassins:['Gouessant','Gouët','Ic']},
  {id:'lannion',   nom:'Lannion',       zone:'Trégor',               lat:48.73, lon:-3.46, bassins:['Jaudy','Léguer','Guindy']},
  {id:'guingamp',  nom:'Guingamp',      zone:'Argoat',               lat:48.56, lon:-3.15, bassins:['Trieux','Leff']},
  {id:'loudéac',   nom:'Loudéac',       zone:'Centre / Blavet',      lat:48.18, lon:-2.75, bassins:['Blavet','Oust','Lié']},
  {id:'dinan',     nom:'Dinan',         zone:'Rance / est',          lat:48.45, lon:-2.04, bassins:['Rance','Arguenon']},
];

export const SOL_LAYERS = [
  {key:'soil_moisture_0_to_1cm',  label:'0–1 cm',    depth:1,  weight:0.10},
  {key:'soil_moisture_1_to_3cm',  label:'1–3 cm',    depth:2,  weight:0.15},
  {key:'soil_moisture_3_to_9cm',  label:'3–9 cm',    depth:6,  weight:0.25},
  {key:'soil_moisture_9_to_27cm', label:'9–27 cm',   depth:18, weight:0.30},
  {key:'soil_moisture_27_to_81cm',label:'27–81 cm',  depth:54, weight:0.20},
];

export const SOL_THETA_WP  = 0.10;
export const SOL_THETA_FC  = 0.28;
export const SOL_THETA_SAT = 0.44;

export const METEO_API = 'https://api.open-meteo.com/v1/forecast';
export const SOL_API   = 'https://api.open-meteo.com/v1/forecast';
export const MAREE_API = 'https://marine-api.open-meteo.com/v1/marine';

// Ports de référence — le modèle marin Open-Meteo (maille ~5 km) rattache
// chaque point à la cellule mer la plus proche
export const PORTS_22 = [
  {id:'st-cast',   nom:'Saint-Cast-le-Guildo', lat:48.645, lon:-2.26},
  {id:'erquy',     nom:'Erquy',                lat:48.645, lon:-2.475},
  {id:'legue',     nom:'Le Légué (St-Brieuc)', lat:48.545, lon:-2.735},
  {id:'paimpol',   nom:'Paimpol',              lat:48.795, lon:-3.035},
  {id:'perros',    nom:'Perros-Guirec',        lat:48.825, lon:-3.44},
  {id:'locquemeau',nom:'Locquémeau (Lannion)', lat:48.735, lon:-3.575},
];

export const WEATHER_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌧️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'❄️', 73:'❄️', 75:'❄️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️'
};

export const EM_SENSITIVE_META = {
  school: { label:'Écoles / Collèges / Lycées', icon:'🏫', color:'#2980b9' },
  health: { label:'Santé',                       icon:'🏥', color:'#c0392b' },
  ehpad:  { label:'EHPAD / Résidences',          icon:'🏠', color:'#8e44ad' },
};
