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
  showLabels: false,
  spatialPinMode: false,
  barrageEnabled: true,
  modelsLoaded: false,
  gyro: { alpha: 0, beta: 0, gamma: 0, active: false }
};

// --- Three.js Globals ---
let scene, camera, renderer, controls, stereoCamera;
const clock = new THREE.Clock();
let cloudsGroup, architectureGroup, exhibitsGroup, pinsGroup;
const lanternLights = [];
let dirLight, fillLight, hemiLight, ambientLight;
const pedestals = {};

// UE5 BISHE.umap Reference Origin: (75680, 85840, 44820), scale 0.1
const UE_ORIGIN = { x: 75680.0, y: 85840.0, z: 44820.0 };
const UE_SCALE = 0.1;

function ueToThreePos(ux, uy, uz) {
  return new THREE.Vector3(
    (ux - UE_ORIGIN.x) * UE_SCALE,
    (uz - UE_ORIGIN.z) * UE_SCALE,
    (uy - UE_ORIGIN.y) * UE_SCALE
  );
}

// --- Initialize Scene ---
function initScene() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8faed0, 95, 260);

  camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
  // Camera angle matching Image 2 & Image 3 viewport perspective
  camera.position.set(-25.5, 30.5, 41.0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(-1.0, 5.8, -1.0);
  controls.maxDistance = 160;
  controls.minDistance = 4;
  controls.maxPolarAngle = Math.PI / 2 + 0.12;
  controls.update();

  window._camera = camera;
  window._controls = controls;
  window._scene = scene;
  window.THREE = THREE;

  stereoCamera = new THREE.StereoCamera();
  stereoCamera.aspect = 0.5;
  stereoCamera.eyeSep = 0.064;

  cloudsGroup = new THREE.Group();
  architectureGroup = new THREE.Group();
  exhibitsGroup = new THREE.Group();
  pinsGroup = new THREE.Group();

  scene.add(cloudsGroup);
  scene.add(architectureGroup);
  scene.add(exhibitsGroup);
  scene.add(pinsGroup);

  setupLighting();
  setupCelestialSky(0);
  loadRealUE5Architecture();
  buildVolumetricClouds();

  window.addEventListener('resize', onWindowResize);
  setupInteractionEvents();
  setupGyroscope();

  renderer.setAnimationLoop(renderLoop);
}

// --- Lighting Setup (Matching Image 3 Sun & Sky Bounce) ---
function setupLighting() {
  ambientLight = new THREE.AmbientLight(0xfff8ed, 0.55);
  scene.add(ambientLight);

  hemiLight = new THREE.HemisphereLight(0xdbeafe, 0xfde68a, 0.58);
  hemiLight.position.set(0, 60, 0);
  scene.add(hemiLight);

  // Main Golden Sunlight from upper-left/front casting shadows across the platforms
  dirLight = new THREE.DirectionalLight(0xffecc4, 1.55);
  dirLight.position.set(-32, 46, 22);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 160;
  dirLight.shadow.camera.left = -45;
  dirLight.shadow.camera.right = 45;
  dirLight.shadow.camera.top = 45;
  dirLight.shadow.camera.bottom = -45;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // Soft Warm Fill Light for architectural shadow detail
  fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.38);
  fillLight.position.set(28, 18, -25);
  scene.add(fillLight);
}

// --- Celestial Skybox (Matching UE5 SkyAtmosphere in Image 3) ---
function setupCelestialSky(mode) {
  state.skyMode = mode;
  let zenithColor, horizonColor, lowerColor, fogColor, lightColor, lightIntensity;

  if (mode === 0) {
    zenithColor = '#5882b8';
    horizonColor = '#8cb0d8';
    lowerColor = '#9cbbe0';
    fogColor = 0x8cb0d8;
    lightColor = 0xffecc4;
    lightIntensity = 1.55;
  } else if (mode === 1) {
    zenithColor = '#3b2d54';
    horizonColor = '#d98a5b';
    lowerColor = '#eab676';
    fogColor = 0xd98a5b;
    lightColor = 0xffcf87;
    lightIntensity = 1.45;
  } else {
    zenithColor = '#0c162d';
    horizonColor = '#1e335c';
    lowerColor = '#152442';
    fogColor = 0x152442;
    lightColor = 0xa5b4fc;
    lightIntensity = 0.95;
  }

  scene.fog.color.setHex(fogColor);
  dirLight.color.setHex(lightColor);
  dirLight.intensity = lightIntensity;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, zenithColor);
  grad.addColorStop(0.48, horizonColor);
  grad.addColorStop(0.75, lowerColor);
  grad.addColorStop(1.0, zenithColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;

  if (cloudShaderMat) {
    if (mode === 0) {
      cloudShaderMat.uniforms.uSunColor.value.set(0xffffff).multiplyScalar(1.25);
      cloudShaderMat.uniforms.uShadowColor.value.set(0xdbeafe);
      cloudShaderMat.uniforms.uSkyColor.value.set(0xfff1e6);
    } else if (mode === 1) {
      cloudShaderMat.uniforms.uSunColor.value.set(0xffe2b8).multiplyScalar(1.20);
      cloudShaderMat.uniforms.uShadowColor.value.set(0xd4bfe8);
      cloudShaderMat.uniforms.uSkyColor.value.set(0xffcfb0);
    } else {
      cloudShaderMat.uniforms.uSunColor.value.set(0xdbeafe).multiplyScalar(1.10);
      cloudShaderMat.uniforms.uShadowColor.value.set(0x6b82a8);
      cloudShaderMat.uniforms.uSkyColor.value.set(0x8fa8d0);
    }
  }
}

