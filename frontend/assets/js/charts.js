// KREDT — charts.js
// Small dependency-free SVG charts for the analyst dashboard. Each function
// returns an HTML string (matching how the rest of the app renders), so there
// is no CDN or build step. Colours come from the CSS tokens in base.css.

const KredtCharts = (() => {
  const E = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // One colour per application status, kept in the navy / teal family.
  const STATUS_COLORS = {
    submitted: '#9DB5D3',
    under_review: '#4F73A3',
    investigation_in_progress: '#0F9D8A',
    investigation_complete: '#142D4E',
    additional_info_requested: '#E0A43B',
    decided: '#7CCBBE',
  };

  // Round a maximum up to a tidy axis value (1, 2, 4, 5, 6, 8, 10 ...).
  function niceMax(v) {
    if (v <= 4) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  // ---------- Donut ----------
  // data: [{ label, value, color }]
  function donut({ data, centerLabel = 'total' }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return '<div class="chart-empty">No data yet.</div>';
    const R = 64, C = 2 * Math.PI * R, GAP = data.filter((d) => d.value).length > 1 ? 3 : 0;
    let acc = 0;
    const segs = data.filter((d) => d.value > 0).map((d, i) => {
      const len = (d.value / total) * C;
      const seg = `<circle class="donut-seg" cx="80" cy="80" r="${R}" fill="none" stroke="${d.color}" stroke-width="18"
        stroke-dasharray="${Math.max(len - GAP, 0.5)} ${C}" stroke-dashoffset="${-acc}" style="animation-delay:${i * 90}ms"><title>${E(d.label)}: ${d.value}</title></circle>`;
      acc += len;
      return seg;
    }).join('');
    const legend = data.map((d) => `
      <li class="legend-row ${d.value ? '' : 'is-zero'}">
        <span class="legend-dot" style="background:${d.color}"></span>
        <span class="legend-label">${E(d.label)}</span>
        <span class="legend-value">${d.value}</span>
        <span class="legend-pct">${Math.round((d.value / total) * 100)}%</span>
      </li>`).join('');
    return `
      <div class="donut-wrap">
        <div class="donut-figure">
          <svg viewBox="0 0 160 160" role="img" aria-label="Applications by status">
            <circle cx="80" cy="80" r="${R}" fill="none" stroke="#EEF2F7" stroke-width="18"/>
            <g transform="rotate(-90 80 80)">${segs}</g>
          </svg>
          <div class="donut-center"><strong>${total}</strong><span>${E(centerLabel)}</span></div>
        </div>
        <ul class="legend">${legend}</ul>
      </div>`;
  }

  // ---------- Vertical bars ----------
  // data: [{ label, value }]; the last bar is emphasised (teal).
  function bars({ data, height = 220, valueLabel = (v) => v }) {
    const W = 520, H = height, padL = 34, padR = 8, padT = 22, padB = 30;
    const max = niceMax(Math.max(...data.map((d) => d.value), 1));
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const slot = innerW / data.length, bw = Math.min(44, slot * 0.56);
    const y = (v) => padT + innerH - (v / max) * innerH;

    const ticks = [0, max / 2, max].map((t) => `
      <line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="${t === 0 ? 'axis-base' : 'axis-grid'}"/>
      <text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" class="axis-text">${Math.round(t)}</text>`).join('');

    const cols = data.map((d, i) => {
      const x = padL + slot * i + (slot - bw) / 2;
      const h = Math.max((d.value / max) * innerH, d.value ? 3 : 0);
      const last = i === data.length - 1;
      return `
        <g class="bar-col">
          <rect class="bar ${last ? 'is-emphasis' : ''}" x="${x}" y="${padT + innerH - h}" width="${bw}" height="${h}" rx="6" style="animation-delay:${i * 70}ms"><title>${E(d.label)}: ${valueLabel(d.value)}</title></rect>
          ${d.value ? `<text x="${x + bw / 2}" y="${padT + innerH - h - 7}" text-anchor="middle" class="bar-value">${valueLabel(d.value)}</text>` : ''}
          <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis-text">${E(d.label)}</text>
        </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Applications received per month">${ticks}${cols}</svg>`;
  }

  // ---------- Histogram ----------
  // values: numbers; binSize in the same unit. formatEdge turns an edge value into an axis label.
  function histogram({ values, binSize, formatEdge, height = 220 }) {
    if (!values.length) return '<div class="chart-empty">No data yet.</div>';
    const maxVal = Math.max(...values);
    const binCount = Math.max(Math.ceil((maxVal + 1) / binSize), 3);
    const counts = Array.from({ length: binCount }, () => 0);
    values.forEach((v) => { counts[Math.min(Math.floor(v / binSize), binCount - 1)] += 1; });

    const W = 520, H = height, padL = 34, padR = 8, padT = 22, padB = 34;
    const max = niceMax(Math.max(...counts, 1));
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const bw = innerW / binCount;
    const y = (v) => padT + innerH - (v / max) * innerH;

    const ticks = [0, max / 2, max].map((t) => `
      <line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="${t === 0 ? 'axis-base' : 'axis-grid'}"/>
      <text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" class="axis-text">${Math.round(t)}</text>`).join('');

    const cols = counts.map((n, i) => {
      const h = Math.max((n / max) * innerH, n ? 3 : 0);
      const x = padL + bw * i;
      return `
        <rect class="bar is-hist" x="${x + 1.5}" y="${padT + innerH - h}" width="${bw - 3}" height="${h}" rx="4" style="animation-delay:${i * 60}ms"><title>${formatEdge(i * binSize)} – ${i === binCount - 1 ? 'and above' : formatEdge((i + 1) * binSize)}: ${n}</title></rect>
        ${n ? `<text x="${x + bw / 2}" y="${padT + innerH - h - 7}" text-anchor="middle" class="bar-value">${n}</text>` : ''}`;
    }).join('');

    const edges = counts.map((_, i) => `<text x="${padL + bw * i}" y="${H - 10}" text-anchor="middle" class="axis-text">${formatEdge(i * binSize)}</text>`).join('')
      + `<text x="${W - padR}" y="${H - 10}" text-anchor="end" class="axis-text">${formatEdge(binCount * binSize)}+</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="Distribution of requested amounts">${ticks}${cols}${edges}</svg>`;
  }

  return { donut, bars, histogram, STATUS_COLORS };
})();

window.KredtCharts = KredtCharts;
