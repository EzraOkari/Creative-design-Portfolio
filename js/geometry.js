import * as THREE from 'three';

const DRIFT_SPECS = {
  tAB: { u: 0.22, v: 0, ampU: 0.03, ampV: 0, perU: 13.4, phU: 0.4, perV: 1, phV: 0, edge: 'u' },
  tBC: { u: 0.515, v: 0, ampU: 0.03, ampV: 0, perU: 17.1, phU: 2.1, perV: 1, phV: 0, edge: 'u' },
  tCE: { u: 0.84, v: 0, ampU: 0.03, ampV: 0, perU: 11.8, phU: 4.3, perV: 1, phV: 0, edge: 'u' },
  bAD: { u: 0.34, v: 1, ampU: 0.03, ampV: 0, perU: 15.6, phU: 1.2, perV: 1, phV: 0, edge: 'u' },
  bDE: { u: 0.865, v: 1, ampU: 0.03, ampV: 0, perU: 19.2, phU: 3.5, perV: 1, phV: 0, edge: 'u' },
  J0: { u: 0.385, v: 0.72, ampU: 0.03, ampV: 0.05, perU: 14.3, phU: 0.9, perV: 18.6, phV: 2.7, edge: 'none' },
  J1: { u: 0.48, v: 0.62, ampU: 0.03, ampV: 0.05, perU: 16.8, phU: 3.8, perV: 12.4, phV: 5.1, edge: 'none' },
  J2: { u: 0.716, v: 0.49, ampU: 0.03, ampV: 0.05, perU: 10.9, phU: 5.4, perV: 15.9, phV: 1.6, edge: 'none' },
};

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Computes the 5 live cut cells (A, B, C, D, E) in panel-centered 3D coords.
 * Outer perimeter is expanded by +halfGap so uniform inward offset of halfGap
 * puts internal cut outlines 2*halfGap = 14*S apart while keeping outer edges flush.
 */
export function computePanelCells(
  timeSec,
  pointerUV,
  pointerPresence,
  panelW,
  panelH,
  halfGap,
  bevelSize,
  isPortrait
) {
  const pts = {
    TL: { u: 0, v: 0 },
    TR: { u: 1, v: 0 },
    BR: { u: 1, v: 1 },
    BL: { u: 0, v: 1 },
  };

  // Convert pointerUV from screen-oriented panel UV to pattern (u, v)
  const ptrU = isPortrait ? pointerUV.v : pointerUV.u;
  const ptrV = isPortrait ? pointerUV.u : pointerUV.v;

  for (const [key, s] of Object.entries(DRIFT_SPECS)) {
    let u = s.u + s.ampU * Math.sin((TAU * timeSec) / s.perU + s.phU);
    let v = s.v + (s.ampV ? s.ampV * Math.sin((TAU * timeSec) / s.perV + s.phV) : 0);

    if (pointerPresence > 0.001) {
      const du = u - ptrU;
      const dv = v - ptrV;
      const dist = Math.hypot(du, dv);
      if (dist < 0.6 && dist > 1e-4) {
        const t = 1 - dist / 0.6;
        const push = 0.05 * t * t * pointerPresence;
        u += (du / dist) * push;
        if (s.edge === 'none') {
          v += (dv / dist) * push;
        }
      }
    }

    pts[key] = { u, v };
  }

  // Enforce clean topological separation so cells stay well-formed
  pts.tAB.u = clamp(pts.tAB.u, 0.1, 0.36);
  pts.tBC.u = clamp(pts.tBC.u, pts.tAB.u + 0.12, 0.68);
  pts.tCE.u = clamp(pts.tCE.u, pts.tBC.u + 0.14, 0.93);

  pts.bAD.u = clamp(pts.bAD.u, 0.15, 0.56);
  pts.bDE.u = clamp(pts.bDE.u, pts.bAD.u + 0.18, 0.94);

  pts.J0.u = clamp(pts.J0.u, 0.22, 0.52);
  pts.J0.v = clamp(pts.J0.v, 0.54, 0.86);

  pts.J1.u = clamp(pts.J1.u, pts.J0.u + 0.06, 0.63);
  pts.J1.v = clamp(pts.J1.v, 0.44, 0.78);

  pts.J2.u = clamp(pts.J2.u, pts.J1.u + 0.1, 0.85);
  pts.J2.v = clamp(pts.J2.v, 0.32, 0.66);

  const rawCells = [
    { id: 'A', keys: ['TL', 'tAB', 'J0', 'bAD', 'BL'] },
    { id: 'B', keys: ['tAB', 'tBC', 'J1', 'J0'] },
    { id: 'C', keys: ['tBC', 'tCE', 'J2', 'J1'] },
    { id: 'D', keys: ['J0', 'J1', 'J2', 'bDE', 'bAD'] },
    { id: 'E', keys: ['tCE', 'TR', 'BR', 'bDE', 'J2'] },
  ];

  // Expand outer perimeter by halfGap so offsetting inward by (halfGap + bevelSize)
  // leaves outer bevel edges flush on ±panelW/2, ±panelH/2 and internal bevels 2*halfGap apart.
  const expandX = halfGap;
  const expandY = halfGap;
  const totalInset = halfGap + bevelSize;

  return rawCells.map((cell) => {
    const worldPts = cell.keys.map((k) => {
      const p = pts[k];
      const su = isPortrait ? p.v : p.u;
      const sv = isPortrait ? p.u : p.v;

      let x = (su - 0.5) * panelW;
      let y = (0.5 - sv) * panelH;
      if (su <= 1e-4) x -= expandX;
      else if (su >= 1 - 1e-4) x += expandX;
      if (sv <= 1e-4) y += expandY;
      else if (sv >= 1 - 1e-4) y -= expandY;

      return { x, y };
    });

    const insetPts = offsetPolygonInward(worldPts, totalInset);
    return {
      id: cell.id,
      pts: insetPts,
    };
  });
}

