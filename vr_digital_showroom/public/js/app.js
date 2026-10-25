import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';

// --- State & App Context ---
const state = {
  currentUser: JSON.parse(localStorage.getItem('vr_user')) || null,
  comments: [],
  exhibits: [],
  currentMode: 'orbit', // 'orbit', 'gyro', 'cardboard'
  skyMode: 0,           // 0: day, 1: sunset, 2: night
  cloudDensityMode: 0,  // 0: dense celestial, 1: ethereal mist, 2: clear
  showLabels: false,    // Default false so scene matches Image 3 cleanly on load
  spatialPinMode: false,
  barrageEnabled: true,
  gyro: { alpha: 0, beta: 0, gamma: 0, active: false }
};

// --- Three.js Globals ---
let scene, camera, renderer, controls, stereoCamera;
let clock = new THREE.Clock();
let cloudsGroup, pagodaGroup, platformsGroup, exhibitsGroup, pinsGroup, fairyDustGroup;
let lanternLights = [];
let dirLight, hemiLight, ambientLight;

// --- Initialize Scene ---
function initScene() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  // Fog only affects extreme distance (80-220m), leaving entire scene 100% crisp & vibrant
  scene.fog = new THREE.Fog(0x8ec0ed, 80, 220);

  camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 1000);
  // Perfectly balanced framing capturing full pagoda spire to entrance stairs & lanterns
  camera.position.set(7.5, 25.0, 42.0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(-1.5, 4.5, -1.5);
  controls.maxDistance = 140;
  controls.minDistance = 6;
  controls.maxPolarAngle = Math.PI / 2 + 0.05;

  // Stereo Camera for Mobile VR Cardboard mode
  stereoCamera = new THREE.StereoCamera();
  stereoCamera.aspect = 0.5;
  stereoCamera.eyeSep = 0.064;

  // Groups
  cloudsGroup = new THREE.Group();
  pagodaGroup = new THREE.Group();
  platformsGroup = new THREE.Group();
  exhibitsGroup = new THREE.Group();
  pinsGroup = new THREE.Group();
  fairyDustGroup = new THREE.Group();

  scene.add(cloudsGroup);
  scene.add(platformsGroup);
  scene.add(pagodaGroup);
  scene.add(exhibitsGroup);
  scene.add(pinsGroup);
  scene.add(fairyDustGroup);

  setupLighting();
  setupCelestialSky(0);
  buildArchitecturalScene();
  buildVolumetricClouds();
  buildFairyDust();

  window.addEventListener('resize', onWindowResize);
  setupInteractionEvents();
  setupGyroscope();

  renderer.setAnimationLoop(renderLoop);
}

// --- Lighting Setup ---
function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambientLight);

  hemiLight = new THREE.HemisphereLight(0xebf8ff, 0xdcfce7, 0.75);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // Crisp Golden Sunlight casting sharp shadows on roof eaves and terraces
  dirLight = new THREE.DirectionalLight(0xfff7e8, 2.7);
  dirLight.position.set(30, 48, -10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 160;
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.bias = -0.0004;
  scene.add(dirLight);
}

// --- Celestial Skybox (Day / Sunset / Night) ---
function setupCelestialSky(mode) {
  state.skyMode = mode;
  let topColor, bottomColor, fogColor, lightColor, lightIntensity;

  if (mode === 0) { // Day - Serene Azure Sky (Matching Image 3)
    topColor = new THREE.Color(0x3578c2);
    bottomColor = new THREE.Color(0x8ec0ed);
    fogColor = 0x8ec0ed;
    lightColor = 0xfff7e8;
    lightIntensity = 2.7;
  } else if (mode === 1) { // Sunset - Gilded Violet
    topColor = new THREE.Color(0x4c1d95);
    bottomColor = new THREE.Color(0xf59e0b);
    fogColor = 0xfde68a;
    lightColor = 0xfbbf24;
    lightIntensity = 2.2;
  } else { // Night - Purple Celestial Nebula
    topColor = new THREE.Color(0x0a0f1d);
    bottomColor = new THREE.Color(0x1e1b4b);
    fogColor = 0x18182b;
    lightColor = 0xc7d2fe;
    lightIntensity = 1.0;
  }

  scene.fog.color.setHex(fogColor);
  dirLight.color.set(lightColor);
  dirLight.intensity = lightIntensity;

  // High-res sky dome sphere
  const skyGeo = new THREE.SphereGeometry(300, 32, 32);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, topColor.getStyle());
  grad.addColorStop(0.65, bottomColor.getStyle());
  grad.addColorStop(1, topColor.getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
}

