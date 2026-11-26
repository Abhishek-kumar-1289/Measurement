import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// ==========================================
// 1. EXPERIMENT STATE & DUAL-FIBER PHYSICS
// ==========================================
const state = {
  activePath: 'BOTH', // 'BOTH', 'SMF', or 'MMF'
  lengthKm: 20,       // 1 to 100 km
  bendRadiusMm: 10,   // 5 to 40 mm
  bendTurns: 5,       // 0 to 20 turns
  wavelengthNm: 1550, // 850 to 1650 nm
  inputPowerDbm: 0.0,
  isRunning: true,
  pulseProgress: 0,
};

function computeDualFiberPhysics() {
  const { lengthKm, bendRadiusMm, bendTurns, wavelengthNm, inputPowerDbm } = state;
  const lambdaUm = wavelengthNm / 1000;
  const ohPeak = 0.35 * Math.exp(-Math.pow((wavelengthNm - 1383) / 22, 2));

  // --- Single-Mode Fiber (SMF-28) ---
  const smfRayleigh = (0.85 / Math.pow(lambdaUm, 4)) * 0.85;
  const smfIrEdge = 0.015 * Math.exp((wavelengthNm - 1550) / 55);
  const smfAlpha = Math.max(0.18, smfRayleigh + ohPeak + smfIrEdge);
  const smfIntrinsicLoss = smfAlpha * lengthKm;

  const smfWlFactor = Math.pow(wavelengthNm / 1310, 2.7);
  const smfBendLoss =
    bendTurns * (5.2 * smfWlFactor) * Math.exp(-(0.165 / (wavelengthNm / 1550)) * bendRadiusMm);
  const smfTotalLoss = smfIntrinsicLoss + smfBendLoss;
  const smfPout = inputPowerDbm - smfTotalLoss;

  // --- Multi-Mode Fiber (OM4 50/125 µm) ---
  const mmfRayleigh = 1.35 / Math.pow(lambdaUm, 4);
  const mmfAlpha = Math.max(0.6, mmfRayleigh + 0.35 + ohPeak * 1.3);
  const mmfIntrinsicLoss = mmfAlpha * lengthKm;

  const mmfWlFactor = Math.pow(wavelengthNm / 1100, 1.3);
  const mmfBendLoss = bendTurns * (2.2 * mmfWlFactor) * Math.exp(-0.14 * bendRadiusMm);
  const mmfTotalLoss = mmfIntrinsicLoss + mmfBendLoss;
  const mmfPout = inputPowerDbm - mmfTotalLoss;

  return {
    smf: {
      alpha: smfAlpha,
      intrinsicLoss: smfIntrinsicLoss,
      bendLoss: smfBendLoss,
      totalLoss: smfTotalLoss,
      pout: smfPout,
    },
    mmf: {
      alpha: mmfAlpha,
      intrinsicLoss: mmfIntrinsicLoss,
      bendLoss: mmfBendLoss,
      totalLoss: mmfTotalLoss,
      pout: mmfPout,
    },
  };
}

// ==========================================
// 2. THREE.JS SCENE, CAMERA & WEBXR SETUP
// ==========================================
const container = document.getElementById('canvas-wrapper');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060d16);
scene.fog = new THREE.FogExp2(0x060d16, 0.015);

const camera = new THREE.PerspectiveCamera(
  46,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0.5, 5.2, 13.8);

const cameraRig = new THREE.Group();
cameraRig.add(camera);
scene.add(cameraRig);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0.2, 1.7, 0);
controls.minDistance = 4;
controls.maxDistance = 26;
controls.maxPolarAngle = Math.PI / 2 - 0.02;

const controllerModelFactory = new XRControllerModelFactory();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -4),
  ]);
  controller.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 })));
  cameraRig.add(controller);

  const grip = renderer.xr.getControllerGrip(i);
  grip.add(controllerModelFactory.createControllerModel(grip));
  cameraRig.add(grip);
}

