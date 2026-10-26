import * as THREE from 'three';

const _corners = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];

/**
 * Computes a CSS matrix3d(...) homography mapping a [0, blockW] x [0, blockH] DOM element
 * onto the 4 projected screen-space corners of the tilted 3D block at z = 0.
 */
export function computeBlockHomographyCSS(slabGroup, camera, blockW, blockH, viewW, viewH) {
  const hw = blockW * 0.5;
  const hh = blockH * 0.5;

  // TL, TR, BR, BL in slabGroup local coords
  _corners[0].set(-hw, hh, 0);
  _corners[1].set(hw, hh, 0);
  _corners[2].set(hw, -hh, 0);
  _corners[3].set(-hw, -hh, 0);

  slabGroup.updateMatrixWorld(true);

  const X = [0, 0, 0, 0];
  const Y = [0, 0, 0, 0];

  for (let i = 0; i < 4; i++) {
    _corners[i].applyMatrix4(slabGroup.matrixWorld).project(camera);
    X[i] = (_corners[i].x + 1) * 0.5 * viewW;
    Y[i] = (1 - _corners[i].y) * 0.5 * viewH;
  }

  const dx1 = X[1] - X[2];
  const dy1 = Y[1] - Y[2];
  const dx2 = X[3] - X[2];
  const dy2 = Y[3] - Y[2];
  const sx = X[0] - X[1] + X[2] - X[3];
  const sy = Y[0] - Y[1] + Y[2] - Y[3];

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-7) {
    return `translate3d(${X[0]}px, ${Y[0]}px, 0)`;
  }

  const g = (sx * dy2 - sy * dx2) / det;
  const h = (dx1 * sy - dy1 * sx) / det;

  const a = X[1] - X[0] + g * X[1];
  const b = X[3] - X[0] + h * X[3];
  const c = X[0];

  const d = Y[1] - Y[0] + g * Y[1];
  const e = Y[3] - Y[0] + h * Y[3];
  const f = Y[0];

  const m00 = a / blockW;
  const m01 = b / blockH;
  const m03 = c;

  const m10 = d / blockW;
  const m11 = e / blockH;
  const m13 = f;

  const m30 = g / blockW;
  const m31 = h / blockH;

  return `matrix3d(${m00}, ${m10}, 0, ${m30}, ${m01}, ${m11}, 0, ${m31}, 0, 0, 1, 0, ${m03}, ${m13}, 0, 1)`;
}