// --- Procedural High-Res Texture matching Image 3 ---
function createMandalaPlatformTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  // Pure white jade stone base
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 2048, 2048);

  // Subtle warm veins
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 2048;
    const r = Math.random() * 40 + 10;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(226, 232, 240, 0.45)' : 'rgba(254, 243, 199, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = 1024;
  const cy = 1024;
  ctx.strokeStyle = '#d4af37';
  ctx.fillStyle = '#d4af37';

  // Crisp Concentric Gold Engravings (Matching Image 3 platforms)
  const rings = [160, 280, 420, 560, 700, 820, 920, 980];
  rings.forEach((r, idx) => {
    ctx.lineWidth = (idx % 2 === 0) ? 9 : 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Center 16-Petal Lotus Medallion
  for (let p = 0; p < 16; p++) {
    const angle = (p * Math.PI * 2) / 16;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 210, 38, 95, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  // Outer Auspicious Radial Rays
  for (let ray = 0; ray < 32; ray++) {
    const angle = (ray * Math.PI * 2) / 32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.lineTo(0, 700);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#b89028';
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// --- Materials System ---
let materials = {};
function initMaterials() {
  const platformTex = createMandalaPlatformTexture();

  materials.platformFloor = new THREE.MeshStandardMaterial({
    map: platformTex,
    roughness: 0.22,
    metalness: 0.28,
    envMapIntensity: 1.4
  });

  materials.whiteJade = new THREE.MeshStandardMaterial({
    color: 0xfcfcfc,
    roughness: 0.2,
    metalness: 0.06
  });

  materials.gold = new THREE.MeshStandardMaterial({
    color: 0xf5c042,
    roughness: 0.18,
    metalness: 0.95,
    envMapIntensity: 2.4
  });

  materials.cyanTile = new THREE.MeshStandardMaterial({
    color: 0x1f9d8f,
    roughness: 0.15,
    metalness: 0.38
  });

  materials.jadeDoor = new THREE.MeshStandardMaterial({
    color: 0x3bb29c,
    roughness: 0.26,
    metalness: 0.2
  });

  materials.lanternGlow = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    emissive: 0xf59e0b,
    emissiveIntensity: 3.0,
    roughness: 0.3
  });

  materials.stone = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.55,
    metalness: 0.12
  });
}

// --- Build Architectural Scene (Cascading from Bottom-Right to Upper-Left) ---
function buildArchitecturalScene() {
  initMaterials();

  // Three Platforms positioned along vector (-1, 0, -1)
  // P1: (8.0, -3.2, 8.0) - Bottom Right
  // P2: (0.0, -1.0, 0.0) - Center
  // P3: (-8.0, 1.8, -8.0) - Upper Left (Pagoda Plaza)
  const platformConfigs = [
    { x: 8.0,  y: -3.2, z: 8.0,  radius: 6.8, height: 1.2 },
    { x: 0.0,  y: -1.0, z: 0.0,  radius: 7.8, height: 1.4 },
    { x: -8.0, y: 1.8,  z: -8.0, radius: 9.2, height: 1.8 }
  ];

  platformConfigs.forEach((cfg, idx) => {
    const platGroup = new THREE.Group();
    platGroup.position.set(cfg.x, cfg.y, cfg.z);

    // Platform Base Cylinder
    const baseGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius * 0.96, cfg.height, 48);
    const baseMesh = new THREE.Mesh(baseGeo, [
      materials.gold,          // sides with golden band
      materials.platformFloor, // top with mandala pattern
      materials.whiteJade      // bottom
    ]);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    platGroup.add(baseMesh);

    // Golden Rim Ring on top edge
    const rimGeo = new THREE.TorusGeometry(cfg.radius, 0.12, 16, 64);
    rimGeo.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, materials.gold);
    rimMesh.position.y = cfg.height / 2;
    platGroup.add(rimMesh);

    // Circular Balustrades & Railings
    const numPosts = Math.floor(cfg.radius * 3.6);
    const postRadius = cfg.radius - 0.25;
    for (let i = 0; i < numPosts; i++) {
      const angle = (i * Math.PI * 2) / numPosts;
      if (idx === 0 && (angle > 0.65 && angle < 0.95)) continue; // front stairs opening
      if (idx === 0 && (angle > 3.75 && angle < 4.15)) continue; // exit stairs to P2
      if (idx === 1 && (angle > 0.65 && angle < 0.95)) continue; // entry stairs from P1
      if (idx === 1 && (angle > 3.75 && angle < 4.15)) continue; // exit stairs to P3
      if (idx === 2 && (angle > 0.65 && angle < 0.95)) continue; // entry stairs from P2

      const px = Math.cos(angle) * postRadius;
      const pz = Math.sin(angle) * postRadius;

      // Baluster Post
      const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 12);
      const postMesh = new THREE.Mesh(postGeo, materials.whiteJade);
      postMesh.position.set(px, cfg.height / 2 + 0.55, pz);
      platGroup.add(postMesh);

      // Gold Top Finial on Post
      const finialGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const finialMesh = new THREE.Mesh(finialGeo, materials.gold);
      finialMesh.position.set(px, cfg.height / 2 + 1.15, pz);
      platGroup.add(finialMesh);
    }

    // Top Curved Railing Tube
    const railGeo = new THREE.TorusGeometry(postRadius, 0.06, 12, 64);
    railGeo.rotateX(Math.PI / 2);
    const railMesh = new THREE.Mesh(railGeo, materials.whiteJade);
    railMesh.position.y = cfg.height / 2 + 0.95;
    platGroup.add(railMesh);

    // Exhibit Display Pedestal on each platform
    const pedestalGeo = new THREE.CylinderGeometry(0.75, 0.85, 0.8, 16);
    const pedestalMesh = new THREE.Mesh(pedestalGeo, [materials.gold, materials.whiteJade, materials.stone]);
    pedestalMesh.position.set(-cfg.radius * 0.35, cfg.height / 2 + 0.4, cfg.radius * 0.35);
    pedestalMesh.name = `pedestal_${idx + 1}`;
    pedestalMesh.castShadow = true;
    platGroup.add(pedestalMesh);

    addDefaultExhibit(platGroup, idx + 1, pedestalMesh.position);

    platformsGroup.add(platGroup);
  });

  // Connecting Stairs between P1 and P2
  buildStairway(platformConfigs[0], platformConfigs[1]);
  // Connecting Stairs between P2 and P3
  buildStairway(platformConfigs[1], platformConfigs[2]);

  // Entrance Stairs descending in front of Platform 1
  buildEntranceStairs(platformConfigs[0]);

  // Main Pagoda & Lotus Base on Platform 3
  const pagodaPos = { x: -8.0, y: 1.8 + 1.8 / 2, z: -8.0 };
  pagodaGroup.position.set(pagodaPos.x, pagodaPos.y, pagodaPos.z);

  buildLotusPedestal(pagodaGroup);
  buildPagodaLevels(pagodaGroup);
}