// ==========================================
// 3. LAB ENVIRONMENT & OPTICAL TABLE
// ==========================================
scene.add(new THREE.AmbientLight(0x93c5fd, 1.05));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(7, 15, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const cyanRim = new THREE.PointLight(0x00b4d8, 2.0, 26);
cyanRim.position.set(-7, 5, -3);
scene.add(cyanRim);

const gridHelper = new THREE.GridHelper(44, 44, 0x16324f, 0x0c1b2c);
gridHelper.position.y = -2.0;
scene.add(gridHelper);

const labGroup = new THREE.Group();
scene.add(labGroup);

const tableTop = new THREE.Mesh(
  new THREE.BoxGeometry(17.5, 0.35, 6.2),
  new THREE.MeshStandardMaterial({ color: 0x182232, roughness: 0.35, metalness: 0.75 })
);
tableTop.receiveShadow = true;
labGroup.add(tableTop);

const tableBase = new THREE.Mesh(
  new THREE.BoxGeometry(15.2, 2.0, 4.6),
  new THREE.MeshStandardMaterial({ color: 0x0b131e, roughness: 0.7, metalness: 0.3 })
);
tableBase.position.set(0, -1.15, 0);
labGroup.add(tableBase);

// ==========================================
// 4. HELPER FUNCTIONS: SCREENS & LABELS
// ==========================================
function createInstrumentScreen(header, line1, line2, bgHex = '#032b38', accentHex = '#38bdf8') {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 320, 160);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 312, 152);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(header, 16, 34);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(line1, 16, 82);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(line2, 16, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createFloatingLabel(text, subtext = '', scaleW = 2.6, scaleH = 0.75) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 148;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(9, 20, 34, 0.88)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 132, 18);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, subtext ? 62 : 84);

  if (subtext) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 22px sans-serif';
    ctx.fillText(subtext, 256, 108);
  }

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(scaleW, scaleH, 1);
  return sprite;
}

// ==========================================
// 5. ALL HARDWARE COMPONENTS
// ==========================================
const laserGroup = new THREE.Group();
laserGroup.position.set(-6.8, 0.78, 0.6);
labGroup.add(laserGroup);

const laserChassis = new THREE.Mesh(
  new THREE.BoxGeometry(2.0, 1.2, 1.7),
  new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35, metalness: 0.45 })
);
laserGroup.add(laserChassis);

const laserScreenMat = new THREE.MeshBasicMaterial({
  map: createInstrumentScreen('STABILIZED LASER', '1550 nm', 'Pin: 0.00 dBm'),
});
const laserScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), laserScreenMat);
laserScreen.position.set(0, 0.1, 0.86);
laserGroup.add(laserScreen);

const laserLabel = createFloatingLabel('Stabilized Laser Source', '1310nm / 1550nm / 850nm', 2.4, 0.7);
laserLabel.position.set(-6.8, 2.05, 0.6);
labGroup.add(laserLabel);

// 1x2 Optical Splitter
const splitterGroup = new THREE.Group();
splitterGroup.position.set(-5.1, 0.55, 0.4);
labGroup.add(splitterGroup);

splitterGroup.add(
  new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.75, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 })
  )
);

const splitterLabel = createFloatingLabel('1x2 Optical Splitter', 'SMF / MMF Launch', 2.0, 0.6);
splitterLabel.position.set(-5.1, 1.45, 0.4);
labGroup.add(splitterLabel);

// Dual-Tier Aluminum Rails
const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

const upperRail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 0.7), railMat);
upperRail.position.set(-0.6, 1.65, -0.45);
labGroup.add(upperRail);

[-3.8, 2.6].forEach((px) => {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.5, 16), postMat);
  post.position.set(px, 0.9, -0.45);
  labGroup.add(post);
});

const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 0.7), railMat);
lowerRail.position.set(-0.6, 0.32, 0.85);
labGroup.add(lowerRail);

// SMF-28 Spool & Mandrel Rig
const smfSpoolGroup = new THREE.Group();
smfSpoolGroup.position.set(-2.5, 1.74, -0.45);
labGroup.add(smfSpoolGroup);

const smfCore = new THREE.Mesh(
  new THREE.CylinderGeometry(0.68, 0.68, 0.95, 32),
  new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
);
smfCore.position.y = 0.52;
smfSpoolGroup.add(smfCore);

const flangeGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.07, 32);
const flangeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
const smfBotFlange = new THREE.Mesh(flangeGeo, flangeMat);
smfBotFlange.position.y = 0.04;
smfSpoolGroup.add(smfBotFlange);
const smfTopFlange = new THREE.Mesh(flangeGeo, flangeMat);
smfTopFlange.position.y = 1.02;
smfSpoolGroup.add(smfTopFlange);

const smfPathLabel = createFloatingLabel('SINGLE-MODE FIBER PATH', 'SMF-28 (9/125 µm)', 2.5, 0.68);
smfPathLabel.position.set(-2.5, 3.35, -0.45);
labGroup.add(smfPathLabel);

const smfRigGroup = new THREE.Group();
smfRigGroup.position.set(0.8, 1.74, -0.45);
labGroup.add(smfRigGroup);

const rigBaseMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2.1, 0.14, 0.65),
  new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
);
rigBaseMesh.position.y = 0.07;
smfRigGroup.add(rigBaseMesh);

