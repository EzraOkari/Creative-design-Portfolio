const PRESETS = [
  {
    id: 'smoked',
    name: 'Smoked Glass',
    color: 0x17171b,
    roughness: 0.36,
    clearcoat: 0.7,
    iridescence: 0.55,
    env: 0.42,
  },
  {
    id: 'obsidian',
    name: 'Polished Obsidian',
    color: 0x111116,
    roughness: 0.16,
    clearcoat: 0.95,
    iridescence: 0.72,
    env: 0.56,
  },
  {
    id: 'dichroic',
    name: 'Dichroic Violet',
    color: 0x1a1724,
    roughness: 0.24,
    clearcoat: 0.85,
    iridescence: 0.95,
    env: 0.62,
  },
  {
    id: 'satin',
    name: 'Frosted Charcoal',
    color: 0x1e1e24,
    roughness: 0.54,
    clearcoat: 0.45,
    iridescence: 0.38,
    env: 0.38,
  },
];

const CV_PDF_URL = '/assets/aistudio/Ezra_Okari_Digital_Artist_CV_fe994ecb.pdf';

export function createSheetController(
  sheetEl,
  innerEl,
  materialParams,
  onMaterialChange,
  callbacks
) {
  let activeTab = null;

  function close() {
    activeTab = null;
    sheetEl.hidden = true;
    innerEl.innerHTML = '';
  }

  function open(mode) {
    if (activeTab === mode && !sheetEl.hidden) {
      close();
      return;
    }
    activeTab = mode;
    sheetEl.hidden = false;

    if (mode === 'summary') {
      renderSummarySheet();
    } else if (mode === 'experience') {
      renderExperienceSheet();
    } else if (mode === 'skills') {
      renderSkillsSheet();
    } else if (mode === 'contact') {
      renderContactSheet();
    }
  }

  function renderSummarySheet() {
    innerEl.innerHTML = `
      <div class="sheet-head">
        <span class="sheet-title">Ezra Okari &mdash; Professional Summary</span>
        <button type="button" class="sheet-close" data-close>Close</button>
      </div>
      <p class="sheet-prose">
        Creative visual designer based in Kenya with a portfolio spanning graphic design, branding, social media visuals, photography, and concept-led visual projects. Focused on composition, color, typography, visual hierarchy, and digital image editing, annotation, and guideline-consistent asset variation workflows.
      </p>
      <div class="sheet-presets">
        <button type="button" class="sheet-submit" data-shatter="all">Explore Full Dossier &rarr;</button>
        <button type="button" class="sheet-preset-btn" data-open-cv>Preview CV PDF</button>
      </div>
    `;
    bindCommonActions();
  }

  function renderExperienceSheet() {
    innerEl.innerHTML = `
      <div class="sheet-head">
        <span class="sheet-title">Relevant Experience (2024 &ndash; 2026)</span>
        <button type="button" class="sheet-close" data-close>Close</button>
      </div>
      <div class="sheet-list">
        <div class="sheet-item">
          <strong>Creative Designer</strong> &middot; Freelance / Portfolio Projects &middot; 2026<br />
          Branding and visual identity concepts with disciplined composition, color systems, typography, and concept-led storytelling.
        </div>
        <div class="sheet-item">
          <strong>Social Media Designer</strong> &middot; Freelance / Portfolio Projects &middot; 2025<br />
          Brand-facing digital visual content crafted for clarity, audience engagement, and recognizable multi-format layouts.
        </div>
        <div class="sheet-item">
          <strong>Freelance Designer</strong> &middot; 2024<br />
          Concept development, layout refinement, and visual presentation across diverse creative briefs.
        </div>
      </div>
      <div class="sheet-presets">
        <button type="button" class="sheet-submit" data-shatter="experience">View in Full Dossier &rarr;</button>
        <button type="button" class="sheet-preset-btn" data-open-cv>Preview CV PDF</button>
      </div>
    `;
    bindCommonActions();
  }

  function renderSkillsSheet() {
    innerEl.innerHTML = `
      <div class="sheet-head">
        <span class="sheet-title">Core Capabilities &amp; Glass Surface Finish</span>
        <button type="button" class="sheet-close" data-close>Close</button>
      </div>
      <p class="sheet-prose">
        Graphic design &amp; composition &middot; Branding &amp; visual identity &middot; Social media &amp; promotional graphics &middot; Color, typography &amp; hierarchy &middot; Photography &amp; image selection &middot; Concept storytelling &middot; Creative direction &middot; Packaging &amp; product-visual concepts &middot; Detail-oriented review &amp; asset variation workflows.
      </p>
      <div class="sheet-presets">
        ${PRESETS.map(
          (p) =>
            `<button type="button" class="sheet-preset-btn ${
              materialParams.presetId === p.id ? 'is-active' : ''
            }" data-preset="${p.id}">${p.name}</button>`
        ).join('')}
      </div>
    `;
    bindCommonActions();

    innerEl.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = PRESETS.find((p) => p.id === btn.getAttribute('data-preset'));
        if (!preset) return;
        materialParams.presetId = preset.id;
        materialParams.color = preset.color;
        materialParams.roughness = preset.roughness;
        materialParams.clearcoat = preset.clearcoat;
        materialParams.iridescence = preset.iridescence;
        materialParams.env = preset.env;
        onMaterialChange();
        renderSkillsSheet();
      });
    });
  }

  function renderContactSheet() {
    innerEl.innerHTML = `
      <div class="sheet-head">
        <span class="sheet-title">Contact Ezra Okari &middot; Kenya</span>
        <button type="button" class="sheet-close" data-close>Close</button>
      </div>
      <p class="sheet-prose">
        Available for graphic design, branding, social media visuals, digital image editing, annotation, and visual refinement projects. References and full portfolio available on request.
      </p>
      <div class="sheet-presets">
        <a href="mailto:okariezra15@gmail.com" class="sheet-submit">Email okariezra15@gmail.com</a>
        <button type="button" class="sheet-preset-btn" data-copy="okariezra15@gmail.com">Copy Email</button>
        <button type="button" class="sheet-preset-btn" data-copy="+254 1140 597 23">Copy +254 1140 597 23</button>
        <button type="button" class="sheet-preset-btn" data-open-cv>Preview CV PDF</button>
        <a href="${CV_PDF_URL}" download="Ezra_Okari_Digital_Artist_CV.pdf" class="sheet-preset-btn">Download CV &darr;</a>
      </div>
    `;
    bindCommonActions();

    innerEl.querySelectorAll('[data-copy]').forEach((btn) => {
      const original = btn.textContent;
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-copy') || '';
        navigator.clipboard?.writeText(val).then(() => {
          btn.textContent = 'Copied';
          btn.classList.add('is-active');
          window.setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('is-active');
          }, 1600);
        });
      });
    });
  }

  function bindCommonActions() {
    innerEl.querySelector('[data-close]')?.addEventListener('click', close);
    innerEl.querySelector('[data-open-cv]')?.addEventListener('click', () => {
      close();
      callbacks?.onOpenCvModal?.();
    });
    innerEl.querySelectorAll('[data-shatter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-shatter') || 'all';
        close();
        callbacks?.onShatterToSection?.(tab);
      });
    });
  }

  return { open, close };
}
