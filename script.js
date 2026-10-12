'use strict';
// Sound-to-Binary Converter core
const form = document.getElementById('converter-form');
const errorsBox = document.getElementById('errors');
const freqEl = document.getElementById('freq');
const ampEl = document.getElementById('amplitude');
const nEl = document.getElementById('samples');
const bEl = document.getElementById('bits');
const body = document.getElementById('results-body');
const emptyNote = document.getElementById('table-empty');
const factA = document.getElementById('fact-amplitude');
const factF = document.getElementById('fact-frequency');
const factT = document.getElementById('fact-period');
const factW = document.getElementById('fact-wavelength');
const seqEl = document.getElementById('binary-sequence');
const totalEl = document.getElementById('total-bits');
const canvas = document.getElementById('waveCanvas');
const holder = canvas ? canvas.parentElement : null;
let lastWave = { A: 1, n: 4 };
let wavePhase = 0;
let wavePlaying = true;
let audioCtx = null;
let tonePlaying = false;
function periodMs(f) { return 1000 / f; }
function waveM(f) { return 343 / f; }
function fmtPeriod(ms) { return ms.toFixed(2) + ' ms'; }
function fmtWave(m) {
  if (m >= 1) return m.toFixed(2) + ' m';
  return (m * 100).toFixed(1) + ' cm';
}
function setStatus(msg) {
  const s = document.getElementById('playStatus');
  if (s) s.textContent = msg;
}
function validate(f, A, n, b) {
  const errs = [];
  if (!Number.isFinite(f) || !(f > 0)) errs.push('Frequency must be greater than 0.');
  if (!Number.isFinite(A) || !(A >= 0 && A <= 1)) errs.push('Amplitude must be between 0 and 1.');
  if (!Number.isInteger(n) || n < 2 || n > 64) errs.push('Samples must be a whole number from 2 to 64.');
  if (!Number.isInteger(b) || b < 1 || b > 8) errs.push('Bits must be a whole number from 1 to 8.');
  return errs;
}
function clearResults() {
  body.innerHTML = '';
  factA.textContent = '—';
  factF.textContent = '—';
  factT.textContent = '—';
  factW.textContent = '—';
  seqEl.textContent = '—';
  totalEl.textContent = '—';
  if (emptyNote) emptyNote.style.display = '';
}
// PART2
function drawWave(A, n) {
  if (!canvas || !holder) return;
  lastWave = { A: A, n: n };
  let cssW = holder.clientWidth || 0;
  if (!cssW || cssW < 50) {
    cssW = 600;
    if (window.innerWidth) cssW = Math.min(window.innerWidth - 80, 800);
    if (cssW < 280) cssW = 280;
  }
  const cssH = Math.max(180, Math.round(cssW * 260 / 800));
  let dpr = window.devicePixelRatio || 1;
  if (dpr > 3) dpr = 3;
  const W = 800;
  const H = 260;
  const mid = H / 2;
  const needW = Math.round(cssW * dpr);
  const needH = Math.round(cssH * dpr);
  if (canvas.width !== needW || canvas.height !== needH) {
    canvas.width = needW;
    canvas.height = needH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(154,179,197,.10)';
  for (let gx = 0; gx <= W; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
  }
  for (let gy = 0; gy <= H; gy += 26) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
  const ampPx = A * 0.82 * mid;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(101,230,224,.35)';
  ctx.beginPath(); ctx.moveTo(0, mid - ampPx); ctx.lineTo(W, mid - ampPx); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, mid + ampPx); ctx.lineTo(W, mid + ampPx); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(241,247,251,.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
  ctx.strokeStyle = '#65E6E0';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(101,230,224,.55)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const t = x / W;
    const y = mid - ampPx * Math.sin(2 * Math.PI * t + wavePhase);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = '700 11px Consolas, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const x = t * W;
    const y = mid - ampPx * Math.sin(2 * Math.PI * t + wavePhase);
    ctx.strokeStyle = 'rgba(101,230,224,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, H - 8); ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#13B8A6';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const label = 'S' + (i + 1);
    let ly = y - 14;
    if (y - 18 < 12) ly = y + 22;
    ctx.fillStyle = '#65E6E0';
    ctx.fillText(label, x, ly);
  }
  ctx.fillStyle = 'rgba(154,179,197,.9)';
  ctx.textAlign = 'left';
  ctx.fillText('+A', 8, mid - ampPx - 8);
  ctx.fillText('-A', 8, mid + ampPx + 16);
}
// PART3
function doConvert() {
  const fRaw = freqEl.value.trim();
  const aRaw = ampEl.value.trim();
  const f = Number(fRaw);
  const A = Number(aRaw);
  const n = Number(nEl.value);
  const b = Number(bEl.value);
  const errs = validate(f, A, n, b);
  if (errs.length) {
    errorsBox.hidden = false;
    errorsBox.textContent = 'Please fix: ' + errs.join(' ');
    clearResults();
    return;
  }
  errorsBox.hidden = true;
  errorsBox.textContent = '';
  const Tms = periodMs(f);
  const lam = waveM(f);
  const levels = Math.pow(2, b);
  factA.textContent = aRaw;
  factF.textContent = fRaw + ' Hz';
  factT.textContent = fmtPeriod(Tms);
  factW.textContent = fmtWave(lam);
  body.innerHTML = '';
  const seq = [];
  for (let i = 0; i < n; i++) {
    const time = i * Tms / n;
    const h = A * Math.sin(2 * Math.PI * i / n);
    const level = Math.round(((h + 1) / 2) * (levels - 1));
    const bin = level.toString(2).padStart(b, '0');
    seq.push(bin);
    const tr = document.createElement('tr');
    const c1 = document.createElement('td');
    c1.textContent = String(i + 1);
    const c2 = document.createElement('td');
    c2.textContent = time.toFixed(2);
    const c3 = document.createElement('td');
    c3.textContent = h.toFixed(2);
    const c4 = document.createElement('td');
    c4.textContent = String(level);
    const c5 = document.createElement('td');
    c5.textContent = bin;
    tr.appendChild(c1);
    tr.appendChild(c2);
    tr.appendChild(c3);
    tr.appendChild(c4);
    tr.appendChild(c5);
    body.appendChild(tr);
  }
  if (emptyNote) emptyNote.style.display = 'none';
  seqEl.textContent = seq.join(' ');
  totalEl.textContent = String(n * b);
  drawWave(A, n);
}
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    doConvert();
  });
}
// PART4
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
  resetBtn.addEventListener('click', function () {
    freqEl.value = '1000';
    ampEl.value = '1';
    nEl.value = '4';
    bEl.value = '2';
    errorsBox.hidden = true;
    errorsBox.textContent = '';
    clearResults();
    setStatus('Press Play to hear the tone. Turn your volume down first.');
    drawWave(1, 4);
  });
}
const copyBtn = document.getElementById('copy-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', function () {
    const t = seqEl.textContent.trim();
    if (!t || t === '—') {
      copyBtn.textContent = 'NOTHING TO COPY';
      setTimeout(function () { copyBtn.textContent = 'COPY BINARY'; }, 1200);
      return;
    }
    copyBtn.textContent = 'COPIED!';
    setTimeout(function () { copyBtn.textContent = 'COPY BINARY'; }, 1200);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t);
    }
  });
}
const presets = document.querySelectorAll('.preset');
for (let p = 0; p < presets.length; p++) {
  (function (btn) {
    btn.addEventListener('click', function () {
      const parts = (btn.getAttribute('data-preset') || '').split(',');
      if (parts.length === 4) {
        freqEl.value = parts[0];
        ampEl.value = parts[1];
        nEl.value = parts[2];
        bEl.value = parts[3];
        doConvert();
      }
    });
  })(presets[p]);
}
const playBtn = document.getElementById('play-btn');
if (playBtn) {
  playBtn.addEventListener('click', function () {
    if (tonePlaying) return;
    const f = Number(freqEl.value);
    if (!(f > 0)) {
      errorsBox.hidden = false;
      errorsBox.textContent = 'Warning: Frequency must be greater than 0 to play.';
      return;
    }
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      let ampIn = Number(ampEl.value);
      if (!(ampIn >= 0)) ampIn = 0;
      if (ampIn > 1) ampIn = 1;
      let peak = 0.3 * ampIn;
      if (peak < 0.0001) peak = 0.0001;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, audioCtx.currentTime);
      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.setValueAtTime(peak, t + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      tonePlaying = true;
      osc.start(t);
      osc.stop(t + 1.05);
      setStatus('Playing ' + f + ' Hz for 1 second...');
      osc.onended = function () {
        tonePlaying = false;
        setStatus('Done. Press Play to hear it again.');
      };
    } catch (e) {
      errorsBox.hidden = false;
      errorsBox.textContent = 'Warning: Audio is not supported in this browser.';
    }
  });
}
let resizeTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { drawWave(lastWave.A, lastWave.n); }, 120);
});
function tick() {
  if (wavePlaying && !document.hidden) {
    wavePhase += 0.09;
    drawWave(lastWave.A, lastWave.n);
  }
  requestAnimationFrame(tick);
}
try {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    wavePlaying = false;
  }
} catch (e) {}
const animBtn = document.getElementById('anim-btn');
function syncAnimBtn() {
  if (!animBtn) return;
  animBtn.textContent = wavePlaying ? 'Pause animation' : 'Play animation';
  animBtn.setAttribute('aria-pressed', wavePlaying ? 'true' : 'false');
}
if (animBtn) {
  animBtn.addEventListener('click', function () {
    wavePlaying = !wavePlaying;
    if (wavePlaying) drawWave(lastWave.A, lastWave.n);
    syncAnimBtn();
  });
  syncAnimBtn();
}
drawWave(1, 4);
tick();
doConvert();