[-0.85, 0.85].forEach((cx) => {
  const chuck = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.45, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.25 })
  );
  chuck.position.set(cx, 0.34, 0);
  smfRigGroup.add(chuck);
});

const smfMandrelMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 0.35, 0.75, 32),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.75, roughness: 0.2 })
);
smfMandrelMesh.position.y = 0.48;
smfRigGroup.add(smfMandrelMesh);

const smfCoilsGroup = new THREE.Group();
smfCoilsGroup.position.y = 0.22;
smfRigGroup.add(smfCoilsGroup);

const smfRigLabel = createFloatingLabel('SMF Mandrel Bending Rig', 'Calibrated Radius (10 mm)', 2.4, 0.65);
smfRigLabel.position.set(0.8, 3.15, -0.45);
labGroup.add(smfRigLabel);

// MMF Orange Spool & Mandrel Rig
const mmfSpoolGroup = new THREE.Group();
mmfSpoolGroup.position.set(-2.5, 0.41, 0.85);
labGroup.add(mmfSpoolGroup);

const mmfCore = new THREE.Mesh(
  new THREE.CylinderGeometry(0.68, 0.68, 0.95, 32),
  new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
);
mmfCore.position.y = 0.52;
mmfSpoolGroup.add(mmfCore);

const mmfBotFlange = new THREE.Mesh(flangeGeo, flangeMat);
mmfBotFlange.position.y = 0.04;
mmfSpoolGroup.add(mmfBotFlange);
const mmfTopFlange = new THREE.Mesh(flangeGeo, flangeMat);
mmfTopFlange.position.y = 1.02;
mmfSpoolGroup.add(mmfTopFlange);

const mmfPathLabel = createFloatingLabel('MULTI-MODE FIBER PATH', 'OM4 MMF (50/125 µm)', 2.5, 0.68);
mmfPathLabel.position.set(-2.5, 1.95, 1.35);
labGroup.add(mmfPathLabel);

const mmfRigGroup = new THREE.Group();
mmfRigGroup.position.set(0.8, 0.41, 0.85);
labGroup.add(mmfRigGroup);

mmfRigGroup.add(rigBaseMesh.clone());

[-0.85, 0.85].forEach((cx) => {
  const chuck = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.45, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.25 })
  );
  chuck.position.set(cx, 0.34, 0);
  mmfRigGroup.add(chuck);
});

const mmfMandrelMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 0.35, 0.75, 32),
  new THREE.MeshStandardMaterial({ color: 0xfb923c, metalness: 0.75, roughness: 0.2 })
);
mmfMandrelMesh.position.y = 0.48;
mmfRigGroup.add(mmfMandrelMesh);

const mmfCoilsGroup = new THREE.Group();
mmfCoilsGroup.position.y = 0.22;
mmfRigGroup.add(mmfCoilsGroup);

const mmfRigLabel = createFloatingLabel('MMF Mandrel Bending Rig', 'Calibrated Radius (10 mm)', 2.4, 0.65);
mmfRigLabel.position.set(0.8, 1.75, 1.35);
labGroup.add(mmfRigLabel);

// Dual-Channel Optical Power Meter
const powerMeterGroup = new THREE.Group();
powerMeterGroup.position.set(4.2, 0.82, -0.35);
labGroup.add(powerMeterGroup);

powerMeterGroup.add(
  new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 1.28, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35, metalness: 0.4 })
  )
);

const pmScreenMat = new THREE.MeshBasicMaterial({
  map: createInstrumentScreen('OPTICAL POWER METER', 'CH1 SMF: -11.46 dBm', 'CH2 MMF: -16.34 dBm', '#042f2e', '#2dd4bf'),
});
const pmScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), pmScreenMat);
pmScreen.position.set(0, 0.1, 0.91);
powerMeterGroup.add(pmScreen);

const pmLabel = createFloatingLabel('Optical Power Meter', 'CH1: SMF Pout | CH2: MMF Pout', 2.4, 0.68);
pmLabel.position.set(4.2, 2.15, -0.35);
labGroup.add(pmLabel);

// Optical Spectrum Analyzer (OSA)
const osaGroup = new THREE.Group();
osaGroup.position.set(6.8, 0.95, 0.45);
osaGroup.rotation.y = -0.22;
labGroup.add(osaGroup);

osaGroup.add(
  new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.55, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.35 })
  )
);

const osaCanvas = document.createElement('canvas');
osaCanvas.width = 420;
osaCanvas.height = 260;
const osaCtx = osaCanvas.getContext('2d');
const osaTex = new THREE.CanvasTexture(osaCanvas);