// --- Default Showcase Exhibits (Requirement 4) ---
function addDefaultExhibit(parent, platformIndex, pos) {
  const exhibitGroup = new THREE.Group();
  exhibitGroup.position.set(pos.x, pos.y + 0.4, pos.z);

  if (platformIndex === 1) {
    const vesselGeo = new THREE.DodecahedronGeometry(0.5, 1);
    const vesselMat = new THREE.MeshStandardMaterial({
      color: 0x3bb29c,
      metalness: 0.75,
      roughness: 0.22
    });
    const vessel = new THREE.Mesh(vesselGeo, vesselMat);
    vessel.position.y = 0.5;
    vessel.castShadow = true;
    exhibitGroup.add(vessel);

    const spot = new THREE.SpotLight(0xfffaed, 2.5, 9, Math.PI / 6, 0.3);
    spot.position.set(0, 4, 0);
    spot.target = vessel;
    exhibitGroup.add(spot);
  } else if (platformIndex === 2) {
    const ringGeo1 = new THREE.TorusGeometry(0.55, 0.04, 16, 48);
    const ringGeo2 = new THREE.TorusGeometry(0.42, 0.03, 16, 48);
    const ring1 = new THREE.Mesh(ringGeo1, materials.gold);
    const ring2 = new THREE.Mesh(ringGeo2, materials.cyanTile);
    ring1.position.y = 0.6;
    ring2.position.y = 0.6;
    ring2.rotation.x = Math.PI / 3;
    ring1.rotation.y = Math.PI / 4;
    exhibitGroup.add(ring1);
    exhibitGroup.add(ring2);
  } else {
    const pearlGeo = new THREE.SphereGeometry(0.45, 32, 32);
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xa7f3d0,
      emissive: 0x059669,
      emissiveIntensity: 0.7,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.85,
      thickness: 0.6
    });
    const pearl = new THREE.Mesh(pearlGeo, pearlMat);
    pearl.position.y = 0.7;
    exhibitGroup.add(pearl);
  }

  parent.add(exhibitGroup);
}

// --- Connecting Stairs ---
function buildStairway(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = (p2.y + p2.height / 2) - (p1.y + p1.height / 2);
  const dz = p2.z - p1.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const numSteps = 7;
  const stairWidth = 3.2;

  const stairGroup = new THREE.Group();
  stairGroup.position.set((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + 0.3, (p1.z + p2.z) / 2);
  stairGroup.lookAt(p2.x, stairGroup.position.y, p2.z);

  for (let s = 0; s < numSteps; s++) {
    const t = s / (numSteps - 1) - 0.5;
    const stepGeo = new THREE.BoxGeometry(stairWidth, 0.22, dist / numSteps * 1.1);
    const stepMesh = new THREE.Mesh(stepGeo, materials.whiteJade);
    stepMesh.position.set(0, t * dy, t * dist * 0.4);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    stairGroup.add(stepMesh);
  }

  // Golden Handrails
  const railGeo = new THREE.CylinderGeometry(0.06, 0.06, dist * 0.5, 12);
  railGeo.rotateX(Math.PI / 2);
  const leftRail = new THREE.Mesh(railGeo, materials.gold);
  leftRail.position.set(-stairWidth / 2, dy * 0.2 + 0.7, 0);
  const rightRail = new THREE.Mesh(railGeo, materials.gold);
  rightRail.position.set(stairWidth / 2, dy * 0.2 + 0.7, 0);
  stairGroup.add(leftRail);
  stairGroup.add(rightRail);

  platformsGroup.add(stairGroup);
}

// --- Entrance Stairs & Stone Palace Lanterns (灯 - Exactly matching Image 3) ---
function buildEntranceStairs(p0) {
  const stairsGroup = new THREE.Group();
  stairsGroup.position.set(p0.x + 4.2, p0.y, p0.z + 4.2);
  stairsGroup.rotation.y = -Math.PI / 4;

  const stepCount = 5;
  for (let i = 0; i < stepCount; i++) {
    const stepGeo = new THREE.BoxGeometry(3.6 - i * 0.1, 0.24, 0.75);
    const stepMesh = new THREE.Mesh(stepGeo, materials.whiteJade);
    stepMesh.position.set(0, -i * 0.24, i * 0.65);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    stairsGroup.add(stepMesh);
  }

  // Two Palace Lanterns flanking the entrance
  const lanternOffsets = [-2.3, 2.3];
  lanternOffsets.forEach((ox) => {
    const lantern = buildPalaceLantern();
    lantern.position.set(ox, 0.4, 2.8);
    stairsGroup.add(lantern);
  });

  platformsGroup.add(stairsGroup);
}

// --- Palace Lantern (灯) ---
function buildPalaceLantern() {
  const g = new THREE.Group();

  // Stone Pillar Base
  const baseGeo = new THREE.CylinderGeometry(0.28, 0.38, 1.0, 8);
  const baseMesh = new THREE.Mesh(baseGeo, materials.stone);
  baseMesh.position.y = 0.5;
  g.add(baseMesh);

  // Lotus Lantern Plate
  const plateGeo = new THREE.CylinderGeometry(0.52, 0.28, 0.22, 8);
  const plateMesh = new THREE.Mesh(plateGeo, materials.gold);
  plateMesh.position.y = 1.1;
  g.add(plateMesh);

  // Glowing Lantern Chamber
  const chamberGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.75, 6);
  const chamberMesh = new THREE.Mesh(chamberGeo, materials.lanternGlow);
  chamberMesh.position.y = 1.58;
  g.add(chamberMesh);

  // Warm Point Light
  const light = new THREE.PointLight(0xf59e0b, 2.5, 14, 1.4);
  light.position.y = 1.6;
  g.add(light);
  lanternLights.push(light);

  // Pagoda Cap Roof (Golden Roof)
  const roofGeo = new THREE.ConeGeometry(0.7, 0.48, 6);
  const roofMesh = new THREE.Mesh(roofGeo, materials.gold);
  roofMesh.position.y = 2.15;
  g.add(roofMesh);

  // Golden Spire on Lantern
  const spireGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const spireMesh = new THREE.Mesh(spireGeo, materials.gold);
  spireMesh.position.y = 2.45;
  g.add(spireMesh);

  // Hanging Cyan Silk Banners (Matching Image 3)
  for (let b = 0; b < 4; b++) {
    const angle = (b * Math.PI) / 2;
    const bannerGeo = new THREE.PlaneGeometry(0.14, 1.1);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x38b2ac,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(Math.cos(angle) * 0.48, 1.1, Math.sin(angle) * 0.48);
    g.add(banner);
  }

  return g;
}

