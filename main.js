import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computePanelCells,
  polygonCentroidAndSpan,
  buildPieceGeometries,
} from './js/geometry.js';
import {
  computeTypographySpec,
  drawPanelCanvas,
  drawNavCanvas,
  drawSliverCanvas,
  syncDomLayerLayout,
} from './js/canvasPrint.js';
import { computeBlockHomographyCSS } from './js/homography.js';
import { createSheetController } from './js/uiSheet.js';

const DEG = Math.PI / 180;
const STAGGER_SEC = 0.03;
const FLIGHT_DURATION = 0.72;

// Reusable math objects (zero per-frame GC allocations)
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _planeNormal = new THREE.Vector3();
const _planeHit = new THREE.Vector3();
const _localHit = new THREE.Vector3();
const _eulerHover = new THREE.Euler(0, 0, 0, 'YXZ');
const _quatHover = new THREE.Quaternion();
const _quatTumble = new THREE.Quaternion();

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeInCubic(t) {
  return t * t * t;
}

function easeOutCubic(t) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function easeOutBack(t) {
  const c1 = 1.18;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

function detectSoftwareGl() {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return { noWebgl: true, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSw = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { noWebgl: false, isSoftwareGl: isSw };
  } catch {
    return { noWebgl: true, isSoftwareGl: true };
  }
}

// Grab DOM elements
const mountEl = document.getElementById('webgl-mount');
const domStageEl = document.getElementById('dom-stage');
const domEls = {
  blockLayer: document.getElementById('dom-block-layer'),
  nav: document.getElementById('dom-nav'),
  panel: document.getElementById('dom-panel'),
  hitBrand: document.getElementById('hit-brand'),
  hitProjects: document.querySelector('[data-nav="projects"]'),
  hitExperience: document.querySelector('[data-nav="experience"]'),
  hitSkills: document.querySelector('[data-nav="skills"]'),
  hitContact: document.getElementById('hit-signin'),
  eyebrow: document.getElementById('dom-eyebrow'),
  h1: document.getElementById('dom-h1'),
  h1Line1: document.getElementById('dom-h1-line1'),
  h1Line2: document.getElementById('dom-h1-line2'),
  sub: document.getElementById('dom-sub'),
  subLine1: document.getElementById('dom-sub-line1'),
  subLine2: document.getElementById('dom-sub-line2'),
  hitOpenStudio: document.getElementById('hit-open-studio'),
  hitReadPaper: document.getElementById('hit-read-paper'),
  copy: document.getElementById('dom-copy'),
  spec: document.getElementById('dom-spec'),
};
const definitionsEl = document.getElementById('definitions-view');
const backHitBtn = document.getElementById('back-hit-btn');
const staticFallbackEl = document.getElementById('static-fallback');
const studioSheetEl = document.getElementById('studio-sheet');
const studioSheetInnerEl = document.getElementById('studio-sheet-inner');
const cvModalEl = document.getElementById('cv-modal');
const cvModalCloseBtn = document.getElementById('cv-modal-close');
const btnPreviewCv = document.getElementById('btn-preview-cv');

function openCvModal() {
  if (cvModalEl) cvModalEl.hidden = false;
}

function closeCvModal() {
  if (cvModalEl) cvModalEl.hidden = true;
}

cvModalCloseBtn?.addEventListener('click', closeCvModal);
cvModalEl?.addEventListener('click', (e) => {
  if (e.target === cvModalEl) closeCvModal();
});
btnPreviewCv?.addEventListener('click', openCvModal);

function setDossierTab(tabName) {
  const normalized = tabName || 'all';
  document.querySelectorAll('[data-dossier-tab]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-dossier-tab') === normalized;
    btn.classList.toggle('is-active', isMatch);
    btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
  });

  document.querySelectorAll('.dossier-group').forEach((group) => {
    const sec = group.getAttribute('data-section');
    group.hidden = normalized !== 'all' && sec !== normalized;
  });
}

document.querySelectorAll('[data-dossier-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setDossierTab(btn.getAttribute('data-dossier-tab') || 'all');
  });
});

const materialParams = {
  presetId: 'smoked',
  color: 0x17171b,
  roughness: 0.36,
  clearcoat: 0.7,
  iridescence: 0.55,
  env: 0.42,
};

let applyMaterialParamsFn = () => {};
let shatterToSectionFn = (tab) => {
  setDossierTab(tab || 'all');
};

const sheetCtrl = createSheetController(
  studioSheetEl,
  studioSheetInnerEl,
  materialParams,
  () => applyMaterialParamsFn(),
  {
    onOpenCvModal: openCvModal,
    onShatterToSection: (tab) => shatterToSectionFn(tab),
  }
);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const { noWebgl, isSoftwareGl } = detectSoftwareGl();