const osaScreen = new THREE.Mesh(
  new THREE.PlaneGeometry(1.95, 1.18),
  new THREE.MeshBasicMaterial({ map: osaTex })
);
osaScreen.position.set(0, 0.08, 0.81);
osaGroup.add(osaScreen);

const osaLabel = createFloatingLabel('ATTENUATION & BENDING ANALYZER', 'Spectral Trace (dB/km vs λ)', 2.6, 0.7);
osaLabel.position.set(6.8, 2.45, 0.45);
labGroup.add(osaLabel);

// ==========================================
// 6. OPTICAL FIBER PATCH CORDS & DUAL PULSES
// ==========================================
let smfCurve, mmfCurve;
let smfTubeMesh, mmfTubeMesh;

function rebuildFiberPaths() {
  if (smfTubeMesh) labGroup.remove(smfTubeMesh);
  if (mmfTubeMesh) labGroup.remove(mmfTubeMesh);

  while (smfCoilsGroup.children.length > 0) smfCoilsGroup.remove(smfCoilsGroup.children[0]);
  while (mmfCoilsGroup.children.length > 0) mmfCoilsGroup.remove(mmfCoilsGroup.children[0]);

  const visualRadius = 0.2 + ((state.bendRadiusMm - 5) / 35) * 0.42;
  smfMandrelMesh.scale.set(visualRadius / 0.35, 1, visualRadius / 0.35);
  mmfMandrelMesh.scale.set(visualRadius / 0.35, 1, visualRadius / 0.35);

  const visibleRings = Math.min(state.bendTurns, 14);
  const smfRingMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.3 });
  const mmfRingMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.3 });

  for (let i = 0; i < visibleRings; i++) {
    const rGeo = new THREE.TorusGeometry(visualRadius + 0.02, 0.018, 8, 32);
    const sRing = new THREE.Mesh(rGeo, smfRingMat);
    sRing.rotation.x = Math.PI / 2;
    sRing.position.y = 0.06 + i * 0.042;
    smfCoilsGroup.add(sRing);

    const mRing = new THREE.Mesh(rGeo, mmfRingMat);
    mRing.rotation.x = Math.PI / 2;
    mRing.position.y = 0.06 + i * 0.042;
    mmfCoilsGroup.add(mRing);
  }

  smfCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.8, 0.65, 0.6),
    new THREE.Vector3(-5.1, 0.75, 0.4),
    new THREE.Vector3(-3.8, 1.85, -0.45),
    new THREE.Vector3(-2.5, 1.95, 0.25),
    new THREE.Vector3(-1.2, 1.85, -0.45),
    new THREE.Vector3(0.8 - visualRadius, 2.15, -0.45 + visualRadius),
    new THREE.Vector3(0.8 + visualRadius, 2.15, -0.45 - visualRadius),
    new THREE.Vector3(2.6, 1.85, -0.45),
    new THREE.Vector3(3.3, 1.05, -0.35),
  ]);

  mmfCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.8, 0.65, 0.6),
    new THREE.Vector3(-5.1, 0.45, 0.4),
    new THREE.Vector3(-3.8, 0.55, 0.85),
    new THREE.Vector3(-2.5, 0.65, 1.55),
    new THREE.Vector3(-1.2, 0.55, 0.85),
    new THREE.Vector3(0.8 - visualRadius, 0.82, 0.85 + visualRadius),
    new THREE.Vector3(0.8 + visualRadius, 0.82, 0.85 - visualRadius),
    new THREE.Vector3(2.6, 0.55, 0.85),
    new THREE.Vector3(3.4, 0.65, 0.25),
  ]);

  smfTubeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(smfCurve, 120, 0.025, 10, false),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
  );
  labGroup.add(smfTubeMesh);

  mmfTubeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(mmfCurve, 120, 0.042, 10, false),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 })
  );
  labGroup.add(mmfTubeMesh);
}

const smfPulse = new THREE.Mesh(
  new THREE.SphereGeometry(0.095, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
smfPulse.add(new THREE.PointLight(0x38bdf8, 2.2, 3.0));
labGroup.add(smfPulse);

const mmfPulse = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfb923c })
);
mmfPulse.add(new THREE.PointLight(0xfb923c, 2.2, 3.0));
labGroup.add(mmfPulse);

const smfBendGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
);
smfBendGlow.position.set(0.8, 2.2, -0.45);
labGroup.add(smfBendGlow);

const mmfBendGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
);
mmfBendGlow.position.set(0.8, 0.88, 0.85);
labGroup.add(mmfBendGlow);

// ==========================================
// 7. THREE WALL DISPLAY BOARDS + OSA SCREEN
// ==========================================
function createWallBoard(xPos, title) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 310;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 2.7, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
  );
  frame.position.set(xPos, 4.7, -3.8);
  scene.add(frame);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.15, 2.45),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  screen.position.set(xPos, 4.7, -3.73);
  scene.add(screen);

  return { ctx, tex, title };
}