// --- Lotus Pedestal (莲花底座) ---
function buildLotusPedestal(parent) {
  const lotusGroup = new THREE.Group();
  lotusGroup.position.y = 0;

  const numPetals = 16;
  for (let i = 0; i < numPetals; i++) {
    const angle = (i * Math.PI * 2) / numPetals;
    const petalGeo = new THREE.ConeGeometry(0.68, 1.45, 4);
    petalGeo.rotateZ(Math.PI / 4);
    petalGeo.rotateX(Math.PI / 2);

    const petalMesh = new THREE.Mesh(petalGeo, materials.whiteJade);
    petalMesh.position.set(Math.cos(angle) * 4.8, 0.3, Math.sin(angle) * 4.8);
    petalMesh.rotation.y = -angle + Math.PI / 2;
    petalMesh.rotation.x = -0.4;
    lotusGroup.add(petalMesh);

    // Golden tip on petal
    const tipGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const tipMesh = new THREE.Mesh(tipGeo, materials.gold);
    tipMesh.position.set(Math.cos(angle) * 5.4, 0.6, Math.sin(angle) * 5.4);
    lotusGroup.add(tipMesh);
  }

  parent.add(lotusGroup);
}

// --- 4-Tier Pagoda Building (主体) ---
function buildPagodaLevels(parent) {
  const levels = [
    { yBottom: 0.4, height: 3.4, radiusBottom: 4.5, radiusTop: 4.2, roofRadius: 6.8 },  // Tier 1
    { yBottom: 3.8, height: 2.8, radiusBottom: 3.8, radiusTop: 3.5, roofRadius: 5.6 },  // Tier 2
    { yBottom: 6.6, height: 2.5, radiusBottom: 3.0, radiusTop: 2.8, roofRadius: 4.5 },  // Tier 3
    { yBottom: 9.1, height: 2.2, radiusBottom: 2.3, radiusTop: 2.0, roofRadius: 3.6 }   // Tier 4 (Top)
  ];

  levels.forEach((lvl) => {
    const tierGroup = new THREE.Group();
    tierGroup.position.y = lvl.yBottom;

    // 1. Octagonal Main Hall Body
    const wallGeo = new THREE.CylinderGeometry(lvl.radiusTop, lvl.radiusBottom, lvl.height, 8);
    const wallMesh = new THREE.Mesh(wallGeo, materials.whiteJade);
    wallMesh.position.y = lvl.height / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    tierGroup.add(wallMesh);

    // Pillars at the 8 vertices
    for (let p = 0; p < 8; p++) {
      const angle = (p * Math.PI * 2) / 8 + Math.PI / 8;
      const px = Math.cos(angle) * (lvl.radiusBottom + 0.05);
      const pz = Math.sin(angle) * (lvl.radiusBottom + 0.05);

      const pillarGeo = new THREE.CylinderGeometry(0.15, 0.18, lvl.height, 12);
      const pillarMesh = new THREE.Mesh(pillarGeo, materials.gold);
      pillarMesh.position.set(px, lvl.height / 2, pz);
      pillarMesh.castShadow = true;
      tierGroup.add(pillarMesh);
    }

    // Carved Doors & Windows (Cyan/Turquoise with Gold Trim)
    for (let d = 0; d < 8; d++) {
      const angle = (d * Math.PI * 2) / 8;
      const dx = Math.cos(angle) * (lvl.radiusBottom + 0.02);
      const dz = Math.sin(angle) * (lvl.radiusBottom + 0.02);

      const doorW = lvl.radiusBottom * 0.45;
      const doorH = lvl.height * 0.72;
      const doorGeo = new THREE.PlaneGeometry(doorW, doorH);
      const doorMesh = new THREE.Mesh(doorGeo, materials.jadeDoor);
      doorMesh.position.set(dx, lvl.height * 0.42, dz);
      doorMesh.lookAt(dx * 2, lvl.height * 0.42, dz * 2);
      tierGroup.add(doorMesh);

      // Gold Door Trim
      const trimGeo = new THREE.RingGeometry(doorW * 0.4, doorW * 0.48, 4);
      const trimMesh = new THREE.Mesh(trimGeo, materials.gold);
      trimMesh.position.set(dx * 1.01, lvl.height * 0.42, dz * 1.01);
      trimMesh.lookAt(dx * 2, lvl.height * 0.42, dz * 2);
      tierGroup.add(trimMesh);
    }

    // 2. Surrounding Balcony with Railings
    const balcWidth = lvl.radiusBottom + 1.2;
    const balcGeo = new THREE.CylinderGeometry(balcWidth, balcWidth, 0.25, 8);
    const balcMesh = new THREE.Mesh(balcGeo, [materials.gold, materials.platformFloor, materials.whiteJade]);
    balcMesh.position.y = 0.12;
    tierGroup.add(balcMesh);

    // Balcony Railings
    for (let r = 0; r < 24; r++) {
      const angle = (r * Math.PI * 2) / 24;
      const rx = Math.cos(angle) * (balcWidth - 0.15);
      const rz = Math.sin(angle) * (balcWidth - 0.15);

      const rPostGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.65, 8);
      const rPost = new THREE.Mesh(rPostGeo, materials.whiteJade);
      rPost.position.set(rx, 0.45, rz);
      tierGroup.add(rPost);

      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), materials.gold);
      finial.position.set(rx, 0.8, rz);
      tierGroup.add(finial);
    }

    // 3. Flared Pagoda Roof with Flying Eaves
    const roofHeight = 1.35;
    const roofGeo = new THREE.ConeGeometry(lvl.roofRadius, roofHeight, 8);
    const roofMesh = new THREE.Mesh(roofGeo, materials.cyanTile);
    roofMesh.position.y = lvl.height + roofHeight / 2 - 0.1;
    roofMesh.castShadow = true;
    tierGroup.add(roofMesh);

    // Gilded Eaves Trim (Cornice)
    const corniceGeo = new THREE.TorusGeometry(lvl.roofRadius, 0.12, 8, 8);
    corniceGeo.rotateX(Math.PI / 2);
    const corniceMesh = new THREE.Mesh(corniceGeo, materials.gold);
    corniceMesh.position.y = lvl.height - 0.1;
    tierGroup.add(corniceMesh);

    // Golden Eave Corner Ridges (八方翘角)
    for (let c = 0; c < 8; c++) {
      const angle = (c * Math.PI * 2) / 8 + Math.PI / 8;
      const cx = Math.cos(angle) * lvl.roofRadius;
      const cz = Math.sin(angle) * lvl.roofRadius;

      const upturnGeo = new THREE.BoxGeometry(0.15, 0.3, 0.8);
      upturnGeo.rotateX(0.4);
      const upturn = new THREE.Mesh(upturnGeo, materials.gold);
      upturn.position.set(cx, lvl.height + 0.1, cz);
      upturn.lookAt(0, lvl.height + 0.1, 0);
      upturn.rotateY(Math.PI);
      tierGroup.add(upturn);
    }

    parent.add(tierGroup);
  });

  // Grand Golden Spire on Pagoda Peak
  const spireGroup = new THREE.Group();
  spireGroup.position.y = 11.3 + 1.35;

  const spBase = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), materials.gold);
  spireGroup.add(spBase);

  // 7 Tier Golden Rings
  for (let i = 0; i < 7; i++) {
    const ringRadius = 0.5 - i * 0.05;
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.07, 12, 32), materials.gold);
    ringMesh.rotateX(Math.PI / 2);
    ringMesh.position.y = 0.6 + i * 0.35;
    spireGroup.add(ringMesh);
  }

  // Spire Mast Needle
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 3.8, 12), materials.gold);
  mast.position.y = 1.9;
  spireGroup.add(mast);

  // Flaming Jewel Finial on top
  const jewelMat = new THREE.MeshStandardMaterial({
    color: 0xffedd5,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
    metalness: 0.8,
    roughness: 0.1
  });
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), jewelMat);
  jewel.position.y = 3.9;
  spireGroup.add(jewel);

  parent.add(spireGroup);
}