// --- Load Real PBR Texture Set extracted from UE5 (.uasset) ---
const texLoader = new THREE.TextureLoader();
function loadPBRMaterial(prefix, options = {}) {
  const baseTex = texLoader.load(`/assets/textures/${prefix}.jpg`);
  baseTex.flipY = false;
  baseTex.colorSpace = THREE.SRGBColorSpace;

  const metalTex = texLoader.load(`/assets/textures/${prefix}_metallic.jpg`);
  metalTex.flipY = false;

  const roughTex = texLoader.load(`/assets/textures/${prefix}_roughness.jpg`);
  roughTex.flipY = false;

  const normTex = texLoader.load(`/assets/textures/${prefix}_normal.jpg`);
  normTex.flipY = false;

  const mat = new THREE.MeshStandardMaterial({
    map: baseTex,
    metalnessMap: metalTex,
    roughnessMap: roughTex,
    normalMap: normTex,
    normalScale: new THREE.Vector2(1.4, 1.4),
    metalness: options.metalness ?? 0.35,
    roughness: options.roughness ?? 0.72,
    color: options.tint ?? 0xffffff
  });

  if (options.emissive) {
    mat.emissive = new THREE.Color(options.emissive);
    mat.emissiveMap = baseTex;
    mat.emissiveIntensity = options.emissiveIntensity ?? 0.35;
  }

  return mat;
}

