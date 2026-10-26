function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRgb(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

function fillTrackedText(ctx, text, x, y, trackingPx) {
  if ('letterSpacing' in ctx) {
    const prev = ctx.letterSpacing;
    ctx.letterSpacing = `${trackingPx}px`;
    ctx.fillText(text, x, y);
    const width = ctx.measureText(text).width;
    ctx.letterSpacing = prev;
    return width;
  }

  let cursorX = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, cursorX, y);
    cursorX += ctx.measureText(ch).width + (i < text.length - 1 ? trackingPx : 0);
  }
  return cursorX - x;
}

function measureTrackedText(ctx, text, trackingPx) {
  if ('letterSpacing' in ctx) {
    const prev = ctx.letterSpacing;
    ctx.letterSpacing = `${trackingPx}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = prev;
    return w;
  }
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]).width + (i < text.length - 1 ? trackingPx : 0);
  }
  return total;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function computeTypographySpec(metrics) {
  const { blockW, blockH, navH, navGap, panelW, panelH, S } = metrics;
  const padX = Math.max(20, 58 * S);
  const maxInnerW = Math.max(180, panelW - padX * 2);

  const eyebrowFs = Math.max(8.5, 11 * S);
  const eyebrowTracking = eyebrowFs * 0.2;
  const eyebrowBaseline = panelH * 0.135;

  const h1Fs = Math.min(panelW * 0.068, panelH * 0.19, maxInnerW / 5.9);
  const h1Leading = h1Fs * 0.98;
  const h1Tracking = -0.045 * h1Fs;
  const h1Line1Baseline = eyebrowBaseline + Math.max(24, 34 * S) + h1Fs * 0.84;
  const h1Line2Baseline = h1Line1Baseline + h1Leading;

  const rawSubFs = Math.max(10.5, 18.5 * S);
  const approxLine1Chars = 34;
  const subFs = Math.min(rawSubFs, maxInnerW / approxLine1Chars);
  const subLeading = subFs * 1.52;
  const subTracking = -0.01 * subFs;
  const subLine1Baseline = h1Line2Baseline + Math.max(24, 40 * S) + subFs * 0.65;
  const subLine2Baseline = subLine1Baseline + subLeading;

  const pillW = Math.max(96, 124 * S);
  const pillH = Math.max(30, 40 * S);
  const pillRadius = Math.max(4.5, 6 * S);
  const pillX = padX;
  const pillY = subLine2Baseline + Math.max(22, 38 * S);
  const ctaFs = Math.max(10.5, 13.8 * S);

  const paperX = pillX + pillW + Math.max(16, 26 * S);
  const paperBaseline = pillY + pillH * 0.5 + ctaFs * 0.35;

  const footerFs = Math.max(8.5, 11 * S);
  const footerBaseline = panelH - Math.max(16, 32 * S);

  const navBrandFs = Math.max(12, 16 * S);
  const navLinkFs = Math.max(10.5, 14.2 * S);
  const navMarkSize = Math.max(11, 15 * S);

  return {
    blockW,
    blockH,
    navH,
    navGap,
    panelW,
    panelH,
    S,
    padX,
    eyebrowFs,
    eyebrowTracking,
    eyebrowBaseline,
    h1Fs,
    h1Leading,
    h1Tracking,
    h1Line1Baseline,
    h1Line2Baseline,
    subFs,
    subLeading,
    subTracking,
    subLine1Baseline,
    subLine2Baseline,
    pillX,
    pillY,
    pillW,
    pillH,
    pillRadius,
    ctaFs,
    paperX,
    paperBaseline,
    footerFs,
    footerBaseline,
    navBrandFs,
    navLinkFs,
    navMarkSize,
  };
}

export function drawPanelCanvas(canvas, spec, uiState) {
  const dpr = Math.max(1.5, Math.min(window.devicePixelRatio || 2, 2.5));
  const targetW = Math.max(2, Math.round(spec.panelW * dpr));
  const targetH = Math.max(2, Math.round(spec.panelH * dpr));

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, spec.panelW, spec.panelH);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // 1. Eyebrow
  ctx.font = `500 ${spec.eyebrowFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  fillTrackedText(
    ctx,
    'DIGITAL ARTIST \u00B7 2D VISUAL DESIGNER',
    spec.padX,
    spec.eyebrowBaseline,
    spec.eyebrowTracking
  );

  // 2. Headline "Ezra Okari / Visual Design." with vertical gradient #dcdce0 -> #bdbdc3
  const gradTop = spec.h1Line1Baseline - spec.h1Fs * 0.85;
  const gradBot = spec.h1Line2Baseline + spec.h1Fs * 0.2;
  const h1Grad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
  h1Grad.addColorStop(0, '#dcdce0');
  h1Grad.addColorStop(1, '#bdbdc3');

  ctx.font = `500 ${spec.h1Fs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = h1Grad;
  fillTrackedText(ctx, 'Ezra Okari', spec.padX, spec.h1Line1Baseline, spec.h1Tracking);
  fillTrackedText(ctx, 'Visual Design.', spec.padX, spec.h1Line2Baseline, spec.h1Tracking);

  // 3. Two-line subcopy (55% white)
  ctx.font = `400 ${spec.subFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  fillTrackedText(
    ctx,
    'Graphic design, branding, social media visuals, photography, and',
    spec.padX,
    spec.subLine1Baseline,
    spec.subTracking
  );
  fillTrackedText(
    ctx,
    'concept-led visual storytelling from Kenya.',
    spec.padX,
    spec.subLine2Baseline,
    spec.subTracking
  );

  // 4. "Get in touch" pill (light #ededf0 -> #36d67e on hover)
  const pillFill = lerpRgb([237, 237, 240], [54, 214, 126], uiState.pillHover);
  roundRectPath(ctx, spec.pillX, spec.pillY, spec.pillW, spec.pillH, spec.pillRadius);
  ctx.fillStyle = pillFill;
  ctx.fill();

  ctx.font = `500 ${spec.ctaFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = lerpRgb([11, 11, 14], [4, 22, 12], uiState.pillHover);
  const pillLabel = 'Get in touch';
  const pillTextW = measureTrackedText(ctx, pillLabel, -0.01 * spec.ctaFs);
  const pillTextX = spec.pillX + (spec.pillW - pillTextW) * 0.5;
  const pillTextY = spec.pillY + spec.pillH * 0.5 + spec.ctaFs * 0.34;
  fillTrackedText(ctx, pillLabel, pillTextX, pillTextY, -0.01 * spec.ctaFs);

  // 5. "Explore work →" link (underlines on hover, shatters glass)
  const paperAlpha = lerp(0.84, 1.0, uiState.paperHover);
  ctx.fillStyle = `rgba(255, 255, 255, ${paperAlpha})`;
  const paperLabel = 'Explore work \u2192';
  const paperW = fillTrackedText(
    ctx,
    paperLabel,
    spec.paperX,
    spec.paperBaseline,
    -0.01 * spec.ctaFs
  );

  if (uiState.paperHover > 0.01) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.88 * uiState.paperHover})`;
    ctx.lineWidth = Math.max(1, 1.15 * spec.S);
    const underY = spec.paperBaseline + Math.max(2.5, 3.5 * spec.S);
    ctx.beginPath();
    ctx.moveTo(spec.paperX, underY);
    ctx.lineTo(spec.paperX + paperW, underY);
    ctx.stroke();
  }

  // 6. Footer captions (11*S px at 34% white)
  ctx.font = `400 ${spec.footerFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  fillTrackedText(ctx, 'Kenya \u00B7 +254 1140 597 23', spec.padX, spec.footerBaseline, 0);

  const specStr = 'okariezra15@gmail.com';
  const specW = measureTrackedText(ctx, specStr, 0);
  fillTrackedText(ctx, specStr, spec.panelW - spec.padX - specW, spec.footerBaseline, 0);

  return { paperW };
}

export function drawNavCanvas(canvas, spec, uiState) {
  const dpr = Math.max(1.5, Math.min(window.devicePixelRatio || 2, 2.5));
  const targetW = Math.max(2, Math.round(spec.blockW * dpr));
  const targetH = Math.max(2, Math.round(spec.navH * dpr));

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, spec.blockW, spec.navH);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const midY = spec.navH * 0.5;

  // 1. Left: Faceted square mark + "Ezra Okari"
  const mSize = spec.navMarkSize;
  const mx = spec.padX;
  const my = midY - mSize * 0.5;

  const markGrad = ctx.createLinearGradient(mx, my, mx + mSize, my + mSize);
  markGrad.addColorStop(0, '#f4f4f8');
  markGrad.addColorStop(0.55, '#c8cad6');
  markGrad.addColorStop(1, '#8c8fa0');
  roundRectPath(ctx, mx, my, mSize, mSize, Math.max(2, 2.6 * spec.S));
  ctx.fillStyle = markGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(15, 15, 20, 0.55)';
  ctx.lineWidth = Math.max(1, 1.15 * spec.S);
  ctx.beginPath();
  ctx.moveTo(mx + mSize * 0.26, my + mSize);
  ctx.lineTo(mx + mSize * 0.72, my);
  ctx.stroke();

  ctx.font = `600 ${spec.navBrandFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  const brandAlpha = uiState.hoveredNav === 'brand' ? 1.0 : 0.92;
  ctx.fillStyle = `rgba(255, 255, 255, ${brandAlpha})`;
  const brandX = mx + mSize + Math.max(8, 10 * spec.S);
  const brandY = midY + spec.navBrandFs * 0.35;
  const brandW = fillTrackedText(ctx, 'Ezra Okari', brandX, brandY, -0.02 * spec.navBrandFs);

  // 2. Center: "Projects · Experience · Skills"
  const navHitBoxes = {
    brand: { x: mx, y: midY - mSize, w: mSize + 10 * spec.S + brandW, h: mSize * 2 },
    projects: null,
    experience: null,
    skills: null,
    contact: null,
  };

  ctx.font = `400 ${spec.navLinkFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  const linkBaseline = midY + spec.navLinkFs * 0.35;

  if (spec.blockW >= 460) {
    const items = [
      { key: 'projects', label: 'Projects' },
      { key: 'experience', label: 'Experience' },
      { key: 'skills', label: 'Skills' },
    ];
    const sepGap = Math.max(10, 16 * spec.S);
    const dotW = ctx.measureText('\u00B7').width;
    const widths = items.map((it) => measureTrackedText(ctx, it.label, -0.005 * spec.navLinkFs));
    const totalW = widths[0] + widths[1] + widths[2] + 2 * (sepGap * 2 + dotW);

    let cx = (spec.blockW - totalW) * 0.5;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const active = uiState.hoveredNav === it.key;
      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.60)';
      fillTrackedText(ctx, it.label, cx, linkBaseline, -0.005 * spec.navLinkFs);
      navHitBoxes[it.key] = {
        x: cx - 6,
        y: midY - spec.navLinkFs,
        w: widths[i] + 12,
        h: spec.navLinkFs * 2,
      };
      cx += widths[i];

      if (i < items.length - 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
        ctx.fillText('\u00B7', cx + sepGap, linkBaseline);
        cx += sepGap * 2 + dotW;
      }
    }
  }

  // 3. Right: "Contact"
  ctx.font = `500 ${spec.navLinkFs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  const contactActive = uiState.hoveredNav === 'contact';
  ctx.fillStyle = contactActive ? 'rgba(255, 255, 255, 1.0)' : 'rgba(255, 255, 255, 0.74)';
  const contactW = measureTrackedText(ctx, 'Contact', -0.005 * spec.navLinkFs);
  const contactX = spec.blockW - spec.padX - contactW;
  fillTrackedText(ctx, 'Contact', contactX, linkBaseline, -0.005 * spec.navLinkFs);
  navHitBoxes.contact = {
    x: contactX - 8,
    y: midY - spec.navLinkFs,
    w: contactW + 16,
    h: spec.navLinkFs * 2,
  };

  return navHitBoxes;
}

export function drawSliverCanvas(canvas, sliverSpanW, sliverSpanH, viewW, hoverMix) {
  const dpr = Math.max(1.5, Math.min(window.devicePixelRatio || 2, 2.5));
  const targetW = Math.max(2, Math.round(sliverSpanW * dpr));
  const targetH = Math.max(2, Math.round(sliverSpanH * dpr));

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sliverSpanW, sliverSpanH);

  const fs = viewW < 768 ? Math.max(11, viewW * 0.0066) : viewW * 0.0066;
  ctx.font = `500 ${fs}px "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lerpRgb([255, 255, 255], [185, 171, 255], hoverMix);
  ctx.fillText('\u2190 Back', sliverSpanW * 0.5, sliverSpanH * 0.5);
}

export function syncDomLayerLayout(els, spec, navHitBoxes, paperW) {
  const { blockLayer, nav, panel } = els;
  blockLayer.style.width = `${spec.blockW}px`;
  blockLayer.style.height = `${spec.blockH}px`;

  nav.style.top = `0px`;
  nav.style.width = `${spec.blockW}px`;
  nav.style.height = `${spec.navH}px`;

  const panelTop = spec.navH + spec.navGap;
  panel.style.top = `${panelTop}px`;
  panel.style.width = `${spec.panelW}px`;
  panel.style.height = `${spec.panelH}px`;

  const applyBox = (el, box, fs) => {
    if (!el) return;
    if (!box) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${box.x}px`;
    el.style.top = `${box.y}px`;
    el.style.width = `${box.w}px`;
    el.style.height = `${box.h}px`;
    el.style.fontSize = `${fs}px`;
    el.style.lineHeight = `${box.h}px`;
  };

  applyBox(els.hitBrand, navHitBoxes.brand, spec.navBrandFs);
  applyBox(els.hitProjects, navHitBoxes.projects, spec.navLinkFs);
  applyBox(els.hitExperience, navHitBoxes.experience, spec.navLinkFs);
  applyBox(els.hitSkills, navHitBoxes.skills, spec.navLinkFs);
  applyBox(els.hitContact, navHitBoxes.contact, spec.navLinkFs);

  // Eyebrow
  els.eyebrow.style.left = `${spec.padX}px`;
  els.eyebrow.style.top = `${spec.eyebrowBaseline - spec.eyebrowFs * 0.82}px`;
  els.eyebrow.style.fontSize = `${spec.eyebrowFs}px`;
  els.eyebrow.style.letterSpacing = `${spec.eyebrowTracking}px`;
  els.eyebrow.style.lineHeight = '1';

  // Headline
  els.h1.style.left = `${spec.padX}px`;
  els.h1.style.top = `${spec.h1Line1Baseline - spec.h1Fs * 0.82}px`;
  els.h1.style.fontSize = `${spec.h1Fs}px`;
  els.h1.style.fontWeight = '500';
  els.h1.style.letterSpacing = `${spec.h1Tracking}px`;
  els.h1.style.lineHeight = '1';
  els.h1Line1.style.top = '0px';
  els.h1Line2.style.top = `${spec.h1Leading}px`;

  // Subcopy
  els.sub.style.left = `${spec.padX}px`;
  els.sub.style.top = `${spec.subLine1Baseline - spec.subFs * 0.8}px`;
  els.sub.style.fontSize = `${spec.subFs}px`;
  els.sub.style.letterSpacing = `${spec.subTracking}px`;
  els.sub.style.lineHeight = '1';
  els.subLine1.style.top = '0px';
  els.subLine2.style.top = `${spec.subLeading}px`;

  // CTAs
  els.hitOpenStudio.style.left = `${spec.pillX}px`;
  els.hitOpenStudio.style.top = `${spec.pillY}px`;
  els.hitOpenStudio.style.width = `${spec.pillW}px`;
  els.hitOpenStudio.style.height = `${spec.pillH}px`;
  els.hitOpenStudio.style.fontSize = `${spec.ctaFs}px`;
  els.hitOpenStudio.style.lineHeight = `${spec.pillH}px`;

  const paperHitH = spec.pillH;
  els.hitReadPaper.style.left = `${spec.paperX - 6}px`;
  els.hitReadPaper.style.top = `${spec.pillY}px`;
  els.hitReadPaper.style.width = `${paperW + 12}px`;
  els.hitReadPaper.style.height = `${paperHitH}px`;
  els.hitReadPaper.style.fontSize = `${spec.ctaFs}px`;
  els.hitReadPaper.style.lineHeight = `${paperHitH}px`;

  // Footer
  els.copy.style.left = `${spec.padX}px`;
  els.copy.style.top = `${spec.footerBaseline - spec.footerFs * 0.82}px`;
  els.copy.style.fontSize = `${spec.footerFs}px`;
  els.copy.style.lineHeight = '1';

  els.spec.style.right = `${spec.padX}px`;
  els.spec.style.left = 'auto';
  els.spec.style.top = `${spec.footerBaseline - spec.footerFs * 0.82}px`;
  els.spec.style.fontSize = `${spec.footerFs}px`;
  els.spec.style.lineHeight = '1';
}