// =========================================================================
// --- Volumetric Clouds System (在建筑附近放置体积云) ---
// =========================================================================
let cloudPuffs = [];
function buildVolumetricClouds() {
  while (cloudsGroup.children.length > 0) {
    cloudsGroup.remove(cloudsGroup.children[0]);
  }
  cloudPuffs = [];

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 512;
  cloudCanvas.height = 512;
  const cctx = cloudCanvas.getContext('2d');

  // Multi-lobed cloud puff
  const lobes = [
    { x: 256, y: 256, r: 180, a: 0.75 },
    { x: 190, y: 230, r: 150, a: 0.65 },
    { x: 320, y: 240, r: 155, a: 0.65 },
    { x: 230, y: 300, r: 140, a: 0.6 },
    { x: 290, y: 290, r: 130, a: 0.55 }
  ];

  lobes.forEach((l) => {
    const grad = cctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${l.a})`);
    grad.addColorStop(0.5, `rgba(240, 248, 255, ${l.a * 0.5})`);
    grad.addColorStop(0.8, `rgba(224, 242, 254, ${l.a * 0.15})`);
    grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    cctx.fillStyle = grad;
    cctx.beginPath();
    cctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    cctx.fill();
  });

  const cloudTex = new THREE.CanvasTexture(cloudCanvas);

  const cloudMaterial = new THREE.SpriteMaterial({
    map: cloudTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  // Layer 1: Swirling Ring of Volumetric Clouds directly around Pagoda Base (-8, -8)
  const pagodaCenter = { x: -8.0, z: -8.0 };
  const numPagodaClouds = 28;
  for (let i = 0; i < numPagodaClouds; i++) {
    const angle = (i * Math.PI * 2) / numPagodaClouds;
    const r = 8.0 + Math.random() * 4.5;
    const sprite = new THREE.Sprite(cloudMaterial.clone());

    const cx = pagodaCenter.x + Math.cos(angle) * r;
    const cy = 1.0 + Math.sin(i * 1.5) * 1.8 + (Math.random() - 0.5) * 1.2;
    const cz = pagodaCenter.z + Math.sin(angle) * r;

    sprite.position.set(cx, cy, cz);
    const scale = 6.5 + Math.random() * 6.5;
    sprite.scale.set(scale, scale, 1);

    sprite.userData = {
      baseAngle: angle,
      radius: r,
      center: pagodaCenter,
      speed: (0.05 + Math.random() * 0.04) * (Math.random() > 0.5 ? 1 : -1),
      verticalFreq: 0.5 + Math.random() * 0.5,
      initY: cy
    };

    cloudsGroup.add(sprite);
    cloudPuffs.push(sprite);
  }

  // Layer 2: Cascading mist curling off the platform edges
  const platformCenters = [
    { x: 8.0, y: -3.2, z: 8.0, r: 6.8 },
    { x: 0.0, y: -1.0, z: 0.0, r: 7.8 },
    { x: -8.0, y: 1.8, z: -8.0, r: 9.2 }
  ];

  platformCenters.forEach((plat) => {
    for (let k = 0; k < 8; k++) {
      const angle = Math.random() * Math.PI * 2;
      const pr = plat.r + 1.2 + Math.random() * 3.5;
      const sprite = new THREE.Sprite(cloudMaterial.clone());

      const sx = plat.x + Math.cos(angle) * pr;
      const sy = plat.y - 0.4 + (Math.random() - 0.5) * 1.4;
      const sz = plat.z + Math.sin(angle) * pr;

      sprite.position.set(sx, sy, sz);
      const scale = 7.5 + Math.random() * 7.5;
      sprite.scale.set(scale, scale, 1);

      sprite.userData = {
        baseAngle: angle,
        radius: pr,
        center: { x: plat.x, z: plat.z },
        speed: 0.03 + Math.random() * 0.03,
        verticalFreq: 0.3 + Math.random() * 0.4,
        initY: sy
      };

      cloudsGroup.add(sprite);
      cloudPuffs.push(sprite);
    }
  });

  // Layer 3: Rolling clouds drifting in the middle distance
  const numSeaClouds = 24;
  for (let j = 0; j < numSeaClouds; j++) {
    const sprite = new THREE.Sprite(cloudMaterial.clone());
    const r = 24 + Math.random() * 35;
    const angle = Math.random() * Math.PI * 2;

    const sx = Math.cos(angle) * r;
    const sy = -8.5 - Math.random() * 4.0;
    const sz = Math.sin(angle) * r;

    sprite.position.set(sx, sy, sz);
    const scale = 16 + Math.random() * 16;
    sprite.scale.set(scale, scale, 1);

    sprite.userData = {
      baseAngle: angle,
      radius: r,
      center: { x: 0, z: 0 },
      speed: 0.02 + Math.random() * 0.02,
      verticalFreq: 0.2 + Math.random() * 0.3,
      initY: sy
    };

    cloudsGroup.add(sprite);
    cloudPuffs.push(sprite);
  }
}

// Fairy Dust Floating Particles (Soft Golden Motes)
function buildFairyDust() {
  const particleCount = 180;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 35;
    positions[i + 1] = Math.random() * 18 - 2;
    positions[i + 2] = (Math.random() - 0.5) * 35;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 64;
  sparkCanvas.height = 64;
  const sctx = sparkCanvas.getContext('2d');
  const sgrad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  sgrad.addColorStop(0, 'rgba(254, 240, 138, 1)');
  sgrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.6)');
  sgrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  sctx.fillStyle = sgrad;
  sctx.beginPath();
  sctx.arc(32, 32, 30, 0, Math.PI * 2);
  sctx.fill();

  const sparkTex = new THREE.CanvasTexture(sparkCanvas);

  const pMaterial = new THREE.PointsMaterial({
    map: sparkTex,
    color: 0xfffbeb,
    size: 0.45,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particles = new THREE.Points(geometry, pMaterial);
  fairyDustGroup.add(particles);
}

function updateFairyDust(delta) {
  const posAttr = fairyDustGroup.children[0].geometry.attributes.position;
  const arr = posAttr.array;
  for (let i = 1; i < arr.length; i += 3) {
    arr[i] += delta * 0.75;
    if (arr[i] > 20) arr[i] = -2;
  }
  posAttr.needsUpdate = true;
}

// Animate Volumetric Clouds in loop
function updateClouds(delta, elapsed) {
  cloudPuffs.forEach((puff) => {
    const ud = puff.userData;
    ud.baseAngle += ud.speed * delta;
    puff.position.x = ud.center.x + Math.cos(ud.baseAngle) * ud.radius;
    puff.position.z = ud.center.z + Math.sin(ud.baseAngle) * ud.radius;
    puff.position.y = ud.initY + Math.sin(elapsed * ud.verticalFreq) * 0.45;
  });

  lanternLights.forEach((light, idx) => {
    light.intensity = 2.2 + Math.sin(elapsed * 4.5 + idx) * 0.35;
  });
}

// --- Render Loop & Mode Switching ---
function renderLoop() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateClouds(delta, elapsed);
  updateFairyDust(delta);
  if (state.showLabels) {
    update3DCommentLabels();
  }

  if (state.currentMode === 'gyro' && state.gyro.active) {
    updateGyroscopeCamera();
  } else {
    controls.update();
  }

  if (state.currentMode === 'cardboard') {
    const size = renderer.getSize(new THREE.Vector2());
    renderer.setScissorTest(true);

    renderer.setScissor(0, 0, size.width / 2, size.height);
    renderer.setViewport(0, 0, size.width / 2, size.height);
    stereoCamera.update(camera);
    renderer.render(scene, stereoCamera.cameraL);

    renderer.setScissor(size.width / 2, 0, size.width / 2, size.height);
    renderer.setViewport(size.width / 2, 0, size.width / 2, size.height);
    renderer.render(scene, stereoCamera.cameraR);

    renderer.setScissorTest(false);
  } else {
    renderer.render(scene, camera);
  }
}

// --- Mobile Gyroscope Handling (Requirement 2) ---
function setupGyroscope() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha !== null) {
        state.gyro.alpha = e.alpha;
        state.gyro.beta = e.beta;
        state.gyro.gamma = e.gamma;
        state.gyro.active = true;
      }
    });
  }
}

function updateGyroscopeCamera() {
  const alpha = THREE.MathUtils.degToRad(state.gyro.alpha || 0);
  const beta = THREE.MathUtils.degToRad(state.gyro.beta || 0);
  const gamma = THREE.MathUtils.degToRad(state.gyro.gamma || 0);

  const euler = new THREE.Euler();
  euler.set(beta - Math.PI / 4, alpha, -gamma, 'YXZ');
  camera.quaternion.setFromEuler(euler);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- 3D Spatial Comments & Pins (Requirement 3) ---
function render3DSpatialPins() {
  while (pinsGroup.children.length > 0) {
    pinsGroup.remove(pinsGroup.children[0]);
  }

  state.comments.forEach((c) => {
    if (c.pos) {
      const pinGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.8
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(c.pos.x, c.pos.y, c.pos.z);
      pinMesh.userData = { comment: c };
      pinsGroup.add(pinMesh);

      const needleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
      const needle = new THREE.Mesh(needleGeo, materials.gold);
      needle.position.set(c.pos.x, c.pos.y - 0.4, c.pos.z);
      pinsGroup.add(needle);
    }
  });
  pinsGroup.visible = state.showLabels;
}

function update3DCommentLabels() {
  const container = document.getElementById('labels-container');
  container.innerHTML = '';
  if (!state.showLabels) return;

  state.comments.forEach((c) => {
    if (c.pos) {
      const v = new THREE.Vector3(c.pos.x, c.pos.y + 0.35, c.pos.z);
      v.project(camera);

      if (v.z < 1) {
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;

        const label = document.createElement('div');
        label.className = 'annotation-label';
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.innerHTML = `📍 <b>${c.author}</b>: ${c.content.slice(0, 16)}${c.content.length > 16 ? '...' : ''}`;
        label.onclick = () => {
          showToast(`💬 ${c.author}: ${c.content} (${c.time})`);
          openCommentsDrawer();
        };
        container.appendChild(label);
      }
    }
  });
}

// --- Barrage / Bullet Comments ---
function triggerBarrage(text, author) {
  if (!state.barrageEnabled) return;
  const container = document.getElementById('barrage-container');
  const item = document.createElement('div');
  item.className = 'barrage-item';
  item.style.top = `${10 + Math.random() * 65}%`;
  item.style.animationDuration = `${9 + Math.random() * 5}s`;
  item.innerHTML = `<span style="color:var(--primary-gold); font-weight:600;">${author}:</span> ${text}`;
  container.appendChild(item);

  setTimeout(() => {
    if (item.parentNode) item.parentNode.removeChild(item);
  }, 15000);
}

// --- API Calls ---
async function fetchComments() {
  try {
    const res = await fetch('/api/comments');
    const data = await res.json();
    if (data.success) {
      state.comments = data.comments;
      document.getElementById('comment-badge').innerText = state.comments.length;
      renderCommentsList();
      render3DSpatialPins();
    }
  } catch (e) {
    console.error('Failed to fetch comments:', e);
  }
}

async function postComment(content, pos = null) {
  const author = state.currentUser ? state.currentUser.username : '游客观众';
  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content, pos })
    });
    const data = await res.json();
    if (data.success) {
      state.comments.unshift(data.comment);
      document.getElementById('comment-badge').innerText = state.comments.length;
      renderCommentsList();
      render3DSpatialPins();
      triggerBarrage(content, author);
      showToast(pos ? '📍 3D 空间图钉已成功固定至建筑表面！' : '评论发表成功！');
    }
  } catch (e) {
    showToast('发表评论失败，请重试');
  }
}

function renderCommentsList() {
  const container = document.getElementById('comment-list-container');
  container.innerHTML = '';
  state.comments.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.innerHTML = `
      <div class="comment-card-header">
        <span class="comment-card-author">${c.avatar || '💬'} ${c.author} ${c.pos ? '<span style="color:#f59e0b;">(3D点位)</span>' : ''}</span>
        <span class="comment-card-time">${c.time}</span>
      </div>
      <div class="comment-card-text">${c.content}</div>
    `;
    container.appendChild(card);
  });
}

// --- UI Interaction & Event Listeners ---
function setupInteractionEvents() {
  const btnOrbit = document.getElementById('mode-orbit');
  const btnGyro = document.getElementById('mode-gyro');
  const btnCardboard = document.getElementById('mode-cardboard');
  const btnWebXR = document.getElementById('btn-webxr-trigger');

  btnOrbit.onclick = () => setViewingMode('orbit');
  btnGyro.onclick = () => setViewingMode('gyro');
  btnCardboard.onclick = () => setViewingMode('cardboard');

  btnWebXR.onclick = () => {
    if (navigator.xr && renderer.xr.isPresenting) {
      renderer.xr.getSession().end();
    } else if (navigator.xr) {
      navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })
        .then((session) => renderer.xr.setSession(session))
        .catch(() => showToast('请在 Quest / Pico / Vision Pro 等专业 VR 头显浏览器中点击入镜'));
    } else {
      document.getElementById('modal-help').style.display = 'flex';
      showToast('当前设备未检测到 WebXR 运行时，可使用【手机VR双目分屏】或用 VR 头显打开此网页');
    }
  };

  const skyNames = ['☀️ 仙阙晴光', '🌅 晚霞流金', '🌙 紫霄夜境'];
  const btnSky = document.getElementById('btn-sky-toggle');
  btnSky.onclick = () => {
    const nextMode = (state.skyMode + 1) % 3;
    setupCelestialSky(nextMode);
    btnSky.querySelector('span').innerText = skyNames[nextMode];
    showToast(`场景天色切换为: ${skyNames[nextMode]}`);
  };

  const btnCloud = document.getElementById('btn-cloud-toggle');
  btnCloud.onclick = () => {
    state.cloudDensityMode = (state.cloudDensityMode + 1) % 3;
    if (state.cloudDensityMode === 0) {
      cloudsGroup.visible = true;
      cloudPuffs.forEach(p => p.material.opacity = 0.55);
      showToast('☁️ 体积云模式: 仙境浓云 (建筑四周环绕云海)');
    } else if (state.cloudDensityMode === 1) {
      cloudsGroup.visible = true;
      cloudPuffs.forEach(p => p.material.opacity = 0.22);
      showToast('☁️ 体积云模式: 灵空轻雾 (半透飘渺云纱)');
    } else {
      cloudsGroup.visible = false;
      showToast('☁️ 体积云模式: 晴空微霁 (隐藏体积云)');
    }
  };

  const btnToggleLabels = document.getElementById('btn-toggle-labels');
  btnToggleLabels.onclick = () => {
    state.showLabels = !state.showLabels;
    btnToggleLabels.classList.toggle('active', state.showLabels);
    document.getElementById('labels-container').style.display = state.showLabels ? 'block' : 'none';
    pinsGroup.visible = state.showLabels;
    showToast(state.showLabels ? '🏷️ 3D 空间图钉标签已显示' : '🏷️ 3D 空间图钉标签已隐藏');
  };

  document.getElementById('btn-reset-cam').onclick = () => {
    controls.reset();
    camera.position.set(7.5, 25.0, 42.0);
    controls.target.set(-1.5, 4.5, -1.5);
    showToast('视角已重置为图 3 经典鸟瞰全景机位');
  };

  const btnBarrage = document.getElementById('btn-toggle-barrage');
  btnBarrage.onclick = () => {
    state.barrageEnabled = !state.barrageEnabled;
    document.getElementById('barrage-container').style.display = state.barrageEnabled ? 'block' : 'none';
    showToast(state.barrageEnabled ? '实时弹幕已开启' : '实时弹幕已关闭');
  };

  const btnPin = document.getElementById('btn-spatial-pin');
  btnPin.onclick = () => {
    state.spatialPinMode = !state.spatialPinMode;
    btnPin.classList.toggle('active', state.spatialPinMode);
    showToast(state.spatialPinMode ? '📍 已激活 3D 空间图钉：请点击场景建筑或平台任意表面放置评论' : '已退出 3D 图钉模式');
  };

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('pointerdown', (e) => {
    if (!state.spatialPinMode) return;
    if (e.target.closest('header, .tool-controls, .mode-bar, .drawer, .modal-overlay')) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects([pagodaGroup, platformsGroup], true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const commentText = prompt('📍 请输入要在该三维坐标点固定的展厅评论:');
      if (commentText && commentText.trim()) {
        postComment(commentText.trim(), {
          x: parseFloat(hit.point.x.toFixed(2)),
          y: parseFloat(hit.point.y.toFixed(2)),
          z: parseFloat(hit.point.z.toFixed(2))
        });
        state.spatialPinMode = false;
        btnPin.classList.remove('active');
        state.showLabels = true;
        btnToggleLabels.classList.add('active');
        document.getElementById('labels-container').style.display = 'block';
        pinsGroup.visible = true;
      }
    }
  });

  const commentDrawer = document.getElementById('comment-drawer');
  document.getElementById('btn-toggle-comments').onclick = () => {
    commentDrawer.classList.toggle('open');
  };
  document.getElementById('btn-close-drawer').onclick = () => {
    commentDrawer.classList.remove('open');
  };
  document.getElementById('btn-submit-comment').onclick = () => {
    const input = document.getElementById('comment-input');
    if (input.value.trim()) {
      postComment(input.value.trim());
      input.value = '';
    }
  };

  const modalHelp = document.getElementById('modal-help');
  document.getElementById('btn-help').onclick = () => modalHelp.style.display = 'flex';
  document.getElementById('btn-close-help').onclick = () => modalHelp.style.display = 'none';

  setupAuthEvents();
  setupUploadEvents();

  fetchComments();
  updateUserDisplay();
}

function setViewingMode(mode) {
  state.currentMode = mode;
  document.getElementById('mode-orbit').classList.toggle('active', mode === 'orbit');
  document.getElementById('mode-gyro').classList.toggle('active', mode === 'gyro');
  document.getElementById('mode-cardboard').classList.toggle('active', mode === 'cardboard');

  if (mode === 'gyro') {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((resp) => {
          if (resp === 'granted') {
            state.gyro.active = true;
            showToast('📱 手机陀螺仪已激活：旋转手机即可全景环顾！');
          } else {
            showToast('需要允许陀螺仪传感器权限');
          }
        })
        .catch(console.error);
    } else {
      showToast('📱 手机陀螺仪已就绪：移动手机即可全景环顾！');
    }
  } else if (mode === 'cardboard') {
    showToast('🥽 手机VR双目分屏已开启：横置手机放入VR眼镜盒即可沉浸式观看！');
  } else {
    showToast('🖥️ 自由观展模式：鼠标/手指拖动旋转');
  }
}

// --- Auth Modal & Session Management (Requirement 3) ---
function setupAuthEvents() {
  const modalAuth = document.getElementById('modal-auth');
  const btnLoginOpen = document.getElementById('btn-login-open');
  const btnCloseAuth = document.getElementById('btn-close-auth');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const btnAuthToggle = document.getElementById('btn-auth-toggle');

  let isRegisterMode = false;

  btnLoginOpen.onclick = () => {
    modalAuth.style.display = 'flex';
  };
  btnCloseAuth.onclick = () => {
    modalAuth.style.display = 'none';
  };

  btnAuthToggle.onclick = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? '新用户注册' : '用户登录';
    btnAuthSubmit.innerText = isRegisterMode ? '注 册' : '登 录';
    btnAuthToggle.innerText = isRegisterMode ? '已有账号？去登录' : '去注册账号';
  };

  btnAuthSubmit.onclick = async () => {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!username || !password) {
      showToast('请输入用户名和密码');
      return;
    }
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        state.currentUser = data.user;
        localStorage.setItem('vr_user', JSON.stringify(data.user));
        updateUserDisplay();
        modalAuth.style.display = 'none';
        showToast(`🎉 欢迎，${data.user.username}！`);
      } else {
        showToast(data.message || '操作失败');
      }
    } catch (e) {
      showToast('网络请求失败');
    }
  };
}

function updateUserDisplay() {
  const section = document.getElementById('user-section');
  const drawerUser = document.getElementById('comment-current-user');
  if (state.currentUser) {
    section.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:13px; color:var(--primary-gold);">👤 ${state.currentUser.username}</span>
        <button class="btn" style="padding:4px 8px; font-size:11px;" id="btn-logout">登出</button>
      </div>
    `;
    drawerUser.innerText = `当前身份: ${state.currentUser.username}`;
    document.getElementById('btn-logout').onclick = () => {
      state.currentUser = null;
      localStorage.removeItem('vr_user');
      updateUserDisplay();
      showToast('已安全退出登录');
    };
  } else {
    section.innerHTML = `
      <button class="btn btn-primary" id="btn-login-open">
        👤 <span>登录 / 注册</span>
      </button>
    `;
    drawerUser.innerText = '当前身份: 游客观众';
    document.getElementById('btn-login-open').onclick = () => {
      document.getElementById('modal-auth').style.display = 'flex';
    };
  }
}