const wallBoard1 = createWallBoard(-5.3, 'Spectral Attenuation α(λ)');
const wallBoard2 = createWallBoard(0.0, 'Macro-Bending Loss vs Bend Radius');
const wallBoard3 = createWallBoard(5.3, 'SMF vs MMF Total Loss Comparison');

function drawHeader(ctx, title) {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 310);
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, '#0284c7');
  g.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 27);
  ctx.textAlign = 'left';
}

function updateCharts(physics) {
  // Board 1
  {
    const { ctx, tex, title } = wallBoard1;
    drawHeader(ctx, title);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(55, 65);
    ctx.lineTo(55, 265);
    ctx.lineTo(475, 265);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.fillText('Loss (dB/km)', 12, 58);
    ctx.fillText('850 nm', 45, 286);
    ctx.fillText('1310 nm', 240, 286);
    ctx.fillText('1550 nm', 425, 286);

    const plotCurve = (isSmf, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let wl = 850; wl <= 1650; wl += 10) {
        const lUm = wl / 1000;
        const oh = 0.35 * Math.exp(-Math.pow((wl - 1383) / 22, 2));
        const a = isSmf
          ? Math.max(0.18, (0.85 / Math.pow(lUm, 4)) * 0.85 + oh)
          : Math.max(0.6, 1.35 / Math.pow(lUm, 4) + 0.35 + oh * 1.3);
        const x = 55 + ((wl - 850) / 800) * 420;
        const y = 265 - Math.min(a / 3.5, 1) * 190;
        wl === 850 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    plotCurve(true, '#0284c7');
    plotCurve(false, '#f97316');

    const cx = 55 + ((state.wavelengthNm - 850) / 800) * 420;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 65);
    ctx.lineTo(cx, 265);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0284c7';
    ctx.fillText('■ Single-Mode (SMF)', 300, 72);
    ctx.fillStyle = '#f97316';
    ctx.fillText('■ Multi-Mode (MMF)', 300, 92);
    tex.needsUpdate = true;
  }

  // Board 2
  {
    const { ctx, tex, title } = wallBoard2;
    drawHeader(ctx, title);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(55, 65);
    ctx.lineTo(55, 265);
    ctx.lineTo(475, 265);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.fillText('Bend Loss (dB)', 12, 58);
    ctx.fillText('5 mm', 45, 286);
    ctx.fillText('20 mm', 235, 286);
    ctx.fillText('40 mm', 435, 286);

    const drawBendCurve = (isSmf, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let r = 5; r <= 40; r += 1) {
        const loss = isSmf
          ? state.bendTurns * (5.2 * Math.pow(state.wavelengthNm / 1310, 2.7)) * Math.exp(-(0.165 / (state.wavelengthNm / 1550)) * r)
          : state.bendTurns * (2.2 * Math.pow(state.wavelengthNm / 1100, 1.3)) * Math.exp(-0.14 * r);
        const x = 55 + ((r - 5) / 35) * 420;
        const y = 265 - Math.min(loss / 14, 1) * 190;
        r === 5 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawBendCurve(true, '#0284c7');
    drawBendCurve(false, '#f97316');

    const rx = 55 + ((state.bendRadiusMm - 5) / 35) * 420;
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rx, 65);
    ctx.lineTo(rx, 265);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`R = ${state.bendRadiusMm} mm | Turns = ${state.bendTurns}`, 240, 74);
    tex.needsUpdate = true;
  }

  // Board 3
  {
    const { ctx, tex, title } = wallBoard3;
    drawHeader(ctx, title);
    const maxVal = Math.max(20, physics.smf.totalLoss, physics.mmf.totalLoss);

    const drawBar = (y, label, atten, bend) => {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13.5px sans-serif';
      ctx.fillText(label, 32, y - 8);
      const w1 = Math.min((atten / maxVal) * 320, 320);
      const w2 = Math.min((bend / maxVal) * 320, 320 - w1);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(32, y, w1, 34);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(32 + w1, y, w2, 34);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${(atten + bend).toFixed(2)} dB`, 362, y + 22);
    };

    drawBar(105, `SMF-28 (Atten: ${physics.smf.intrinsicLoss.toFixed(1)} dB | Bend: ${physics.smf.bendLoss.toFixed(1)} dB)`, physics.smf.intrinsicLoss, physics.smf.bendLoss);
    drawBar(195, `OM4 MMF (Atten: ${physics.mmf.intrinsicLoss.toFixed(1)} dB | Bend: ${physics.mmf.bendLoss.toFixed(1)} dB)`, physics.mmf.intrinsicLoss, physics.mmf.bendLoss);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(32, 260, 14, 14);
    ctx.fillStyle = '#334155';
    ctx.font = '12.5px sans-serif';
    ctx.fillText('Intrinsic Attenuation', 52, 272);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(210, 260, 14, 14);
    ctx.fillText('Macro-Bending Loss', 230, 272);
    tex.needsUpdate = true;
  }

  // Benchtop OSA Screen
  {
    osaCtx.fillStyle = '#04121d';
    osaCtx.fillRect(0, 0, 420, 260);
    osaCtx.strokeStyle = '#1e3a5f';
    osaCtx.lineWidth = 1;
    for (let gx = 30; gx < 400; gx += 35) {
      osaCtx.beginPath();
      osaCtx.moveTo(gx, 32);
      osaCtx.lineTo(gx, 225);
      osaCtx.stroke();
    }
    for (let gy = 32; gy < 225; gy += 32) {
      osaCtx.beginPath();
      osaCtx.moveTo(30, gy);
      osaCtx.lineTo(395, gy);
      osaCtx.stroke();
    }

    osaCtx.fillStyle = '#38bdf8';
    osaCtx.font = 'bold 14px monospace';
    osaCtx.fillText(`OSA TRACE | λ=${state.wavelengthNm}nm | R=${state.bendRadiusMm}mm`, 26, 22);

    const drawTrace = (isSmf, color) => {
      osaCtx.strokeStyle = color;
      osaCtx.lineWidth = 2.5;
      osaCtx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const wl = 850 + i * 8;
        const lUm = wl / 1000;
        const loss = isSmf
          ? (0.85 / Math.pow(lUm, 4)) * 0.85 * state.lengthKm * 0.25 + physics.smf.bendLoss
          : (1.35 / Math.pow(lUm, 4) + 0.35) * state.lengthKm * 0.25 + physics.mmf.bendLoss;
        const x = 30 + (i / 100) * 365;
        const y = 45 + Math.min(loss / 25, 1) * 175;
        i === 0 ? osaCtx.moveTo(x, y) : osaCtx.lineTo(x, y);
      }
      osaCtx.stroke();
    };
    drawTrace(true, '#facc15');
    drawTrace(false, '#f472b6');

    osaCtx.fillStyle = '#facc15';
    osaCtx.font = 'bold 12px monospace';
    osaCtx.fillText(`CH1 SMF: ${physics.smf.pout.toFixed(2)} dBm`, 30, 246);
    osaCtx.fillStyle = '#f472b6';
    osaCtx.fillText(`CH2 MMF: ${physics.mmf.pout.toFixed(2)} dBm`, 225, 246);
    osaTex.needsUpdate = true;
  }
}

// ==========================================
// 8. UI SYNC, CALCULATION REPORT & WEBXR
// ==========================================
function updateLab() {
  const physics = computeDualFiberPhysics();

  document.getElementById('fiber-length-val').textContent = `${state.lengthKm} km`;
  document.getElementById('bend-radius-val').textContent = `${state.bendRadiusMm} mm`;
  document.getElementById('bend-turns-val').textContent = `${state.bendTurns} turns`;
  document.getElementById('wavelength-val').textContent = `${state.wavelengthNm} nm`;

  document.getElementById('res-smf-alpha').textContent = `${physics.smf.alpha.toFixed(2)} dB/km`;
  document.getElementById('res-smf-bend').textContent = `${physics.smf.bendLoss.toFixed(2)} dB`;
  document.getElementById('res-smf-pout').textContent = `${physics.smf.pout.toFixed(2)} dBm`;

  document.getElementById('res-mmf-alpha').textContent = `${physics.mmf.alpha.toFixed(2)} dB/km`;
  document.getElementById('res-mmf-bend').textContent = `${physics.mmf.bendLoss.toFixed(2)} dB`;
  document.getElementById('res-mmf-pout').textContent = `${physics.mmf.pout.toFixed(2)} dBm`;

  laserScreenMat.map = createInstrumentScreen(
    'STABILIZED LASER',
    `${state.wavelengthNm} nm`,
    `Pin: ${state.inputPowerDbm.toFixed(2)} dBm`
  );
  pmScreenMat.map = createInstrumentScreen(
    'OPTICAL POWER METER',
    `CH1 SMF: ${physics.smf.pout.toFixed(2)} dBm`,
    `CH2 MMF: ${physics.mmf.pout.toFixed(2)} dBm`,
    '#042f2e',
    '#2dd4bf'
  );

  smfBendGlow.material.opacity = Math.min(physics.smf.bendLoss / 10, 0.55);
  mmfBendGlow.material.opacity = Math.min(physics.mmf.bendLoss / 10, 0.55);

  const showSmf = state.activePath === 'BOTH' || state.activePath === 'SMF';
  const showMmf = state.activePath === 'BOTH' || state.activePath === 'MMF';
  smfPulse.visible = showSmf;
  mmfPulse.visible = showMmf;

  rebuildFiberPaths();
  updateCharts(physics);
}

// Show Step-by-Step Calculation Report Modal when Calculate Results is clicked
function openCalculationReport() {
  updateLab();
  const p = computeDualFiberPhysics();

  // Flash the sidebar results card
  const card = document.getElementById('results-card');
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');

  const betterPath = p.smf.totalLoss < p.mmf.totalLoss ? 'Single-Mode Fiber (SMF-28)' : 'Multi-Mode Fiber (OM4 MMF)';
  const diffDb = Math.abs(p.smf.totalLoss - p.mmf.totalLoss).toFixed(2);

  document.getElementById('calc-report-body').innerHTML = `
    <p><strong>Input Parameters:</strong> P<sub>in</sub> = 0.00 dBm | Length L = ${state.lengthKm} km | Bend Radius R = ${state.bendRadiusMm} mm | Turns N = ${state.bendTurns} | Wavelength λ = ${state.wavelengthNm} nm</p>

    <table class="calc-table">
      <thead>
        <tr>
          <th>Measurement Parameter</th>
          <th>Single-Mode (SMF-28)</th>
          <th>Multi-Mode (OM4 MMF)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Attenuation Coeff (α)</td>
          <td>${p.smf.alpha.toFixed(3)} dB/km</td>
          <td>${p.mmf.alpha.toFixed(3)} dB/km</td>
        </tr>
        <tr>
          <td>Intrinsic Fiber Loss (α × L)</td>
          <td>${p.smf.intrinsicLoss.toFixed(2)} dB</td>
          <td>${p.mmf.intrinsicLoss.toFixed(2)} dB</td>
        </tr>
        <tr>
          <td>Macro-Bending Loss (L<sub>bend</sub>)</td>
          <td>${p.smf.bendLoss.toFixed(2)} dB</td>
          <td>${p.mmf.bendLoss.toFixed(2)} dB</td>
        </tr>
        <tr>
          <td><strong>Total Optical Loss (L<sub>total</sub>)</strong></td>
          <td><strong>${p.smf.totalLoss.toFixed(2)} dB</strong></td>
          <td><strong>${p.mmf.totalLoss.toFixed(2)} dB</strong></td>
        </tr>
        <tr>
          <td><strong>Output Power (P<sub>out</sub> = P<sub>in</sub> − L<sub>total</sub>)</strong></td>
          <td style="color:#2dd4bf;"><strong>${p.smf.pout.toFixed(2)} dBm</strong></td>
          <td style="color:#fb923c;"><strong>${p.mmf.pout.toFixed(2)} dBm</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="calc-box">
      <h4>Comparative Lab Observation</h4>
      <p>At <strong>${state.wavelengthNm} nm</strong> over <strong>${state.lengthKm} km</strong> with a <strong>${state.bendRadiusMm} mm</strong> mandrel bend (${state.bendTurns} turns), <strong>${betterPath}</strong> exhibits <strong>${diffDb} dB</strong> lower total attenuation. Notice that SMF has lower intrinsic propagation loss (α), whereas MMF's larger 50 µm core resists macro-bending radiation leakage more effectively under tight bends.</p>
    </div>
  `;

  document.getElementById('calc-modal').classList.remove('hidden');
  showToast(`Calculation complete — SMF Pout: ${p.smf.pout.toFixed(2)} dBm | MMF Pout: ${p.mmf.pout.toFixed(2)} dBm`);
}

document.getElementById('btn-calculate').addEventListener('click', openCalculationReport);
document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('calc-modal').classList.add('hidden');
});

// Mode Toggles
const modeBtns = {
  BOTH: document.getElementById('btn-both'),
  SMF: document.getElementById('btn-smf'),
  MMF: document.getElementById('btn-mmf'),
};

Object.entries(modeBtns).forEach(([mode, btn]) => {
  btn.addEventListener('click', () => {
    state.activePath = mode;
    Object.values(modeBtns).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fiber-type-val').textContent =
      mode === 'BOTH' ? 'Both (SMF & MMF)' : mode === 'SMF' ? 'Single-Mode (SMF-28)' : 'Multi-Mode (OM4)';
    showToast(`Active Path: ${document.getElementById('fiber-type-val').textContent}`);
    updateLab();
  });
});

// Sliders
document.getElementById('fiber-length').addEventListener('input', (e) => {
  state.lengthKm = Number(e.target.value);
  updateLab();
});
document.getElementById('bend-radius').addEventListener('input', (e) => {
  state.bendRadiusMm = Number(e.target.value);
  updateLab();
});
document.getElementById('bend-turns').addEventListener('input', (e) => {
  state.bendTurns = Number(e.target.value);
  updateLab();
});
document.getElementById('wavelength').addEventListener('input', (e) => {
  state.wavelengthNm = Number(e.target.value);
  updateLab();
});

// Simulation & Camera Buttons
const btnTogglePulse = document.getElementById('btn-toggle-pulse');
btnTogglePulse.addEventListener('click', () => {
  state.isRunning = !state.isRunning;
  btnTogglePulse.textContent = state.isRunning ? 'Pause Pulse' : 'Resume Pulse';
  showToast(state.isRunning ? 'Optical pulses running' : 'Optical pulses paused');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.activePath = 'BOTH';
  state.lengthKm = 20;
  state.bendRadiusMm = 10;
  state.bendTurns = 5;
  state.wavelengthNm = 1550;
  state.isRunning = true;

  Object.values(modeBtns).forEach((b) => b.classList.remove('active'));
  modeBtns.BOTH.classList.add('active');
  document.getElementById('fiber-length').value = 20;
  document.getElementById('bend-radius').value = 10;
  document.getElementById('bend-turns').value = 5;
  document.getElementById('wavelength').value = 1550;
  btnTogglePulse.textContent = 'Pause Pulse';

  camera.position.set(0.5, 5.2, 13.8);
  controls.target.set(0.2, 1.7, 0);
  showToast('Lab reset to calibrated 10 mm mandrel defaults');
  updateLab();
});

document.getElementById('btn-zoom-in').addEventListener('click', () => camera.position.lerp(controls.target, 0.18));
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const dir = camera.position.clone().sub(controls.target);
  camera.position.addScaledVector(dir, 0.22);
});
document.getElementById('btn-rot-left').addEventListener('click', () => {
  const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.25);
  camera.position.copy(controls.target).add(off);
});
document.getElementById('btn-rot-right').addEventListener('click', () => {
  const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.25);
  camera.position.copy(controls.target).add(off);
});

// WebXR Session Handler
let currentXRSession = null;
const btnWebXR = document.getElementById('btn-webxr');

async function toggleWebXR() {
  if (currentXRSession) {
    await currentXRSession.end();
    return;
  }

  if (!('xr' in navigator)) {
    showToast('WebXR API unavailable — run on localhost/HTTPS with WebXR extension');
    return;
  }

  try {
    const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!isVRSupported) {
      showToast('No VR device/emulator active — open DevTools (F12) → WebXR tab');
      return;
    }

    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    currentXRSession = session;
    cameraRig.position.set(0, 0.2, 6.2);

    session.addEventListener('end', () => {
      currentXRSession = null;
      cameraRig.position.set(0, 0, 0);
      btnWebXR.textContent = 'Enter WebXR VR';
      showToast('Exited WebXR VR Mode');
    });

    await renderer.xr.setSession(session);
    btnWebXR.textContent = 'Exit WebXR VR';
    showToast('WebXR VR Mode Active');
  } catch (err) {
    showToast(`WebXR Error: ${err.message}`);
  }
}

btnWebXR.addEventListener('click', toggleWebXR);

function showToast(msg) {
  document.getElementById('status-text').textContent = msg;
}

// ==========================================
// 9. ANIMATION LOOP
// ==========================================
window.addEventListener('resize', () => {
  if (!renderer.xr.isPresenting) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
});

updateLab();

renderer.setAnimationLoop(() => {
  if (state.isRunning && smfCurve && mmfCurve) {
    state.pulseProgress += 0.0055;
    if (state.pulseProgress > 1) state.pulseProgress = 0;

    const physics = computeDualFiberPhysics();

    const smfPt = smfCurve.getPointAt(state.pulseProgress);
    smfPulse.position.copy(smfPt);
    const smfTrans = Math.max(0.2, Math.pow(10, -physics.smf.totalLoss / 25));
    smfPulse.scale.setScalar(1 - state.pulseProgress * (1 - smfTrans));

    const mmfPt = mmfCurve.getPointAt(state.pulseProgress);
    mmfPulse.position.copy(mmfPt);
    const mmfTrans = Math.max(0.2, Math.pow(10, -physics.mmf.totalLoss / 25));
    mmfPulse.scale.setScalar(1 - state.pulseProgress * (1 - mmfTrans));
  }

  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  renderer.render(scene, camera);
});