// --- Load Real 3D Meshes & Exact Actor Transforms from BISHE.umap ---
function loadRealUE5Architecture() {
  const gltfLoader = new GLTFLoader();

  const matZhuti = loadPBRMaterial('zhuti', {
    metalness: 0.35,
    roughness: 0.72,
    tint: 0xffffff
  });

  const matPingtai = loadPBRMaterial('pingtai', {
    metalness: 0.32,
    roughness: 0.74,
    tint: 0xffffff
  });
  const matLianhua = loadPBRMaterial('lianhua', {
    metalness: 0.32,
    roughness: 0.72,
    tint: 0xffffff
  });
  const matDeng = loadPBRMaterial('deng', {
    metalness: 0.35,
    roughness: 0.68,
    tint: 0xffffff,
    emissive: 0xffa726,
    emissiveIntensity: 0.42
  });

  // 1. Load 主体 (Main Celestial Pagoda)
  // UE5 BISHE.umap: Location (75650, 85630, 44840), Rotation (0, 10, 0), Scale (2.5, 2.5, 2.5)
  gltfLoader.load('/assets/models/zhuti.glb', (gltf) => {
    const root = gltf.scene;
    root.traverse((child) => {
      if (child.isMesh) {
        child.material = matZhuti;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    root.position.copy(ueToThreePos(75650.0, 85630.0, 44840.0));
    root.rotation.y = -THREE.MathUtils.degToRad(10.0);
    root.scale.setScalar(2.5 * UE_SCALE);
    architectureGroup.add(root);
    state.modelsLoaded = true;
  });

  // 2. Load 平台 (3 Cascading Floating Platforms from BISHE.umap)
  // 平台1: (75720, 85990, 44810), Rot (0, 0, 0), Scale (1.0, 1.0, 1.0)
  // 平台2: (75620, 85790, 44830), Rot (0, -60, 0), Scale (1.5, 1.5, 1.5)
  // 平台3: (75720, 85870, 44820), Rot (0, 0, 0), Scale (1.5, 1.5, 1.5)
  const platformInstances = [
    { id: 1, loc: [75720.0, 85990.0, 44810.0], yaw: 0.0, scale: 1.0 },
    { id: 3, loc: [75720.0, 85870.0, 44820.0], yaw: 0.0, scale: 1.5 },
    { id: 2, loc: [75620.0, 85790.0, 44830.0], yaw: -60.0, scale: 1.5 }
  ];

  gltfLoader.load('/assets/models/pingtai.glb', (gltf) => {
    const basePlat = gltf.scene;
    basePlat.traverse((child) => {
      if (child.isMesh) {
        child.material = matPingtai;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    platformInstances.forEach((cfg) => {
      const clone = basePlat.clone(true);
      const pos = ueToThreePos(cfg.loc[0], cfg.loc[1], cfg.loc[2]);
      clone.position.copy(pos);
      clone.rotation.y = -THREE.MathUtils.degToRad(cfg.yaw);
      clone.scale.setScalar(cfg.scale * UE_SCALE);
      architectureGroup.add(clone);

      // Anchor point on platform surface for imported college art assets (Requirement 4)
      const anchor = new THREE.Group();
      anchor.position.set(pos.x, pos.y + 1.15 * cfg.scale, pos.z);
      anchor.name = `pedestal_${cfg.id}`;
      exhibitsGroup.add(anchor);
      pedestals[cfg.id] = anchor;
    });

    fetchExhibits();
  });

  // 3. Load 灯 (2 Palace Stone Lanterns flanking Platform 1 Entrance Stairs)
  // 灯1: (75740, 86040, 44810), Scale (0.25, 0.25, 0.25)
  // 灯2: (75700, 86040, 44810), Scale (0.25, 0.25, 0.25)
  const lanternLocs = [
    [75740.0, 86040.0, 44810.0],
    [75700.0, 86040.0, 44810.0]
  ];

  gltfLoader.load('/assets/models/deng.glb', (gltf) => {
    const baseDeng = gltf.scene;
    baseDeng.traverse((child) => {
      if (child.isMesh) {
        child.material = matDeng;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    lanternLocs.forEach((loc) => {
      const clone = baseDeng.clone(true);
      const pos = ueToThreePos(loc[0], loc[1], loc[2]);
      clone.position.copy(pos);
      clone.scale.setScalar(0.25 * UE_SCALE);
      architectureGroup.add(clone);

      // Warm Golden Lantern Light inside the lantern chamber
      const pLight = new THREE.PointLight(0xffaa33, 4.5, 12, 1.5);
      pLight.position.set(pos.x, pos.y + 1.9, pos.z);
      architectureGroup.add(pLight);
      lanternLights.push(pLight);
    });
  });

  // 4. Load 莲花 (Lotus Pedestal accent under the main pagoda platform)
  gltfLoader.load('/assets/models/lianhua.glb', (gltf) => {
    const lotus = gltf.scene;
    lotus.traverse((child) => {
      if (child.isMesh) {
        child.material = matLianhua;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const pos = ueToThreePos(75650.0, 85630.0, 44835.0);
    lotus.position.copy(pos);
    lotus.scale.setScalar(1.85 * UE_SCALE);
    architectureGroup.add(lotus);
  });
}

// =========================================================================
// --- Volumetric Clouds System (在建筑附近放置体积云) ---
// =========================================================================
// --- Volumetric 3D Cumulus Cloud Formations System (立体雕塑感祥云系统 - 匹配基准画作) ---
let cloudMeshes = [];
let cloudShaderMat = null;

function createRealisticCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Multi-layered organic cumulus billow cauliflower lobes
  const lobes = [
    { x: 512, y: 512, r: 350, a: 1.00 },
    { x: 440, y: 470, r: 270, a: 0.92 },
    { x: 590, y: 460, r: 280, a: 0.92 },
    { x: 370, y: 510, r: 230, a: 0.85 },
    { x: 660, y: 500, r: 240, a: 0.85 },
    { x: 512, y: 390, r: 260, a: 0.95 },
    { x: 410, y: 360, r: 210, a: 0.88 },
    { x: 620, y: 370, r: 210, a: 0.88 },
    { x: 512, y: 630, r: 250, a: 0.78 },
    { x: 390, y: 610, r: 200, a: 0.74 },
    { x: 640, y: 600, r: 210, a: 0.74 },
    { x: 300, y: 440, r: 170, a: 0.70 },
    { x: 730, y: 430, r: 170, a: 0.70 },
    { x: 512, y: 290, r: 160, a: 0.85 },
    { x: 320, y: 560, r: 160, a: 0.65 },
    { x: 700, y: 550, r: 160, a: 0.65 },
    // Outer fine cauliflower scalloping
    { x: 260, y: 490, r: 130, a: 0.60 },
    { x: 770, y: 480, r: 130, a: 0.60 },
    { x: 430, y: 290, r: 130, a: 0.75 },
    { x: 600, y: 290, r: 130, a: 0.75 },
    { x: 350, y: 330, r: 140, a: 0.70 },
    { x: 680, y: 340, r: 140, a: 0.70 },
    { x: 450, y: 690, r: 140, a: 0.60 },
    { x: 580, y: 680, r: 140, a: 0.60 }
  ];

  lobes.forEach((l) => {
    const grad = ctx.createRadialGradient(l.x - 14, l.y - 20, 8, l.x, l.y, l.r);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, ' + l.a + ')');
    grad.addColorStop(0.38, 'rgba(255, 255, 255, ' + (l.a * 0.90) + ')');
    grad.addColorStop(0.70, 'rgba(248, 252, 255, ' + (l.a * 0.50) + ')');
    grad.addColorStop(0.88, 'rgba(235, 245, 255, ' + (l.a * 0.15) + ')');
    grad.addColorStop(1.0, 'rgba(220, 235, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const cloudVertexShader = `
  attribute float aPhase;
  attribute float aBaseOpacity;
  attribute vec3 aClusterCenter;
  attribute float aClusterRadius;

  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vRelativeY;
  varying float vOpacity;
  varying float vWorldY;

  void main() {
    vUv = uv;
    vOpacity = aBaseOpacity;

    // Instance center in world coordinates
    vec4 worldCenter = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 center = worldCenter.xyz;

    // Organic breathing & gentle wave drift
    center.y += sin(uTime * 0.55 + aPhase) * 0.22;
    center.x += cos(uTime * 0.30 + aPhase * 1.3) * 0.22;
    center.z += sin(uTime * 0.30 + aPhase * 1.1) * 0.22;

    // View-aligned billboard frame
    vec3 toCam = normalize(cameraPosition - center);
    vec3 upVec = vec3(0.0, 1.0, 0.0);
    vec3 rightVec = normalize(cross(upVec, toCam));
    vec3 trueUp = cross(toCam, rightVec);

    vec3 mScale = vec3(
      length(vec3(modelMatrix[0].xyz)),
      length(vec3(modelMatrix[1].xyz)),
      length(vec3(modelMatrix[2].xyz))
    );

    vec3 worldPos = center + (position.x * mScale.x) * rightVec + (position.y * mScale.y) * trueUp;
    vWorldPos = worldPos;
    vViewDir = toCam;
    vWorldY = worldPos.y;

    // Calculate dynamic 3D spherical dome normal on billboard
    vec2 p = uv * 2.0 - 1.0;
    float r2 = dot(p, p);
    float z = sqrt(max(0.0, 1.0 - r2));
    vWorldNormal = normalize(p.x * rightVec + p.y * trueUp + z * toCam);

    // Height relative to cloud cluster center for volumetric vertical self-shadowing
    vRelativeY = clamp((worldPos.y - aClusterCenter.y) / max(1.2, aClusterRadius), -1.0, 1.0);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform sampler2D uCloudTex;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uShadowColor;
  uniform vec3 uSkyColor;
  uniform float uCloudDensity;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vRelativeY;
  varying float vOpacity;
  varying float vWorldY;

  void main() {
    vec4 tex = texture2D(uCloudTex, vUv);
    if (tex.a < 0.005) discard;

    // 1. Wrapped directional diffuse lighting (Half-Lambert with high wrap for pure luminous clouds)
    float NdotL = dot(vWorldNormal, uSunDir);
    float wrap = 0.55;
    float diffuse = clamp((NdotL + wrap) / (1.0 + wrap), 0.0, 1.0);

    // 2. Vertical ambient shading across cloud cluster (subtle top-to-bottom shading, never dark!)
    float clusterAO = smoothstep(-1.0, 0.85, vRelativeY) * 0.15 + 0.85;

    // 3. Absolute world height gradient (soft airy gradient)
    float seaDepth = clamp((vWorldY + 12.0) / 28.0, 0.0, 1.0);
    float heightAO = mix(0.92, 1.02, seaDepth);

    // 4. Luminous multi-color blend: Pure white sunlight on crests + Soft ethereal sky-periwinkle in shadows
    vec3 ambientTone = mix(uShadowColor, uSkyColor, 0.50);
    vec3 litColor = mix(ambientTone, uSunColor, diffuse * 0.65 + 0.35);
    litColor *= (clusterAO * heightAO);

    // 5. Silver lining forward rim scattering & Subsurface Scattering (golden rim towards sun)
    float VdotL = max(0.0, dot(vViewDir, -uSunDir));
    float rim = pow(1.0 - abs(dot(vWorldNormal, vViewDir)), 2.0);
    vec3 silverLining = uSunColor * (rim * VdotL * 0.45);

    // 6. Morning sunrise golden glow for clouds on the sunlit left flank
    float sunSideGlow = clamp((-vWorldPos.x + 18.0) / 45.0, 0.0, 1.0);
    vec3 sunriseAmber = vec3(1.0, 0.94, 0.82);
    vec3 sssGlow = sunriseAmber * (sunSideGlow * 0.20 * rim);

    vec3 finalRgb = clamp(litColor + silverLining + sssGlow, 0.0, 1.0);
    float alpha = tex.a * vOpacity * uCloudDensity;

    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

function createPuffGeometry(clusterCenter, clusterRadius, phase, baseOpacity) {
  const geom = new THREE.PlaneGeometry(1, 1);
  const count = geom.attributes.position.count;
  const aClusterCenter = new Float32Array(count * 3);
  const aClusterRadius = new Float32Array(count);
  const aPhase = new Float32Array(count);
  const aBaseOpacity = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    aClusterCenter[i * 3 + 0] = clusterCenter.x;
    aClusterCenter[i * 3 + 1] = clusterCenter.y;
    aClusterCenter[i * 3 + 2] = clusterCenter.z;
    aClusterRadius[i] = clusterRadius;
    aPhase[i] = phase;
    aBaseOpacity[i] = baseOpacity;
  }

  geom.setAttribute('aClusterCenter', new THREE.BufferAttribute(aClusterCenter, 3));
  geom.setAttribute('aClusterRadius', new THREE.BufferAttribute(aClusterRadius, 1));
  geom.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geom.setAttribute('aBaseOpacity', new THREE.BufferAttribute(aBaseOpacity, 1));
  return geom;
}

function buildVolumetricClouds() {
  while (cloudsGroup.children.length > 0) {
    cloudsGroup.remove(cloudsGroup.children[0]);
  }
  cloudMeshes = [];

  // Load HD cumulus billow texture
  const cloudTexLoader = new THREE.TextureLoader();
  const cloudTex = cloudTexLoader.load(
    '/assets/textures/cumulus_billow_hd.png',
    undefined,
    undefined,
    () => {
      // Fallback
    }
  );
  cloudTex.colorSpace = THREE.SRGBColorSpace;

  cloudShaderMat = new THREE.ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    uniforms: {
      uCloudTex: { value: cloudTex },
      uSunDir: { value: new THREE.Vector3(-0.55, 0.78, 0.38).normalize() },
      uSunColor: { value: new THREE.Color(0xffffff).multiplyScalar(1.25) },
      uShadowColor: { value: new THREE.Color(0xdbeafe) },
      uSkyColor: { value: new THREE.Color(0xfff1e6) },
      uCloudDensity: { value: 1.0 },
      uTime: { value: 0.0 }
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });

  const addCloudCluster = (def) => {
    const { center, radius, lobeCount = 18, baseScale = 10.0, heightSpread = 2.8, driftSpeed = 0.003 } = def;

    for (let i = 0; i < lobeCount; i++) {
      let rx, ry, rz, s, opacity;
      const isCore = (i < Math.max(4, Math.floor(lobeCount * 0.35)));

      if (isCore) {
        const angle = (i * Math.PI * 2) / 4;
        const dist = (radius * 0.28) * Math.random();
        rx = center.x + Math.cos(angle) * dist;
        rz = center.z + Math.sin(angle) * dist;
        ry = center.y + (Math.random() - 0.35) * (heightSpread * 0.45);
        s = baseScale * (1.15 + Math.random() * 0.35);
        opacity = 0.92 + Math.random() * 0.06;
      } else {
        const angle = (i * 2.39996) + Math.random() * 0.45;
        const radDist = (radius * 0.35) + Math.random() * (radius * 0.65);
        rx = center.x + Math.cos(angle) * radDist;
        rz = center.z + Math.sin(angle) * radDist;

        const isTopLobe = (i % 3 === 0);
        if (isTopLobe) {
          ry = center.y + (0.35 + Math.random() * 0.65) * heightSpread;
          s = baseScale * (0.75 + Math.random() * 0.30);
          opacity = 0.94; // Crisp sunlit billow dome
        } else {
          ry = center.y - (0.2 + Math.random() * 0.55) * heightSpread;
          s = baseScale * (0.90 + Math.random() * 0.40);
          opacity = 0.78 + Math.random() * 0.15;
        }
      }

      const phase = Math.random() * Math.PI * 2;
      const geom = createPuffGeometry(center, radius, phase, opacity);
      const mesh = new THREE.Mesh(geom, cloudShaderMat);
      mesh.position.set(rx, ry, rz);
      mesh.scale.set(s * 1.35, s * 0.88, 1.0);

      mesh.userData = {
        clusterCenter: center,
        initPos: new THREE.Vector3(rx, ry, rz),
        driftRadius: Math.hypot(rx - center.x, rz - center.z),
        baseAngle: Math.atan2(rz - center.z, rx - center.x),
        driftSpeed: driftSpeed * (i % 2 === 0 ? 1 : -1),
        vFreq: 0.18 + Math.random() * 0.12,
        vAmp: 0.16 + Math.random() * 0.12,
        phase: phase
      };

      cloudsGroup.add(mesh);
      cloudMeshes.push(mesh);
    }
  };

  // =========================================================================
  // 【Formation 1: 浩瀚云海大底 (Vast Rolling Cloud Sea)】
  // 覆盖整个下界空间，形成如同油画参考图般的无尽层叠积云浪涌
  // =========================================================================
  const seaGrid = [
    [-52, -45], [-35, -48], [-18, -45], [0, -48], [18, -45], [35, -48], [52, -45],
    [-45, -28], [-28, -30], [-10, -28], [8, -30], [26, -28], [44, -30],
    [-48, -10], [-30, -12], [-12, -10], [6, -12], [24, -10], [42, -12],
    [-42, 8],   [-24, 6],   [-6, 8],    [12, 6],  [30, 8],   [48, 8],
    [-35, 25],  [-18, 22],  [0, 25],    [18, 22], [36, 25],
    [-25, 42],  [-8, 40],   [10, 42],   [28, 40]
  ];

  seaGrid.forEach(([gx, gz], idx) => {
    const waveY = -8.2 + Math.sin(gx * 0.08 + gz * 0.06) * 1.8;
    const waveR = 12.0 + (idx % 4) * 2.5;
    addCloudCluster({
      center: { x: gx, y: waveY, z: gz },
      radius: waveR,
      lobeCount: 16,
      baseScale: 10.5,
      heightSpread: 2.8,
      driftSpeed: 0.0025 * ((idx % 2 === 0) ? 1 : -1)
    });
  });

  // =========================================================================
  // 【Formation 2: 右侧巍峨耸立的巨型积雨云山群 (Grand Towering Cumulus Mountain)】
  // 参考画作最核心特征：右侧自云海拔地而起、高耸直插天际的九天仙峦积云柱
  // =========================================================================
  // A. 基础涌云 (Base Tier: y=-3 ~ 2, 雄浑基座)
  addCloudCluster({ center: { x: 22.0, y: -2.5, z: -8.0 }, radius: 15.0, lobeCount: 22, baseScale: 12.5, heightSpread: 3.5, driftSpeed: 0.002 });
  addCloudCluster({ center: { x: 34.0, y: -1.5, z: 2.0 },  radius: 16.0, lobeCount: 22, baseScale: 13.0, heightSpread: 3.5, driftSpeed: -0.002 });

  // B. 巨峰腰部 (Mid Tier: y=4 ~ 12, 浪涌云腰)
  addCloudCluster({ center: { x: 25.0, y: 6.0, z: -6.0 },  radius: 14.0, lobeCount: 20, baseScale: 12.0, heightSpread: 3.5, driftSpeed: 0.002 });
  addCloudCluster({ center: { x: 36.0, y: 8.5, z: 0.0 },   radius: 15.0, lobeCount: 20, baseScale: 12.5, heightSpread: 3.8, driftSpeed: -0.002 });
  addCloudCluster({ center: { x: 44.0, y: 7.0, z: -10.0 }, radius: 14.0, lobeCount: 18, baseScale: 11.5, heightSpread: 3.5, driftSpeed: 0.002 });

  // C. 冲天云柱 (Tower Tier: y=13 ~ 22, 直插青天)
  addCloudCluster({ center: { x: 27.0, y: 15.5, z: -5.0 }, radius: 12.5, lobeCount: 18, baseScale: 11.0, heightSpread: 3.5, driftSpeed: 0.0018 });
  addCloudCluster({ center: { x: 38.0, y: 17.0, z: -1.0 }, radius: 13.0, lobeCount: 18, baseScale: 11.5, heightSpread: 3.8, driftSpeed: -0.0018 });

  // D. 晴空云冠 (Sky Crown Peaks: y=23 ~ 30, 耀眼金顶对映深蓝晴空)
  addCloudCluster({ center: { x: 29.0, y: 24.5, z: -4.0 }, radius: 10.5, lobeCount: 16, baseScale: 10.0, heightSpread: 3.2, driftSpeed: 0.0015 });
  addCloudCluster({ center: { x: 39.0, y: 26.0, z: 1.0 },  radius: 10.0, lobeCount: 16, baseScale: 9.5,  heightSpread: 3.0, driftSpeed: -0.0015 });

  // =========================================================================
  // 【Formation 3: 左侧朝曦晨光逆光祥云海 (Left Morning Sunrise Cloud Banks)】
  // 主楼后方与左侧受晨光照射的朝霞金色祥云屏障
  // =========================================================================
  addCloudCluster({ center: { x: -26.0, y: -2.0, z: -14.0 }, radius: 14.5, lobeCount: 22, baseScale: 12.5, heightSpread: 3.5, driftSpeed: 0.002 });
  addCloudCluster({ center: { x: -38.0, y: 5.0,  z: -18.0 }, radius: 15.5, lobeCount: 22, baseScale: 13.0, heightSpread: 3.8, driftSpeed: -0.002 });
  addCloudCluster({ center: { x: -22.0, y: 10.5, z: -8.0 },  radius: 12.0, lobeCount: 18, baseScale: 10.5, heightSpread: 3.2, driftSpeed: 0.002 });
  addCloudCluster({ center: { x: -34.0, y: 15.0, z: -12.0 }, radius: 11.0, lobeCount: 16, baseScale: 10.0, heightSpread: 3.0, driftSpeed: -0.002 });

  // =========================================================================
  // 【Formation 4: 浮岛平台与石阶托底祥云 (Platform Underpinning Cushions)】
  // 紧贴平台边缘与飞桥峡谷，呈现云端悬浮感
  // =========================================================================
  const p1Pos = ueToThreePos(75720.0, 85990.0, 44810.0);
  addCloudCluster({
    center: { x: p1Pos.x + 0.5, y: p1Pos.y - 4.4, z: p1Pos.z + 1.2 },
    radius: 9.5,
    lobeCount: 18,
    baseScale: 9.0,
    heightSpread: 2.4,
    driftSpeed: 0.003
  });

  // 飞阶飞桥峡谷涌云
  addCloudCluster({ center: { x: 7.2, y: -4.5, z: 9.0 }, radius: 8.5, lobeCount: 16, baseScale: 8.5, heightSpread: 2.2, driftSpeed: -0.003 });
  addCloudCluster({ center: { x: 2.2, y: -4.2, z: 4.8 }, radius: 8.0, lobeCount: 15, baseScale: 8.0, heightSpread: 2.0, driftSpeed: 0.003 });

  // 平台 3 (中台) 托底云
  const p3Pos = ueToThreePos(75720.0, 85870.0, 44820.0);
  addCloudCluster({
    center: { x: p3Pos.x - 2.5, y: p3Pos.y - 4.0, z: p3Pos.z + 0.5 },
    radius: 10.0,
    lobeCount: 18,
    baseScale: 9.5,
    heightSpread: 2.5,
    driftSpeed: 0.003
  });

  // 平台 2 (高台) 托底云
  const p2Pos = ueToThreePos(75620.0, 85790.0, 44830.0);
  addCloudCluster({
    center: { x: p2Pos.x + 1.5, y: p2Pos.y - 3.8, z: p2Pos.z - 1.0 },
    radius: 11.0,
    lobeCount: 20,
    baseScale: 10.0,
    heightSpread: 2.6,
    driftSpeed: -0.003
  });

  // 主楼金莲底座环绕云
  const pagodaPos = ueToThreePos(75650.0, 85630.0, 44840.0);
  addCloudCluster({
    center: { x: pagodaPos.x, y: pagodaPos.y - 2.6, z: pagodaPos.z },
    radius: 13.5,
    lobeCount: 24,
    baseScale: 11.5,
    heightSpread: 3.0,
    driftSpeed: 0.002
  });

  // =========================================================================
  // 【Formation 5: 远方环天平流积云山脉 (Horizon Cumulus Mountain Ring)】
  // =========================================================================
  const horizonCount = 36;
  const horizonCenter = { x: -2.0, z: -10.0 };
  for (let h = 0; h < horizonCount; h++) {
    const angle = (h * Math.PI * 2) / horizonCount;
    const hr = 55.0 + (h % 5) * 9.0 + Math.sin(h * 1.7) * 5.0;
    const hx = horizonCenter.x + Math.cos(angle) * hr;
    const hz = horizonCenter.z + Math.sin(angle) * hr;
    const hy = -8.0 + (h % 3) * 2.0 + Math.sin(h * 2.1) * 1.2;
    const hs = 16.0 + (h % 4) * 4.0;

    const phase = h * 0.3;
    const geom = createPuffGeometry({ x: hx, y: hy, z: hz }, hs * 0.8, phase, 0.78);
    const mesh = new THREE.Mesh(geom, cloudShaderMat);
    mesh.position.set(hx, hy, hz);
    mesh.scale.set(hs * 1.45, hs * 0.85, 1.0);
    mesh.userData = {
      clusterCenter: { x: hx, y: hy, z: hz },
      initPos: new THREE.Vector3(hx, hy, hz),
      driftRadius: hr,
      baseAngle: angle,
      driftSpeed: 0.0015 * (h % 2 === 0 ? 1 : -1),
      vFreq: 0.12,
      vAmp: 0.22,
      phase: phase
    };
    cloudsGroup.add(mesh);
    cloudMeshes.push(mesh);
  }
}

function updateClouds(delta, elapsed) {
  if (cloudShaderMat) {
    cloudShaderMat.uniforms.uTime.value = elapsed;
    cloudShaderMat.uniforms.uSunDir.value.copy(dirLight.position).normalize();
  }

  // 云团微动态公转与呼吸起伏
  cloudMeshes.forEach((mesh) => {
    const ud = mesh.userData;
    if (!ud) return;
    ud.baseAngle += ud.driftSpeed * delta;
    mesh.position.x = ud.clusterCenter.x + Math.cos(ud.baseAngle) * ud.driftRadius;
    mesh.position.z = ud.clusterCenter.z + Math.sin(ud.baseAngle) * ud.driftRadius;
    mesh.position.y = ud.initPos.y + Math.sin(elapsed * ud.vFreq + ud.phase) * ud.vAmp;
  });

  lanternLights.forEach((light, idx) => {
    light.intensity = 4.2 + Math.sin(elapsed * 3.8 + idx) * 0.5;
  });
}

// --- Render Loop ---
function renderLoop() {
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateClouds(delta, elapsed);
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

  const pinMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.8
  });

  state.comments.forEach((c) => {
    if (c.pos) {
      const pinGeo = new THREE.SphereGeometry(0.22, 16, 16);
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(c.pos.x, c.pos.y, c.pos.z);
      pinMesh.userData = { comment: c };
      pinsGroup.add(pinMesh);

      const needleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8);
      const needle = new THREE.Mesh(needleGeo, pinMat);
      needle.position.set(c.pos.x, c.pos.y - 0.35, c.pos.z);
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
        label.innerHTML = `<b>${c.author}</b>: ${c.content.slice(0, 16)}${c.content.length > 16 ? '...' : ''}`;
        label.onclick = () => {
          showToast(`${c.author}: ${c.content} (${c.time})`);
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

async function fetchExhibits() {
  try {
    const res = await fetch('/api/exhibits');
    const data = await res.json();
    if (data.success && Array.isArray(data.exhibits)) {
      state.exhibits = data.exhibits;
      data.exhibits.forEach((ex) => {
        if (ex.type === 'model') {
          loadImportedModel(ex.fileUrl, ex.platformIndex, false);
        } else {
          loadImportedImage(ex.fileUrl, ex.platformIndex, false);
        }
      });
    }
  } catch (e) {
    console.error('Failed to fetch exhibits:', e);
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
      showToast(pos ? '3D 空间定位评论已成功标注至建筑表面' : '评论发表成功');
    }
  } catch (e) {
    showToast('发表评论失败，请重试');
  }
}

function renderCommentsList() {
  const container = document.getElementById('comment-list-container');
  container.innerHTML = '';
  state.comments.forEach((c) => {
    const badgeChar = (c.author || '访')[0];
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.innerHTML = `
      <div class="comment-card-header">
        <span class="comment-card-author">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(245,158,11,0.22);color:var(--primary-gold);font-size:11px;margin-right:4px;">${badgeChar}</span>
          ${c.author} ${c.pos ? '<span style="color:#f59e0b;font-size:11px;">[3D点位]</span>' : ''}
        </span>
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
        .catch(() => {
          setViewingMode('cardboard');
          showToast('未检测到头显连接，已为您自动切换至 VR 双目立体分屏模式');
        });
    } else {
      setViewingMode('cardboard');
      showToast('当前浏览器未启用 WebXR，已为您自动开启 VR 双目立体分屏模式');
    }
  };

  const skyNames = ['仙阙晴光', '晚霞流金', '紫霄夜境'];
  const btnSky = document.getElementById('btn-sky-toggle');
  btnSky.onclick = () => {
    const nextMode = (state.skyMode + 1) % 3;
    setupCelestialSky(nextMode);
    btnSky.querySelector('span').innerText = skyNames[nextMode];
    showToast(`场景天色已切换为：${skyNames[nextMode]}`);
  };

  const btnCloud = document.getElementById('btn-cloud-toggle');
  btnCloud.onclick = () => {
    state.cloudDensityMode = (state.cloudDensityMode + 1) % 3;
    if (state.cloudDensityMode === 0) {
      cloudsGroup.visible = true;
      if (cloudShaderMat) cloudShaderMat.uniforms.uCloudDensity.value = 1.0;
      showToast('立体云模式：仙阙祥云（朵朵立体祥云环绕仙阁）');
    } else if (state.cloudDensityMode === 1) {
      cloudsGroup.visible = true;
      if (cloudShaderMat) cloudShaderMat.uniforms.uCloudDensity.value = 0.45;
      showToast('立体云模式：灵空薄岚（轻灵半透薄云）');
    } else {
      cloudsGroup.visible = false;
      showToast('立体云模式：晴空万里（隐藏云层）');
    }
  };

  const btnToggleLabels = document.getElementById('btn-toggle-labels');
  btnToggleLabels.onclick = () => {
    state.showLabels = !state.showLabels;
    btnToggleLabels.classList.toggle('active', state.showLabels);
    document.getElementById('labels-container').style.display = state.showLabels ? 'block' : 'none';
    pinsGroup.visible = state.showLabels;
    showToast(state.showLabels ? '3D 空间评论标签已显示' : '3D 空间评论标签已隐藏');
  };

  document.getElementById('btn-reset-cam').onclick = () => {
    controls.reset();
    camera.position.set(-25.5, 30.5, 41.0);
    controls.target.set(-1.0, 5.8, -1.0);
    controls.update();
    showToast('视角已重置为最佳全景观赏机位');
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
    showToast(state.spatialPinMode ? '已进入 3D 空间标注模式：请点击场景建筑或平台表面放置评论' : '已退出 3D 空间标注模式');
  };

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('pointerdown', (e) => {
    if (!state.spatialPinMode) return;
    if (e.target.closest('header, .tool-controls, .mode-bar, .drawer, .modal-overlay')) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects([architectureGroup], true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const commentText = prompt('请输入要在该三维坐标点标注的展厅评论：');
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
            showToast('手机陀螺仪已启用：转动手机即可全景环视');
          } else {
            showToast('请授予陀螺仪方向传感器权限');
          }
        })
        .catch(console.error);
    } else {
      showToast('手机陀螺仪模式已就绪：转动移动设备即可全景环视');
    }
  } else if (mode === 'cardboard') {
    showToast('VR 双目立体分屏已开启：请将手机横屏放入 VR 眼镜盒观看');
  } else {
    showToast('自由漫游导览模式：鼠标或手指拖拽即可环视场景');
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

  if (btnLoginOpen) {
    btnLoginOpen.onclick = () => {
      modalAuth.style.display = 'flex';
    };
  }
  btnCloseAuth.onclick = () => {
    modalAuth.style.display = 'none';
  };

  btnAuthToggle.onclick = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? '新用户注册' : '用户登录';
    btnAuthSubmit.innerText = isRegisterMode ? '注 册' : '登 录';
    btnAuthToggle.innerText = isRegisterMode ? '已有账号？去登录' : '注册新账号';
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
        showToast(`登录成功，欢迎 ${data.user.username}`);
      } else {
        showToast(data.message || '认证失败');
      }
    } catch (e) {
      showToast('网络请求异常，请重试');
    }
  };
}

function updateUserDisplay() {
  const section = document.getElementById('user-section');
  const drawerUser = document.getElementById('comment-current-user');
  if (state.currentUser) {
    section.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:13px; color:var(--primary-gold); font-weight:500;">${state.currentUser.username}</span>
        <button class="btn" style="padding:4px 10px; font-size:11px;" id="btn-logout">退出</button>
      </div>
    `;
    drawerUser.innerText = `当前身份: ${state.currentUser.username}`;
    document.getElementById('btn-logout').onclick = () => {
      state.currentUser = null;
      localStorage.removeItem('vr_user');
      updateUserDisplay();
      showToast('已退出当前账号');
    };
  } else {
    section.innerHTML = `
      <button class="btn btn-primary" id="btn-login-open">
        <span>登录 / 注册</span>
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
      showToast('请先选择需要导入测试的美术资源文件');
      return;
    }
    const file = fileInput.files[0];
    const platformIndex = parseInt(document.getElementById('upload-platform').value || '1', 10);
    const formData = new FormData();
    formData.append('assetFile', file);
    formData.append('title', document.getElementById('upload-title').value || file.name);
    formData.append('category', document.getElementById('upload-category').value);
    formData.append('platformIndex', String(platformIndex));

    try {
      showToast('正在上传并解析美术资源...');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.exhibit) {
        modalUpload.style.display = 'none';
        if (data.exhibit.type === 'model') {
          loadImportedModel(data.exhibit.fileUrl, data.exhibit.platformIndex, true);
        } else {
          loadImportedImage(data.exhibit.fileUrl, data.exhibit.platformIndex, true);
        }
        return;
      }
    } catch (e) {
      console.warn('Backend upload fallback to local preview:', e);
    }

    // Fallback direct client-side preview
    const objectUrl = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();
    modalUpload.style.display = 'none';
    if (ext === 'glb' || ext === 'gltf') {
      loadImportedModel(objectUrl, platformIndex, true);
    } else {
      loadImportedImage(objectUrl, platformIndex, true);
    }
  };
}

function clearPedestalChildren(pedestal) {
  while (pedestal.children.length > 0) {
    pedestal.remove(pedestal.children[0]);
  }
}

function loadImportedModel(url, platformIndex, notify = true) {
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const normScale = 3.2 / maxDim;
    model.scale.setScalar(normScale);

    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);

    const pedestal = pedestals[platformIndex] || scene.getObjectByName(`pedestal_${platformIndex}`);
    if (pedestal) {
      clearPedestalChildren(pedestal);
      pedestal.add(model);
    }
    if (notify) showToast(`美术资源已成功导入第 ${platformIndex} 级平台展台`);
  });
}

function loadImportedImage(url, platformIndex, notify = true) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frameGroup = new THREE.Group();

  const geo = new THREE.PlaneGeometry(2.4, 3.2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 1.6;
  frameGroup.add(mesh);

  const pedestal = pedestals[platformIndex] || scene.getObjectByName(`pedestal_${platformIndex}`);
  if (pedestal) {
    clearPedestalChildren(pedestal);
    pedestal.add(frameGroup);
  }
  if (notify) showToast(`展示图档已成功陈列至第 ${platformIndex} 级平台展台`);
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