// --- Asset Import Test (Requirement 4) ---
function setupUploadEvents() {
  const modalUpload = document.getElementById('modal-upload');
  document.getElementById('btn-open-upload').onclick = () => modalUpload.style.display = 'flex';
  document.getElementById('btn-close-upload').onclick = () => modalUpload.style.display = 'none';

  document.getElementById('btn-upload-submit').onclick = async () => {
    const fileInput = document.getElementById('upload-file');
    if (!fileInput.files || fileInput.files.length === 0) {
      showToast('请选择需要导入的美术资源文件');
      return;
    }
    const formData = new FormData();
    formData.append('assetFile', fileInput.files[0]);
    formData.append('title', document.getElementById('upload-title').value);
    formData.append('category', document.getElementById('upload-category').value);
    formData.append('platformIndex', document.getElementById('upload-platform').value);

    try {
      showToast('正在上传并导入展厅测试展台...');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        modalUpload.style.display = 'none';
        showToast('✅ 学院统一美术资源导入成功！正在展台呈列...');

        if (data.exhibit.type === 'model') {
          loadImportedModel(data.exhibit.fileUrl, data.exhibit.platformIndex);
        } else {
          loadImportedImage(data.exhibit.fileUrl, data.exhibit.platformIndex);
        }
      }
    } catch (e) {
      showToast('上传导入失败，请检查文件格式');
    }
  };
}

function loadImportedModel(url, platformIndex) {
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    const model = gltf.scene;
    model.scale.set(1.5, 1.5, 1.5);
    const pedestal = scene.getObjectByName(`pedestal_${platformIndex}`);
    if (pedestal) {
      pedestal.add(model);
      model.position.set(0, 0.6, 0);
    }
    showToast('✨ 3D 展品已成功安放至展台！');
  });
}

function loadImportedImage(url, platformIndex) {
  const tex = new THREE.TextureLoader().load(url);
  const geo = new THREE.PlaneGeometry(1.6, 2.2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);

  const pedestal = scene.getObjectByName(`pedestal_${platformIndex}`);
  if (pedestal) {
    pedestal.add(mesh);
    mesh.position.set(0, 1.5, 0);
  }
  showToast('✨ 展档画作已成功在展台展出！');
}

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function openCommentsDrawer() {
  document.getElementById('comment-drawer').classList.add('open');
}

// Start
initScene();