function activateStaticFallback() {
  document.body.classList.add('is-static-mode');
  domStageEl.style.display = 'none';
  mountEl.style.display = 'none';
  staticFallbackEl.hidden = false;

  const openStaticDossier = (tab) => {
    sheetCtrl.close();
    setDossierTab(tab || 'all');
    staticFallbackEl.hidden = true;
    definitionsEl.style.opacity = '1';
    definitionsEl.classList.add('is-interactive');
    definitionsEl.setAttribute('aria-hidden', 'false');
    backHitBtn.disabled = false;
  };

  shatterToSectionFn = openStaticDossier;

  const staticReadBtn = document.getElementById('static-read-paper');
  staticReadBtn?.addEventListener('click', () => openStaticDossier('all'));

  backHitBtn.addEventListener('click', () => {
    definitionsEl.style.opacity = '0';
    definitionsEl.classList.remove('is-interactive');
    definitionsEl.setAttribute('aria-hidden', 'true');
    backHitBtn.disabled = true;
    staticFallbackEl.hidden = false;
  });

  document.querySelectorAll('[data-static-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-static-action');
      if (action === 'projects') openStaticDossier('projects');
      else if (action) sheetCtrl.open(action);
    });
  });
}

if (prefersReducedMotion || noWebgl) {
  activateStaticFallback();
} else {
  initWebGLApp();
}