function signedArea(pts) {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

export function ensureCCW(pts) {
  if (signedArea(pts) < 0) {
    return pts.slice().reverse();
  }
  return pts.slice();
}

/**
 * Smooth, collinear-safe inward miter offset for a polygon.
 */
export function offsetPolygonInward(inputPts, inset) {
  const pts = ensureCCW(inputPts);
  const n = pts.length;
  if (inset <= 0 || n < 3) return pts;

  const normals = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // CCW inward normal is (-ty, tx)
    normals[i] = { x: -dy / len, y: dx / len };
  }

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const nPrev = normals[(i - 1 + n) % n];
    const nCurr = normals[i];
    const dot = nPrev.x * nCurr.x + nPrev.y * nCurr.y;
    const denom = Math.max(0.28, 1 + dot);
    out[i] = {
      x: pts[i].x + (inset * (nPrev.x + nCurr.x)) / denom,
      y: pts[i].y + (inset * (nPrev.y + nCurr.y)) / denom,
    };
  }
  return out;
}

/**
 * Builds a THREE.Shape from a polygon with tangent circular fillets of radius R.
 * Handles both convex and reflex corners and clamps fillet length on short edges.
 */
export function createRoundedPolygonShape(inputPts, radius) {
  const raw = ensureCCW(inputPts);
  // Filter degenerate ultra-short edges
  const pts = [];
  for (let i = 0; i < raw.length; i++) {
    const prev = pts.length > 0 ? pts[pts.length - 1] : raw[raw.length - 1];
    if (Math.hypot(raw[i].x - prev.x, raw[i].y - prev.y) > 0.5) {
      pts.push(raw[i]);
    }
  }

  const shape = new THREE.Shape();
  const n = pts.length;
  if (n < 3) return shape;

  const corners = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const vInX = prev.x - curr.x;
    const vInY = prev.y - curr.y;
    const lenIn = Math.hypot(vInX, vInY) || 1;
    const uInX = vInX / lenIn;
    const uInY = vInY / lenIn;

    const vOutX = next.x - curr.x;
    const vOutY = next.y - curr.y;
    const lenOut = Math.hypot(vOutX, vOutY) || 1;
    const uOutX = vOutX / lenOut;
    const uOutY = vOutY / lenOut;

    const dot = clamp(uInX * uOutX + uInY * uOutY, -1, 1);
    const theta = Math.acos(dot);

    if (radius <= 0.1 || theta > Math.PI - 0.025 || theta < 0.05) {
      corners[i] = { sharp: true, x: curr.x, y: curr.y };
      continue;
    }

    const halfTheta = theta * 0.5;
    const tanHalf = Math.tan(halfTheta);
    const maxTangent = 0.44 * Math.min(lenIn, lenOut);
    const tangentDist = Math.min(radius / tanHalf, maxTangent);
    const rEff = tangentDist * tanHalf;

    const startX = curr.x + uInX * tangentDist;
    const startY = curr.y + uInY * tangentDist;
    const endX = curr.x + uOutX * tangentDist;
    const endY = curr.y + uOutY * tangentDist;

    let bisX = uInX + uOutX;
    let bisY = uInY + uOutY;
    const bisLen = Math.hypot(bisX, bisY) || 1;
    bisX /= bisLen;
    bisY /= bisLen;

    const centerDist = rEff / Math.sin(halfTheta);
    const cx = curr.x + bisX * centerDist;
    const cy = curr.y + bisY * centerDist;

    const a0 = Math.atan2(startY - cy, startX - cx);
    const a1 = Math.atan2(endY - cy, endX - cx);

    // Cross of edge direction (-uIn) with outgoing (uOut): > 0 is convex CCW turn
    const cross = -uInX * uOutY + uInY * uOutX;
    const clockwise = cross < 0;

    corners[i] = {
      sharp: false,
      startX,
      startY,
      cx,
      cy,
      r: rEff,
      a0,
      a1,
      clockwise,
    };
  }

  const c0 = corners[0];
  if (c0.sharp) {
    shape.moveTo(c0.x, c0.y);
  } else {
    shape.moveTo(c0.startX, c0.startY);
    shape.absarc(c0.cx, c0.cy, c0.r, c0.a0, c0.a1, c0.clockwise);
  }

  for (let i = 1; i < n; i++) {
    const c = corners[i];
    if (c.sharp) {
      shape.lineTo(c.x, c.y);
    } else {
      shape.lineTo(c.startX, c.startY);
      shape.absarc(c.cx, c.cy, c.r, c.a0, c.a1, c.clockwise);
    }
  }

  shape.closePath();
  return shape;
}

export function polygonCentroidAndSpan(pts) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    sx += p.x;
    sy += p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const inv = 1 / (pts.length || 1);
  return {
    cx: sx * inv,
    cy: sy * inv,
    halfW: Math.max(10, (maxX - minX) * 0.5),
    halfH: Math.max(10, (maxY - minY) * 0.5),
  };
}

/**
 * Creates both the beveled ExtrudeGeometry (front flat face aligned to z = 0)
 * and the top-face ShapeGeometry with UVs mapped to the original page coordinates.
 */
export function buildPieceGeometries(localPts, radius, depth, bevel, uvMapper) {
  const shape = createRoundedPolygonShape(localPts, radius);

  const glassGeo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });

  glassGeo.computeBoundingBox();
  if (glassGeo.boundingBox) {
    glassGeo.translate(0, 0, -glassGeo.boundingBox.max.z);
  }

  const printGeo = new THREE.ShapeGeometry(shape, 8);
  if (uvMapper) {
    const pos = printGeo.attributes.position;
    const uv = printGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const mapped = uvMapper(lx, ly);
      uv.setXY(i, mapped.u, mapped.v);
    }
    uv.needsUpdate = true;
  }

  return { glassGeo, printGeo };
}
