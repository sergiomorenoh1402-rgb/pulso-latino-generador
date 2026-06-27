const $ = (id) => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let state = {
  headline: 'Aquí va el titular de la noticia que va a enganchar al lector',
  tag: 'ÚLTIMA HORA',
  name: 'Pulso Latino',
  logo: 'pulse',    // 'pulse' = ícono de latido; o iniciales (texto)
  color: '#e11d2a',
  img: null,        // HTMLImageElement
  w: 1080, h: 1080,
};

// ---------- DIBUJO DE LA IMAGEN ----------
function draw() {
  canvas.width = state.w; canvas.height = state.h;
  const { width: W, height: H } = canvas;

  // fondo
  if (state.img) {
    coverImage(state.img, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a1f2b'); g.addColorStop(1, '#0b0d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // degradado oscuro abajo para legibilidad
  const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  const pad = Math.round(W * 0.055);

  // barra de marca (arriba)
  ctx.fillStyle = state.color;
  const lh = Math.round(W * 0.072);
  roundRect(pad, pad, lh, lh, 14); ctx.fill();
  ctx.fillStyle = '#fff';
  if (state.logo === 'pulse') {
    drawPulse(pad, pad, lh);
  } else {
    ctx.font = `800 ${Math.round(lh * 0.42)}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.logo, pad + lh / 2, pad + lh / 2 + 2);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(W * 0.038)}px Segoe UI, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(state.name, pad + lh + 18, pad + lh * 0.66);

  // etiqueta
  if (state.tag.trim()) {
    const ty = H - pad - titleBlockHeight() - Math.round(W * 0.085); // calcular ANTES (cambia la fuente internamente)
    const txt = state.tag.toUpperCase();
    const fs = Math.round(W * 0.032);
    ctx.font = `800 ${fs}px Segoe UI, sans-serif`;       // fijar fuente de etiqueta DESPUÉS
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const padX = Math.round(W * 0.022);
    const boxH = Math.round(fs * 1.6);
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = state.color;
    roundRect(pad, ty, tw + padX * 2, boxH, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, pad + padX, ty + boxH / 2 + Math.round(fs * 0.06));
    ctx.textBaseline = 'alphabetic';
  }

  // titular
  drawTitle();
}

function titleFont() { return Math.round(state.w * 0.062); }
function titleLines() {
  const maxW = state.w - state.w * 0.11;
  ctx.font = `800 ${titleFont()}px Segoe UI, sans-serif`;
  return wrap(state.headline, maxW);
}
function titleBlockHeight() {
  const lines = titleLines();
  return lines.length * titleFont() * 1.16;
}
function drawTitle() {
  const W = state.w, H = state.h, pad = Math.round(W * 0.055);
  const fs = titleFont();
  ctx.font = `800 ${fs}px Segoe UI, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  const lines = titleLines();
  let y = H - pad - (lines.length - 1) * fs * 1.16;
  for (const ln of lines) { ctx.fillText(ln, pad, y); y += fs * 1.16; }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

function wrap(text, maxW) {
  const words = text.split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function coverImage(img, W, H) {
  const r = Math.max(W / img.width, H / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
function drawPulse(x, y, box) {
  // línea de electrocardiograma (latido) centrada en la caja del logo
  const cx = x, cy = y + box / 2;
  const w = box, p = box * 0.16;
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(3, box * 0.07);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + p, cy);
  ctx.lineTo(x + w * 0.34, cy);
  ctx.lineTo(x + w * 0.44, cy - box * 0.26);
  ctx.lineTo(x + w * 0.56, cy + box * 0.28);
  ctx.lineTo(x + w * 0.66, cy);
  ctx.lineTo(x + w - p, cy);
  ctx.stroke();
  ctx.restore();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- FEED ----------
let currentCat = 'cuba';
let allItems = [];
async function loadFeed(cat) {
  currentCat = cat;
  $('feedList').innerHTML = '<p class="muted">Cargando titulares…</p>';
  try {
    const r = await fetch('/api/feed?cat=' + cat);
    const { items } = await r.json();
    allItems = items || [];
    // poblar el filtro de fuentes (en orden de aparición)
    const sources = [...new Set(allItems.map((it) => it.source).filter(Boolean))];
    const sel = $('srcFilter'); const cur = sel.value;
    sel.innerHTML = '<option value="">Todas las fuentes</option>' +
      sources.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    if (sources.includes(cur)) sel.value = cur;
    renderFeed();
  } catch (e) {
    $('feedList').innerHTML = '<p class="muted">Error al cargar. ¿Está corriendo el servidor?</p>';
  }
}
function renderFeed() {
  const src = $('srcFilter').value;
  const list = src ? allItems.filter((it) => it.source === src) : allItems;
  if (!list.length) { $('feedList').innerHTML = '<p class="muted">No hay titulares para esta fuente.</p>'; return; }
  $('feedList').innerHTML = '';
  for (const it of list) {
    const d = document.createElement('div');
    d.className = 'news';
    const ago = timeAgo(it.pubDate);
    const fresh = freshClass(it.pubDate);
    d.innerHTML = `<div class="t">${escapeHtml(it.title)}</div><div class="s">${escapeHtml(it.source || '')}${it.google ? ' · 🔎' : ''}${ago ? ` · <span class="ago ${fresh}">${ago}</span>` : ''}</div>`;
    d.onclick = () => pickNews(it);
    $('feedList').appendChild(d);
  }
}
async function pickNews(it) {
  // reiniciar todo lo de la noticia anterior
  state.headline = it.title;
  state.source = it.source || '';
  state.sourceLink = it.link || '';
  state.tag = 'ÚLTIMA HORA';
  state.img = null;
  $('headline').value = it.title;
  $('caption').value = it.title + '\n\nFuente: ' + (it.source || '') + '\n\n#Cuba #Noticias';
  $('tag').value = 'ÚLTIMA HORA';
  $('body').value = '';
  $('bodyState').textContent = '';
  $('pubState').textContent = '';
  $('aiState').textContent = '';
  $('imgState').textContent = '';
  const meta = $('newsMeta');
  if (meta) {
    const ago = timeAgo(it.pubDate), fc = freshClass(it.pubDate);
    meta.innerHTML = `<span class="src">${escapeHtml(it.source || '')}</span>` +
      (it.pubDate ? ` <span class="ago ${fc}">${ago}</span> <span class="muted">· ${fullDate(it.pubDate)}</span>` : '');
  }
  draw();
  // foto: si el RSS ya la trae, usarla; si es de medio directo, sacarla del artículo; si es de Google, pedir manual
  if (it.img) { $('imgState').textContent = 'Cargando foto…'; setImageFromUrl('/api/imgproxy?src=' + encodeURIComponent(it.img)); }
  else if (it.link) { $('imgState').textContent = it.google ? 'Decodificando y buscando foto…' : 'Buscando foto de la noticia…'; loadOg(it.link); }
}

function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return 'hace ' + Math.max(1, Math.round(s / 60)) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  return 'hace ' + Math.round(s / 86400) + ' d';
}
function freshClass(d) {
  if (!d) return '';
  const h = (Date.now() - new Date(d)) / 3600000;
  if (h < 3) return 'f-hot';    // recién salida
  if (h < 24) return 'f-ok';    // de hoy
  return 'f-old';               // vieja
}
function fullDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
async function loadOg(link) {
  try {
    const r = await fetch('/api/og?url=' + encodeURIComponent(link));
    const { image } = await r.json();
    if (image) { setImageFromUrl('/api/imgproxy?src=' + encodeURIComponent(image)); }
    else $('imgState').textContent = 'La noticia no tiene foto — sube una manual.';
  } catch { $('imgState').textContent = 'No se pudo traer la foto.'; }
}

// ---------- IMAGEN ----------
function setImageFromUrl(url) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { state.img = img; $('imgState').textContent = 'Foto cargada ✓'; draw(); };
  img.onerror = () => { $('imgState').textContent = 'No se pudo cargar la foto.'; };
  img.src = url;
}

// ---------- IA ----------
async function aiRewrite() {
  const t = $('headline').value.trim();
  if (!t) return;
  $('aiState').textContent = 'Pensando…';
  try {
    const r = await fetch('/api/rewrite?t=' + encodeURIComponent(t));
    const j = await r.json();
    if (j.headline) { state.headline = j.headline; $('headline').value = j.headline; }
    if (j.caption) $('caption').value = j.caption;
    $('aiState').textContent = j.ai ? 'Listo ✓ (IA)' : 'IA apagada — define la API key';
    draw();
  } catch { $('aiState').textContent = 'Error'; }
}

// ---------- PUBLICAR EN LA WEB ----------
const CAT_LABELS = { cuba:'Cuba', migracion:'Migración', latinos:'Latinos/USA', farandula:'Farándula', sucesos:'Sucesos', economia:'Economía', deportes:'Deportes', mundo:'Mundo' };
function photoDataURL() {
  // exporta la FOTO (no la imagen branded) a tamaño natural para usar de portada
  if (!state.img) return '';
  try {
    const c = document.createElement('canvas');
    c.width = state.img.naturalWidth || state.img.width;
    c.height = state.img.naturalHeight || state.img.height;
    c.getContext('2d').drawImage(state.img, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  } catch { return ''; }
}
async function publish() {
  const title = ($('headline').value || '').trim();
  if (!title) { $('pubState').textContent = 'Falta el titular'; return; }
  $('pubState').textContent = 'Publicando…';
  try {
    const r = await fetch('/api/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body: $('body').value || '',
        category: CAT_LABELS[currentCat] || 'Noticia',
        source: state.source || '',
        sourceUrl: state.sourceLink || '',
        imageData: photoDataURL(),
      }),
    });
    const j = await r.json();
    if (j.ok) {
      const url = 'https://pulso-latino.netlify.app/n/' + j.slug + '.html';
      const comment = `${title}\n\n👉 Más información aquí:\n${url}`;
      $('pubState').innerHTML = `✓ Publicada · comentario listo para Facebook:` +
        `<textarea id="pubComment" readonly rows="4" style="width:100%;margin-top:6px">${escapeHtml(comment)}</textarea>` +
        `<button type="button" id="copyComment" class="primary">📋 Copiar comentario</button>` +
        ` <small class="muted">Pégalo en el primer comentario del post (~1 min en estar online).</small>`;
      const cc = document.getElementById('copyComment');
      if (cc) cc.onclick = () => { const f = document.getElementById('pubComment'); f.select(); navigator.clipboard.writeText(comment); cc.textContent = '✓ Copiado'; setTimeout(() => cc.textContent = '📋 Copiar comentario', 1500); };
    } else $('pubState').textContent = 'Error al publicar';
  } catch { $('pubState').textContent = 'Error (¿servidor corriendo?)'; }
}

// ---------- UTILS ----------
function escapeHtml(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// ---------- EVENTOS ----------
$('headline').oninput = (e) => { state.headline = e.target.value || ' '; draw(); };
$('tag').oninput = (e) => { state.tag = e.target.value; draw(); };
$('aiBtn').onclick = aiRewrite;
$('useOg').onclick = () => alert('Elige primero una noticia del feed; la foto se trae sola. O sube una foto manual.');
$('copyCap').onclick = () => { navigator.clipboard.writeText($('caption').value); $('copyCap').textContent = '✓ Copiado'; setTimeout(()=>$('copyCap').textContent='📋 Copiar caption',1500); };
$('file').onchange = (e) => { const f = e.target.files[0]; if (f) setImageFromUrl(URL.createObjectURL(f)); };
$('refresh').onclick = () => loadFeed(currentCat);
$('srcFilter').onchange = renderFeed;
$('publishBtn').onclick = publish;
$('genBody').onclick = genBody;
async function genBody() {
  if (!state.sourceLink) { $('bodyState').textContent = 'Elige una noticia del feed primero'; return; }
  $('bodyState').textContent = 'Generando con IA…';
  try {
    const r = await fetch('/api/body?url=' + encodeURIComponent(state.sourceLink) + '&t=' + encodeURIComponent($('headline').value || ''));
    const j = await r.json();
    if (j.body) { $('body').value = j.body; $('bodyState').textContent = j.ai ? '✓ Generado (revísalo)' : '⚠ Extracto sin IA (revisa)'; }
    else $('bodyState').textContent = 'No se pudo generar';
  } catch { $('bodyState').textContent = 'Error (¿servidor corriendo?)'; }
}
$('download').onclick = () => {
  const a = document.createElement('a');
  a.download = (state.name.replace(/\s+/g,'_') || 'post') + '_' + Date.now() + '.png';
  a.href = canvas.toDataURL('image/png'); a.click();
};
document.querySelectorAll('.cat').forEach(b => b.onclick = () => {
  document.querySelectorAll('.cat').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); loadFeed(b.dataset.cat);
});
// branding
$('setName').oninput = (e)=>{ state.name=e.target.value; $('brandName').textContent=e.target.value; draw(); };
const PULSE_SVG = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,13 9,13 11,6 15,19 17,13 22,13"/></svg>';
$('setLogo').onchange = (e)=>{ state.logo=e.target.value; if(e.target.value==='pulse'){$('brandLogo').innerHTML=PULSE_SVG}else{$('brandLogo').textContent=e.target.value}; draw(); };
$('setColor').oninput = (e)=>{ state.color=e.target.value; document.documentElement.style.setProperty('--brand',e.target.value); draw(); };
$('setRatio').onchange = (e)=>{ const [w,h]=e.target.value.split('x').map(Number); state.w=w; state.h=h; draw(); };

// init — soporta overrides por query (?c=color&n=nombre&cat=categoria) para previsualizar
const params = new URLSearchParams(location.search);
if (params.get('c')) { state.color = '#' + params.get('c').replace('#', ''); document.documentElement.style.setProperty('--brand', state.color); $('setColor').value = state.color; }
if (params.get('n')) { state.name = params.get('n'); $('brandName').textContent = state.name; $('setName').value = state.name; }
draw();
const startCat = location.hash.startsWith('#auto=') ? location.hash.slice(6) : (params.get('cat') || 'cuba');
loadFeed(startCat).then(() => {
  if (location.hash.startsWith('#auto') || params.get('auto')) {
    const first = document.querySelector('.news');
    if (first) first.click();
  }
});