function initWebGLApp() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch {
    activateStaticFallback();
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x050507, 1);
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  mountEl.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
    activateStaticFallback();
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);

  // Studio PMREM RoomEnvironment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = materialParams.env;

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 12000);

  // Soft white-blue key light from the top-left + subtle studio hemisphere fill
  const keyLight = new THREE.DirectionalLight(0xdce8ff, 2.2);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa8c2ff, 0.65);
  scene.add(rimLight);

  const hemiLight = new THREE.HemisphereLight(0xd6e4ff, 0x07070b, 0.34);
  scene.add(hemiLight);

  // Master tilted block group
  const slabGroup = new THREE.Group();
  slabGroup.rotation.order = 'YXZ';
  scene.add(slabGroup);

  // Shared shader uniforms for cursor lavender glow
  const glowUniforms = {
    uCursorWorld: { value: new THREE.Vector3(0, 0, 0) },
    uGlowRadius: { value: 240 },
    uGlowAlpha: { value: 0 },
  };

  function createShardGlassMaterial(withCursorGlow, baseIridescence) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(materialParams.color),
      roughness: materialParams.roughness,
      metalness: 0.0,
      clearcoat: materialParams.clearcoat,
      clearcoatRoughness: 0.12,
      specularIntensity: 0.7,
      iridescence: baseIridescence,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [250, 650],
      envMapIntensity: 1.0,
    });

    if (withCursorGlow) {
      mat.customProgramCacheKey = () => 'facet-smoked-glass-glow-v1';
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCursorWorld = glowUniforms.uCursorWorld;
        shader.uniforms.uGlowRadius = glowUniforms.uGlowRadius;
        shader.uniforms.uGlowAlpha = glowUniforms.uGlowAlpha;

        shader.vertexShader =
          'varying vec3 vFacetWorldPos;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vFacetWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
          );

        shader.fragmentShader =
          `uniform vec3 uCursorWorld;
          uniform float uGlowRadius;
          uniform float uGlowAlpha;
          varying vec3 vFacetWorldPos;\n` +
          shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            float facetD = distance(vFacetWorldPos, uCursorWorld) / max(uGlowRadius, 1.0);
            totalEmissiveRadiance += vec3(0.42, 0.37, 0.62) * (0.16 * uGlowAlpha * exp(-1.6 * facetD * facetD));`
          );
      };
    }

    return mat;
  }

  // Printed Canvas2D textures
  const panelCanvas = document.createElement('canvas');
  const navCanvas = document.createElement('canvas');
  const sliverCanvas = document.createElement('canvas');

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function makePrintTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

  const panelTexture = makePrintTexture(panelCanvas);
  const navTexture = makePrintTexture(navCanvas);
  const sliverTexture = makePrintTexture(sliverCanvas);

  const panelPrintMat = new THREE.MeshBasicMaterial({
    map: panelTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

  const navPrintMat = new THREE.MeshBasicMaterial({
    map: navTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

  const sliverPrintMat = new THREE.MeshBasicMaterial({
    map: sliverTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

  // 6 Slab pieces: index 0 = nav, indices 1..5 = cells A..E
  const pieceIds = ['nav', 'A', 'B', 'C', 'D', 'E'];
  const pieces = pieceIds.map((id) => {
    const isNav = id === 'nav';
    const group = new THREE.Group();
    const glassMat = createShardGlassMaterial(true, materialParams.iridescence);
    const glassMesh = new THREE.Mesh(new THREE.BufferGeometry(), glassMat);
    const printMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      isNav ? navPrintMat : panelPrintMat
    );
    printMesh.position.z = 0.25;
    printMesh.renderOrder = 1;

    glassMesh.userData.pieceId = id;
    group.add(glassMesh, printMesh);
    slabGroup.add(group);

    return {
      id,
      isNav,
      group,
      glassMat,
      glassMesh,
      printMesh,
      baseX: 0,
      baseY: 0,
      halfW: 100,
      halfH: 100,
      // Spring state (k=170, c=19)
      z: 0,
      vz: 0,
      rx: 0,
      vrx: 0,
      ry: 0,
      vry: 0,
      hoverMix: 0,
      // Saved shatter trajectory
      flightVel: new THREE.Vector3(),
      flightGravity: 0,
      tumbleAxis: new THREE.Vector3(0, 1, 0),
      tumbleAngle: 2.5,
    };
  });

  const raycastTargets = pieces.map((p) => p.glassMesh);

  // "← Back" 3D smoked-glass sliver (lives directly in scene in viewport space)
  const sliverGroup = new THREE.Group();
  sliverGroup.rotation.order = 'YXZ';
  sliverGroup.visible = false;
  const sliverGlassMat = createShardGlassMaterial(false, 0.35);
  const sliverGlassMesh = new THREE.Mesh(new THREE.BufferGeometry(), sliverGlassMat);
  const sliverPrintMesh = new THREE.Mesh(new THREE.BufferGeometry(), sliverPrintMat);
  sliverPrintMesh.position.z = 0.25;
  sliverPrintMesh.renderOrder = 1;
  sliverGroup.add(sliverGlassMesh, sliverPrintMesh);
  scene.add(sliverGroup);

  applyMaterialParamsFn = () => {
    scene.environmentIntensity = materialParams.env;
    for (const p of pieces) {
      p.glassMat.color.setHex(materialParams.color);
      p.glassMat.roughness = materialParams.roughness;
      p.glassMat.clearcoat = materialParams.clearcoat;
    }
    sliverGlassMat.color.setHex(materialParams.color);
    sliverGlassMat.roughness = materialParams.roughness;
    sliverGlassMat.clearcoat = materialParams.clearcoat;
  };

  // Layout & UI state
  let metrics = {
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    cameraZ: 1800,
    isPhone: false,
    isPortrait: false,
    blockW: 1200,
    blockH: 760,
    S: 0.74,
    navH: 82,
    navGap: 14,
    panelW: 1200,
    panelH: 664,
    navCenterY: 339,
    panelCenterY: -48,
    sliverSpanW: 200,
    sliverSpanH: 100,
  };

  const uiState = {
    pillHover: 0,
    pillHoverTarget: 0,
    paperHover: 0,
    paperHoverTarget: 0,
    hoveredNav: null,
    sliverHover: 0,
    sliverHoverTarget: 0,
  };

  let panelCanvasDirty = true;
  let navCanvasDirty = true;
  let sliverCanvasDirty = true;

  // Pointer & Global tilt state
  const pointer = {
    inside: false,
    clientX: window.innerWidth * 0.5,
    clientY: window.innerHeight * 0.5,
    ndcX: 0,
    ndcY: 0,
    presence: 0,
    panelUV: { u: 0.5, v: 0.5 },
    panelUVTarget: { u: 0.5, v: 0.5 },
    hoveredPieceId: null,
    pieceLocalNormX: 0,
    pieceLocalNormY: 0,
    sliverNormX: 0,
    sliverNormY: 0,
  };

  const globalTilt = {
    rx: 0.8 * DEG,
    ry: -1.2 * DEG,
  };

  const sliverTilt = {
    rx: 0,
    ry: 0,
  };

  // Transition state machine: 'entering' | 'hero' | 'shattering' | 'paper' | 'reassembling'
  let appMode = 'entering';
  let modeStartSec = performance.now() * 0.001;
  let lastRebuildMs = -1000;
  let typoSpec = null;

  function updateMetrics() {
    const W = Math.max(300, window.innerWidth);
    const H = Math.max(300, window.innerHeight);
    const isPhone = W < 640 || H < 500;
    const isPortrait = H > W;
    const marginX = isPhone ? 16 : W * 0.055;
    const marginY = isPhone ? 16 : H * 0.085;

    const blockW = Math.max(240, W - marginX * 2);
    const blockH = Math.max(280, H - marginY * 2);
    const S = blockW / 1730;
    const navH = blockH * 0.108;
    const navGap = 14;
    const panelW = blockW;
    const panelH = Math.max(180, blockH - navH - navGap);

    const navCenterY = blockH * 0.5 - navH * 0.5;
    const panelCenterY = -blockH * 0.5 + panelH * 0.5;

    // 1 world unit = 1 CSS px at z = 0 with fov = 30 deg
    const halfFovRad = 15 * DEG;
    const cameraZ = (H * 0.5) / Math.tan(halfFovRad);

    camera.aspect = W / H;
    camera.near = Math.max(10, cameraZ * 0.04);
    camera.far = cameraZ * 6;
    camera.position.set(0, 0, cameraZ);
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);

    keyLight.position.set(-W * 0.68, H * 0.78, cameraZ * 0.65);
    rimLight.position.set(W * 0.45, -H * 0.35, cameraZ * 0.4);

    glowUniforms.uGlowRadius.value = 300 * S;

    metrics = {
      viewW: W,
      viewH: H,
      cameraZ,
      isPhone,
      isPortrait,
      blockW,
      blockH,
      S,
      navH,
      navGap,
      panelW,
      panelH,
      navCenterY,
      panelCenterY,
      sliverSpanW: 200,
      sliverSpanH: 100,
    };

    typoSpec = computeTypographySpec(metrics);
    panelCanvasDirty = true;
    navCanvasDirty = true;
    sliverCanvasDirty = true;

    rebuildNavGeometry();
    rebuildPanelGeometries(performance.now() * 0.001);
    rebuildSliverGeometry();
    redrawDirtyCanvases(true);
  }

  function rebuildNavGeometry() {
    const { blockW, navH, navCenterY, S } = metrics;
    const navPiece = pieces[0];
    navPiece.baseX = 0;
    navPiece.baseY = navCenterY;
    navPiece.halfW = blockW * 0.5;
    navPiece.halfH = navH * 0.5;

    const bevel = 2.6 * S;
    const hw = Math.max(20, blockW * 0.5 - bevel);
    const hh = Math.max(12, navH * 0.5 - bevel);
    const navPts = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];

    const { glassGeo, printGeo } = buildPieceGeometries(
      navPts,
      Math.max(4, 20 * S - bevel),
      13 * S,
      bevel,
      (lx, ly) => ({
        u: (lx + blockW * 0.5) / blockW,
        v: (ly + navH * 0.5) / navH,
      })
    );

    navPiece.glassMesh.geometry.dispose();
    navPiece.printMesh.geometry.dispose();
    navPiece.glassMesh.geometry = glassGeo;
    navPiece.printMesh.geometry = printGeo;
  }

  function rebuildPanelGeometries(timeSec) {
    const { panelW, panelH, panelCenterY, S, isPortrait } = metrics;
    const halfGap = 7 * S;
    const bevel = 2.6 * S;

    const cells = computePanelCells(
      timeSec,
      pointer.panelUV,
      pointer.presence,
      panelW,
      panelH,
      halfGap,
      bevel,
      isPortrait
    );

    const radius = Math.max(4, 20 * S - bevel);
    const depth = 13 * S;

    for (let i = 0; i < 5; i++) {
      const piece = pieces[i + 1];
      const cell = cells[i];
      const { cx, cy, halfW, halfH } = polygonCentroidAndSpan(cell.pts);

      piece.baseX = cx;
      piece.baseY = panelCenterY + cy;
      piece.halfW = halfW;
      piece.halfH = halfH;

      const localPts = cell.pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
      const { glassGeo, printGeo } = buildPieceGeometries(
        localPts,
        radius,
        depth,
        bevel,
        (lx, ly) => ({
          u: (lx + cx + panelW * 0.5) / panelW,
          v: (ly + cy + panelH * 0.5) / panelH,
        })
      );

      piece.glassMesh.geometry.dispose();
      piece.printMesh.geometry.dispose();
      piece.glassMesh.geometry = glassGeo;
      piece.printMesh.geometry = printGeo;
    }
  }

  function rebuildSliverGeometry() {
    const { viewW, viewH } = metrics;
    const k = viewW / 1918;

    // On mobile (< 768px) adapt sliver position to match mobile button hit box
    const mobile = viewW < 768;
    const rawFracs = mobile
      ? [
          [0.08, 0.115],
          [0.34, 0.08],
          [0.39, 0.145],
          [0.09, 0.132],
        ]
      : [
          [0.147, 0.243],
          [0.252, 0.169],
          [0.287, 0.277],
          [0.151, 0.258],
        ];

    const centerFracX = mobile ? 0.235 : 0.219;
    const centerFracY = mobile ? 0.116 : 0.238;

    const pivotWorldX = centerFracX * viewW - viewW * 0.5;
    const pivotWorldY = viewH * 0.5 - centerFracY * viewH;
    sliverGroup.position.set(pivotWorldX, pivotWorldY, 0);

    const localPts = rawFracs.map(([fx, fy]) => ({
      x: fx * viewW - W_offset(centerFracX, viewW),
      y: H_offset(centerFracY, viewH) - fy * viewH,
    }));

    let maxAbsX = 20;
    let maxAbsY = 20;
    for (const p of localPts) {
      maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
      maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
    }
    const spanW = maxAbsX * 2.1;
    const spanH = maxAbsY * 2.1;
    metrics.sliverSpanW = spanW;
    metrics.sliverSpanH = spanH;

    const kEff = Math.max(0.55, k);
    const { glassGeo, printGeo } = buildPieceGeometries(
      localPts,
      9 * kEff,
      11 * kEff,
      2.3 * kEff,
      (lx, ly) => ({
        u: lx / spanW + 0.5,
        v: ly / spanH + 0.5,
      })
    );

    sliverGlassMesh.geometry.dispose();
    sliverPrintMesh.geometry.dispose();
    sliverGlassMesh.geometry = glassGeo;
    sliverPrintMesh.geometry = printGeo;
    sliverCanvasDirty = true;
  }

  function W_offset(frac, viewW) {
    return frac * viewW;
  }
  function H_offset(frac, viewH) {
    return frac * viewH;
  }

  function redrawDirtyCanvases(syncDom = false) {
    if (!typoSpec) return;
    let paperW = 96 * metrics.S;

    if (panelCanvasDirty || syncDom) {
      const res = drawPanelCanvas(panelCanvas, typoSpec, uiState);
      paperW = res.paperW;
      panelTexture.needsUpdate = true;
      panelCanvasDirty = false;
    }

    if (navCanvasDirty || syncDom) {
      const navBoxes = drawNavCanvas(navCanvas, typoSpec, uiState);
      navTexture.needsUpdate = true;
      navCanvasDirty = false;
      if (syncDom) {
        syncDomLayerLayout(domEls, typoSpec, navBoxes, paperW);
      }
    }

    if (sliverCanvasDirty) {
      drawSliverCanvas(
        sliverCanvas,
        metrics.sliverSpanW,
        metrics.sliverSpanH,
        metrics.viewW,
        uiState.sliverHover
      );
      sliverTexture.needsUpdate = true;
      sliverCanvasDirty = false;
    }
  }

  // Generate outward + downward + camera-ward shatter trajectories guaranteed to clear the frustum
  function generateFlightTrajectories() {
    const { viewW, viewH, cameraZ, S } = metrics;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      // Deterministic-feeling rich scatter with slight randomness per shatter
      let dirX = p.baseX;
      let dirY = p.baseY - metrics.blockH * 0.08;
      if (p.isNav) {
        dirX = (Math.random() - 0.5) * viewW * 0.45;
        dirY = metrics.blockH * 0.42;
      }
      const len = Math.hypot(dirX, dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;

      const vz = (420 + Math.random() * 380) * S;
      const zAtEnd = Math.min(cameraZ * 0.72, vz);
      const frustumScaleAtEnd = (cameraZ - zAtEnd) / cameraZ;
      const clearX = viewW * 0.5 * frustumScaleAtEnd + p.halfW + 180 * S;
      const clearY = viewH * 0.5 * frustumScaleAtEnd + p.halfH + 180 * S;

      const gravity = (980 + Math.random() * 340) * S;
      let vx = nx * (560 + Math.random() * 360) * S + (Math.random() - 0.5) * 180 * S;
      let vy = ny * (340 + Math.random() * 240) * S - (160 + Math.random() * 190) * S;

      // Ensure every shard exits completely off-screen at p = 1
      const endX = p.baseX + vx;
      const endY = p.baseY + vy - 0.5 * gravity;
      if (Math.abs(endX) < clearX && Math.abs(endY) < clearY) {
        if (Math.abs(nx) > 0.38) {
          const signX = nx >= 0 ? 1 : -1;
          vx = signX * clearX - p.baseX + signX * 90 * S;
        } else {
          vy = -clearY - p.baseY + 0.5 * gravity - 90 * S;
        }
      }

      p.flightVel.set(vx, vy, vz);
      p.flightGravity = gravity;

      // Random unit tumble axis and 2.0 - 3.6 rad tumble angle
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const sq = Math.sqrt(Math.max(0, 1 - u * u));
      p.tumbleAxis.set(sq * Math.cos(theta), sq * Math.sin(theta), u).normalize();
      p.tumbleAngle = 2.0 + Math.random() * 1.6;
    }
  }

  function triggerShatter(tab = 'all') {
    if (appMode === 'shattering' || appMode === 'paper') return;
    setDossierTab(tab);
    sheetCtrl.close();
    generateFlightTrajectories();
    appMode = 'shattering';
    modeStartSec = performance.now() * 0.001;
    domEls.blockLayer.style.pointerEvents = 'none';
    pointer.hoveredPieceId = null;
    uiState.pillHoverTarget = 0;
    uiState.paperHoverTarget = 0;
    uiState.hoveredNav = null;
    navCanvasDirty = true;
  }

  shatterToSectionFn = (tab) => triggerShatter(tab || 'all');

  function triggerReassemble() {
    if (appMode !== 'paper' && appMode !== 'shattering') return;
    appMode = 'reassembling';
    modeStartSec = performance.now() * 0.001;
    definitionsEl.classList.remove('is-interactive');
    definitionsEl.setAttribute('aria-hidden', 'true');
    backHitBtn.disabled = true;
    uiState.sliverHoverTarget = 0;
    for (const p of pieces) {
      p.group.visible = true;
    }
  }

  // Event Listeners
  window.addEventListener('resize', () => {
    updateMetrics();
  });

  window.addEventListener('pointermove', (e) => {
    pointer.inside = true;
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    pointer.ndcX = (e.clientX / metrics.viewW) * 2 - 1;
    pointer.ndcY = 1 - (e.clientY / metrics.viewH) * 2;
  });

  document.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.hoveredPieceId = null;
  });

  window.addEventListener('blur', () => {
    pointer.inside = false;
    pointer.hoveredPieceId = null;
  });

  // Interactive DOM Layer Controls
  domEls.hitOpenStudio.addEventListener('pointerenter', () => {
    uiState.pillHoverTarget = 1;
  });
  domEls.hitOpenStudio.addEventListener('pointerleave', () => {
    uiState.pillHoverTarget = 0;
  });
  domEls.hitOpenStudio.addEventListener('click', () => {
    sheetCtrl.open('contact');
  });

  domEls.hitReadPaper.addEventListener('pointerenter', () => {
    uiState.paperHoverTarget = 1;
  });
  domEls.hitReadPaper.addEventListener('pointerleave', () => {
    uiState.paperHoverTarget = 0;
  });
  domEls.hitReadPaper.addEventListener('click', () => {
    triggerShatter('all');
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    const key = el.getAttribute('data-nav');
    el.addEventListener('pointerenter', () => {
      if (uiState.hoveredNav !== key) {
        uiState.hoveredNav = key;
        navCanvasDirty = true;
      }
    });
    el.addEventListener('pointerleave', () => {
      if (uiState.hoveredNav === key) {
        uiState.hoveredNav = null;
        navCanvasDirty = true;
      }
    });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (key === 'brand') sheetCtrl.open('summary');
      else if (key === 'projects') triggerShatter('projects');
      else if (key === 'experience') sheetCtrl.open('experience');
      else if (key === 'skills') sheetCtrl.open('skills');
      else if (key === 'contact') sheetCtrl.open('contact');
    });
  });

  backHitBtn.addEventListener('pointerenter', () => {
    uiState.sliverHoverTarget = 1;
  });
  backHitBtn.addEventListener('pointerleave', () => {
    uiState.sliverHoverTarget = 0;
  });
  backHitBtn.addEventListener('click', () => {
    triggerReassemble();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cvModalEl && !cvModalEl.hidden) {
        closeCvModal();
      } else if (!studioSheetEl.hidden) {
        sheetCtrl.close();
      } else if (appMode === 'paper') {
        triggerReassemble();
      }
    }
  });

  // Re-render printed textures cleanly once variable Inter woff2 font finishes loading
  if (document.fonts && document.fonts.load) {
    Promise.allSettled([
      document.fonts.load('400 16px "Inter"'),
      document.fonts.load('500 72px "Inter"'),
      document.fonts.load('600 16px "Inter"'),
      document.fonts.load('650 24px "Inter"'),
    ]).then(() => {
      panelCanvasDirty = true;
      navCanvasDirty = true;
      sliverCanvasDirty = true;
    });
  }

  // Initial setup + Load fly-in
  updateMetrics();
  generateFlightTrajectories();
  domEls.blockLayer.style.pointerEvents = 'none';

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Animation loop with software-WebGL sync pacing
  let frameId = 0;
  let prevSec = performance.now() * 0.001;

  function afterDraw(cb) {
    const gl = renderer.getContext();
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    } else {
      frameId = window.setTimeout(cb, 80);
    }
  }

  function stepSpring(val, vel, target, dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    let x = val;
    let v = vel;
    for (let s = 0; s < steps; s++) {
      const a = -170 * (x - target) - 19 * v;
      v += a * h;
      x += v * h;
    }
    return [x, v];
  }

  function tick() {
    const nowMs = performance.now();
    const nowSec = nowMs * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, nowSec - prevSec));
    prevSec = nowSec;

    // 1. Global block tilt (0.3s exponential smoothing)
    const tiltAlpha = 1 - Math.exp(-dt / 0.3);
    const activePointerInHero = pointer.inside && (appMode === 'hero' || appMode === 'entering');
    const px = activePointerInHero ? pointer.ndcX : 0;
    const py = activePointerInHero ? pointer.ndcY : 0;
    const targetRy = (px * 7.0 - 1.2) * DEG;
    const targetRx = (-py * 5.5 + 0.8) * DEG;

    globalTilt.ry += (targetRy - globalTilt.ry) * tiltAlpha;
    globalTilt.rx += (targetRx - globalTilt.rx) * tiltAlpha;
    slabGroup.rotation.set(globalTilt.rx, globalTilt.ry, 0);
    slabGroup.updateMatrixWorld(true);

    // 2. Raycast pointer onto tilted slab plane & pieces
    const glowFadeTarget = activePointerInHero ? 1 : 0;
    pointer.presence += (glowFadeTarget - pointer.presence) * (1 - Math.exp(-dt / 0.18));
    glowUniforms.uGlowAlpha.value = pointer.presence;

    _ndc.set(pointer.ndcX, pointer.ndcY);
    _raycaster.setFromCamera(_ndc, camera);

    // Intersect slab plane z = 0 in world space for continuous cursor glow & cut push
    _planeNormal.set(0, 0, 1).transformDirection(slabGroup.matrixWorld);
    _planeZ.setFromNormalAndCoplanarPoint(_planeNormal, slabGroup.position);
    if (_raycaster.ray.intersectPlane(_planeZ, _planeHit)) {
      glowUniforms.uCursorWorld.value.copy(_planeHit);
      _localHit.copy(_planeHit);
      slabGroup.worldToLocal(_localHit);

      const uTarget = (_localHit.x + metrics.panelW * 0.5) / metrics.panelW;
      const vTarget = (metrics.panelCenterY + metrics.panelH * 0.5 - _localHit.y) / metrics.panelH;
      pointer.panelUVTarget.u = clamp(uTarget, -0.25, 1.25);
      pointer.panelUVTarget.v = clamp(vTarget, -0.25, 1.25);
    }

    const uvFollow = 1 - Math.exp(-dt / 0.11);
    pointer.panelUV.u += (pointer.panelUVTarget.u - pointer.panelUV.u) * uvFollow;
    pointer.panelUV.v += (pointer.panelUVTarget.v - pointer.panelUV.v) * uvFollow;

    // Piece hover picking in hero mode
    if (appMode === 'hero' && pointer.inside) {
      const hits = _raycaster.intersectObjects(raycastTargets, false);
      if (hits.length > 0) {
        const hit = hits[0];
        const pid = hit.object.userData.pieceId;
        pointer.hoveredPieceId = pid;
        const piece = pieces.find((item) => item.id === pid);
        if (piece) {
          _localHit.copy(hit.point);
          slabGroup.worldToLocal(_localHit);
          pointer.pieceLocalNormX = clamp((_localHit.x - piece.baseX) / piece.halfW, -1, 1);
          pointer.pieceLocalNormY = clamp((_localHit.y - piece.baseY) / piece.halfH, -1, 1);
        }
      } else {
        pointer.hoveredPieceId = null;
      }
    } else {
      pointer.hoveredPieceId = null;
    }

    // 3. Live cut pattern rebuild (~45x/s) when shards are assembled or entering/reassembling
    if (appMode !== 'paper' && nowMs - lastRebuildMs >= 22) {
      lastRebuildMs = nowMs;
      rebuildPanelGeometries(nowSec);
    }

    // 4. Smooth UI hover transitions (Open studio green #36d67e, Read paper underline, Back lavender)
    const uiLerp = 1 - Math.exp(-dt / 0.08);
    if (Math.abs(uiState.pillHoverTarget - uiState.pillHover) > 0.002) {
      uiState.pillHover += (uiState.pillHoverTarget - uiState.pillHover) * uiLerp;
      panelCanvasDirty = true;
    } else if (uiState.pillHover !== uiState.pillHoverTarget) {
      uiState.pillHover = uiState.pillHoverTarget;
      panelCanvasDirty = true;
    }

    if (Math.abs(uiState.paperHoverTarget - uiState.paperHover) > 0.002) {
      uiState.paperHover += (uiState.paperHoverTarget - uiState.paperHover) * uiLerp;
      panelCanvasDirty = true;
    } else if (uiState.paperHover !== uiState.paperHoverTarget) {
      uiState.paperHover = uiState.paperHoverTarget;
      panelCanvasDirty = true;
    }

    // 5. State machine progression & per-piece kinematics
    const elapsedMode = nowSec - modeStartSec;

    if (appMode === 'entering') {
      const totalDur = FLIGHT_DURATION + (pieces.length - 1) * STAGGER_SEC;
      if (elapsedMode >= totalDur) {
        appMode = 'hero';
        domEls.blockLayer.style.pointerEvents = 'auto';
      }
    } else if (appMode === 'shattering') {
      // Fade in definitions view from 0.28s over 0.40s
      const defT = clamp((elapsedMode - 0.28) / 0.4, 0, 1);
      definitionsEl.style.opacity = `${easeOutCubic(defT)}`;

      // Grow in Back sliver from 0.30s
      if (elapsedMode >= 0.3) {
        sliverGroup.visible = true;
        const slvT = clamp((elapsedMode - 0.3) / 0.38, 0, 1);
        const sVal = Math.max(0.001, easeOutBack(slvT));
        sliverGroup.scale.setScalar(sVal);
      } else {
        sliverGroup.visible = false;
      }

      const totalDur = FLIGHT_DURATION + (pieces.length - 1) * STAGGER_SEC;
      if (elapsedMode >= totalDur) {
        appMode = 'paper';
        definitionsEl.style.opacity = '1';
        definitionsEl.classList.add('is-interactive');
        definitionsEl.setAttribute('aria-hidden', 'false');
        backHitBtn.disabled = false;
        sliverGroup.visible = true;
        sliverGroup.scale.setScalar(1);
        for (const p of pieces) {
          p.group.visible = false;
        }
      }
    } else if (appMode === 'reassembling') {
      // Definitions fade out in 0.25s and sliver shrinks away
      const outT = clamp(elapsedMode / 0.25, 0, 1);
      definitionsEl.style.opacity = `${1 - easeOutCubic(outT)}`;
      if (outT < 1) {
        sliverGroup.visible = true;
        sliverGroup.scale.setScalar(Math.max(0.001, 1 - easeInCubic(outT)));
      } else {
        sliverGroup.visible = false;
      }

      const totalDur = FLIGHT_DURATION + (pieces.length - 1) * STAGGER_SEC;
      if (elapsedMode >= totalDur) {
        appMode = 'hero';
        definitionsEl.style.opacity = '0';
        domEls.blockLayer.style.pointerEvents = 'auto';
      }
    }

    // Update each shard/nav piece transform & material sheen
    if (appMode !== 'paper') {
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const hovered = appMode === 'hero' && pointer.hoveredPieceId === p.id;

        const targetZ = hovered ? (p.isNav ? 32 * metrics.S : 50 * metrics.S) : 0;
        const maxRy = p.isNav ? 0.055 : 0.24;
        const maxRx = p.isNav ? 0.18 : 0.24;
        const targetRyPiece = hovered ? pointer.pieceLocalNormX * maxRy : 0;
        const targetRxPiece = hovered ? -pointer.pieceLocalNormY * maxRx : 0;

        [p.z, p.vz] = stepSpring(p.z, p.vz, targetZ, dt);
        [p.rx, p.vrx] = stepSpring(p.rx, p.vrx, targetRxPiece, dt);
        [p.ry, p.vry] = stepSpring(p.ry, p.vry, targetRyPiece, dt);

        const targetHoverMix = hovered ? 1 : 0;
        p.hoverMix += (targetHoverMix - p.hoverMix) * (1 - Math.exp(-dt / 0.14));
        p.glassMat.iridescence =
          materialParams.iridescence + (1.0 - materialParams.iridescence) * p.hoverMix;
        p.glassMat.envMapIntensity = 1.0 + 0.9 * p.hoverMix;

        // Compute flight progress (0 = assembled, 1 = shattered off-screen)
        let flightP = 0;
        if (appMode === 'shattering') {
          const u = clamp((elapsedMode - i * STAGGER_SEC) / FLIGHT_DURATION, 0, 1);
          flightP = easeInCubic(u);
        } else if (appMode === 'entering' || appMode === 'reassembling') {
          const u = clamp((elapsedMode - i * STAGGER_SEC) / FLIGHT_DURATION, 0, 1);
          flightP = 1 - easeOutBack(u);
        }

        const fx = p.flightVel.x * flightP;
        const fy =
          p.flightVel.y * flightP -
          0.5 * p.flightGravity * flightP * Math.abs(flightP);
        const fz = p.flightVel.z * flightP;

        p.group.position.set(p.baseX + fx, p.baseY + fy, p.z + fz);

        _eulerHover.set(p.rx, p.ry, 0);
        _quatHover.setFromEuler(_eulerHover);

        if (Math.abs(flightP) > 1e-4) {
          _quatTumble.setFromAxisAngle(p.tumbleAxis, p.tumbleAngle * flightP);
          p.group.quaternion.copy(_quatTumble).multiply(_quatHover);
        } else {
          p.group.quaternion.copy(_quatHover);
        }
      }

      // Sync DOM text homography onto tilted 3D slab
      const cssMatrix = computeBlockHomographyCSS(
        slabGroup,
        camera,
        metrics.blockW,
        metrics.blockH,
        metrics.viewW,
        metrics.viewH
      );
      domEls.blockLayer.style.transform = cssMatrix;
      domEls.blockLayer.style.opacity = appMode === 'hero' ? '1' : '0';
    }

    // 6. Update "← Back" 3D glass sliver wobble, raycast hover, and lavender label
    if (sliverGroup.visible) {
      let sliverRayHit = false;
      if (appMode === 'paper' && pointer.inside) {
        const sHits = _raycaster.intersectObject(sliverGlassMesh, false);
        if (sHits.length > 0) {
          sliverRayHit = true;
        }
      }
      const isSliverHovered = uiState.sliverHoverTarget > 0.5 || sliverRayHit;
      const slvMixTarget = isSliverHovered ? 1 : 0;
      if (Math.abs(slvMixTarget - uiState.sliverHover) > 0.002) {
        uiState.sliverHover += (slvMixTarget - uiState.sliverHover) * uiLerp;
        sliverCanvasDirty = true;
      } else if (uiState.sliverHover !== slvMixTarget) {
        uiState.sliverHover = slvMixTarget;
        sliverCanvasDirty = true;
      }

      sliverGlassMat.envMapIntensity = 1.0 + 0.75 * uiState.sliverHover;
      sliverGlassMat.iridescence = 0.35 + 0.45 * uiState.sliverHover;

      // Idle wobble (±.03-.04 rad at ~1 Hz) + hover tip up to .14 rad toward pointer
      const wobY = 0.036 * Math.sin(nowSec * Math.PI * 2 * 0.94);
      const wobX = 0.031 * Math.cos(nowSec * Math.PI * 2 * 1.08);

      let tipTargetY = 0;
      let tipTargetX = 0;
      if (isSliverHovered && pointer.inside) {
        const cxPx = (metrics.viewW < 768 ? 0.235 : 0.219) * metrics.viewW;
        const cyPx = (metrics.viewW < 768 ? 0.116 : 0.238) * metrics.viewH;
        const dxN = clamp((pointer.clientX - cxPx) / (metrics.sliverSpanW * 0.5), -1, 1);
        const dyN = clamp((cyPx - pointer.clientY) / (metrics.sliverSpanH * 0.5), -1, 1);
        tipTargetY = dxN * 0.14;
        tipTargetX = -dyN * 0.14;
      }

      const slvDamp = 1 - Math.exp(-dt / 0.12);
      sliverTilt.ry += (tipTargetY - sliverTilt.ry) * slvDamp;
      sliverTilt.rx += (tipTargetX - sliverTilt.rx) * slvDamp;

      sliverGroup.rotation.set(0.08 + wobX + sliverTilt.rx, -0.16 + wobY + sliverTilt.ry, 0);
    }

    redrawDirtyCanvases(false);
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  frameId = requestAnimationFrame(tick);
}
