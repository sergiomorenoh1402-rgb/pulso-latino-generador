// NoticiasCuba - servidor sin dependencias (Node 24+)
// Sirve la app y provee: feed de noticias (Google News RSS), og:image y reescritura IA opcional.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5050;
const PUBLIC = path.join(__dirname, 'public');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY ||
  (fs.existsSync(path.join(__dirname, 'gemini.key')) ? fs.readFileSync(path.join(__dirname, 'gemini.key'), 'utf8').trim() : '');
// Para hosting en la nube:
const GEN_PASS = process.env.GEN_PASS || '';                              // contraseña de acceso (vacía = sin login, local)
const GH_TOKEN = process.env.GITHUB_TOKEN || '';                          // token para publicar vía API (en la nube)
const GH_OWNER = process.env.GH_OWNER || 'sergiomorenoh1402-rgb';
const GH_REPO = process.env.GH_REPO || 'pulso-latino-web';

// --- Fuentes: medios INDEPENDIENTES / opositores (NO oficialistas) ---
const FEEDS = [
  { name: 'Martí Noticias', url: 'https://www.martinoticias.com/api/z_uqvl-vomx-tpevipt' },
  { name: 'Martí Cuba', url: 'https://www.martinoticias.com/api/z_bol-vomx-tpevvii' },
  { name: 'CiberCuba', url: 'https://www.cibercuba.com/rss.xml' },
  { name: 'Diario de Cuba', url: 'https://diariodecuba.com/rss.xml' },
  { name: 'Periódico Cubano', url: 'https://www.periodicocubano.com/feed/' },
  { name: 'Cuba en Miami', url: 'https://www.cubaenmiami.com/feed/' },
  { name: 'Café Fuerte', url: 'https://cafefuerte.com/feed/' },
  { name: 'elTOQUE', url: 'https://eltoque.com/feed' },
  { name: 'Mario Pentón', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNnAyfKpcz1BnleJzWV6DxQ' },
  { name: 'Javier Díaz', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqqzsAwhEWme1wU9avuRXLg' },
  { name: 'Daniel Benítez', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCu6mWAqzi9UP_is66tAuOyA' },
];

// Fuentes INTERNACIONALES extra, solo para categorías de nicho (ya vienen "on-topic", no se filtran)
const CAT_FEEDS = {
  deportes: [
    { name: 'Marca', url: 'https://www.marca.com/rss/portada.xml' },
    { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/rss/home.xml' },
    { name: 'Olé', url: 'https://www.ole.com.ar/rss/ultimas-noticias/' },
  ],
  farandula: [
    { name: 'El País Gente', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/gente/portada' },
    { name: '20minutos Gente', url: 'https://www.20minutos.es/rss/gente-television/' },
    { name: 'Marca Tiramillas', url: 'https://www.marca.com/rss/tiramillas.xml' },
  ],
};

// Filtros por categoría (palabras clave en el titular) para los medios directos
const CAT_FILTERS = {
  cuba: null, // todo
  migracion: /migra|estados unidos|eeuu|ee\.uu|visa|frontera|balser|deport|asilo|parole|aduana/i,
  farandula: /far[áa]ndula|cantante|actor|actriz|m[úu]sic|reggaeton|artista|influencer|youtuber|telenovela|concierto|cine|pel[íi]cula|famos|celebr|novela|miss|belleza|gala|premio/i,
  sucesos: /muert|fallec|accidente|detenid|polic|crimen|asesinat|incendio|derrumbe|robo|violencia|herido|desaparec/i,
  economia: /dólar|dolar|peso|mlc|precio|econom|inflaci|salario|mercado|divisa|combustible|apag|tarea ordenamiento/i,
  latinos: /latino|hispano|inmigra|migra|deport(a|aci)|\btps\b|parole|visa|frontera|redada|\bice\b|indocumentad|asilo|residencia|green card|ciudadan/i,
  deportes: /deporte|b[ée]isbol|pelota|pelotero|boxe|f[úu]tbol|atleta|ol[íi]mpic|gimnas|voleibol|baloncesto|\bmlb\b|grandes ligas|medalla|campeonato|selecci[óo]n|judo|lucha libre/i,
  mundo: /internacional|mundial|\bmundo\b|guerra|rusia|ucrania|china|europa|israel|gaza|ir[áa]n|venezuela|estados unidos|\beeuu\b|trump|putin|\bonu\b|\botan\b|elecciones|cumbre|geopol[íi]tic|conflicto/i,
};

// Refuerzo Google News por categoría (trae titulares aunque los medios no tengan; la foto se sube manual)
const GOOGLE_Q = {
  cuba: 'Cuba', migracion: 'cubanos migración Estados Unidos', farandula: 'farándula cubana artista cantante',
  sucesos: 'Cuba sucesos', economia: 'Cuba economía dólar',
  latinos: 'inmigración latinos Estados Unidos (deportación OR parole OR TPS OR visa OR redada)',
  deportes: 'deporte Cuba (béisbol OR pelota OR boxeo OR fútbol OR peloteros Grandes Ligas)',
  mundo: 'noticias internacionales política mundial (Estados Unidos OR Europa OR guerra OR China OR Rusia)',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(body);
}

// --- Parser RSS/Atom minimalista (regex, sin libs) — entiende <item> y <entry> (YouTube) ---
function parseRSS(xml, source, isGoogle) {
  const items = [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i).slice(1);
  for (const b of blocks) {
    const get = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    };
    let title = get('title');
    // link: RSS=<link>texto</link> ; Atom(YouTube)=<link rel="alternate" href="...">
    let link = get('link');
    if (!link || isAtom) { const lm = b.match(/<link[^>]+href=["']([^"']+)["']/i); if (lm) link = lm[1]; }
    const pubDate = get('pubDate') || get('published') || get('updated');
    // imagen incrustada — PRIORIDAD: media:thumbnail (la imagen real en YouTube) > enclosure > media:content tipo imagen
    const mThumb = b.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    const mEncl = b.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    const mContent = b.match(/<media:content[^>]+type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i)
      || b.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i);
    let img = (mThumb && mThumb[1]) || (mEncl && mEncl[1]) || (mContent && mContent[1]) || '';
    if (/youtube\.com\/v\/|\.swf(\?|$)/i.test(img)) img = ''; // descartar URLs de video, no de imagen
    if (img.includes('ytimg.com')) img = img.replace(/\/(hq|mq|sd|default)default\.jpg/i, '/maxresdefault.jpg'); // YouTube en alta
    let src = source;
    if (isGoogle) {
      // Google News pone "Titular - Medio" y sus fotos no sirven (se decodifican aparte)
      const dash = title.lastIndexOf(' - ');
      if (dash > 0) { src = title.slice(dash + 3); title = title.slice(0, dash); }
      img = '';
    }
    if (title) items.push({ title: decodeEntities(title), link, source: src, pubDate, img, google: !!isGoogle });
  }
  return items;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

async function fetchFeed(cat) {
  const filt = CAT_FILTERS[cat];
  // 1) medios directos (foto real) + fuentes internacionales de la categoría (on-topic, sin filtrar)
  const extra = (CAT_FEEDS[cat] || []).map((f) => ({ ...f, onTopic: true }));
  const jobs = FEEDS.concat(extra).map(async (f) => {
    const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    let items = parseRSS(await r.text(), f.name, false);
    if (filt && !f.onTopic) items = items.filter((it) => filt.test(it.title));
    return items.slice(0, 25);
  });
  // 2) refuerzo Google News (titulares; foto manual)
  jobs.push((async () => {
    const q = GOOGLE_Q[cat] || 'Cuba';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=US&ceid=US:es-419`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    return parseRSS(await r.text(), '', true).slice(0, 20);
  })());

  const results = await Promise.allSettled(jobs);
  let media = [], goog = [];
  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    for (const it of res.value) (it.google ? goog : media).push(it);
  }
  const byDate = (a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
  media.sort(byDate); goog.sort(byDate);
  // medios primero (foto real), Google de refuerzo después
  let all = media.concat(goog);
  // dedup por titular
  const seen = new Set();
  all = all.filter((it) => { const k = it.title.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, '').slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; });
  return all.slice(0, 90);
}

// --- Decodificar link de Google News -> URL real del artículo (API interno) ---
const decodeCache = new Map(); // id -> url real
async function decodeGoogleNews(link) {
  const id = link.split('/articles/')[1]?.split('?')[0];
  if (!id) return link;
  if (decodeCache.has(id)) return decodeCache.get(id);
  try {
    const h = await (await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const sg = h.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = h.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return link;
    const payload = [[['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`, null, 'generic']]];
    const body = 'f.req=' + encodeURIComponent(JSON.stringify(payload));
    const t = await (await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'Mozilla/5.0' }, body,
    })).text();
    const m = t.match(/"(https?:\/\/[^"]+)"/);
    const real = m ? m[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&') : link;
    decodeCache.set(id, real);
    return real;
  } catch { return link; }
}

// --- Resolver Google News redirect + sacar og:image del artículo ---
const ogCache = new Map(); // url -> og image
async function fetchOgImage(url) {
  if (url.includes('news.google.com')) url = await decodeGoogleNews(url);
  if (ogCache.has(url)) return ogCache.get(url);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const html = await r.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    let img = m ? m[1] : '';
    // Las miniaturas de Google (lh3.googleusercontent) vienen a baja resolución; pedimos la grande.
    if (img.includes('googleusercontent.com')) {
      img = img.replace(/=s\d+(-w\d+)?(-h\d+)?$/i, '=s1200').replace(/-w\d+/i, '-w1200').replace(/-h\d+/i, '-h1200');
    }
    ogCache.set(url, img);
    return img;
  } catch { return ''; }
}

// --- Reescritura IA (opcional, requiere ANTHROPIC_API_KEY) ---
async function rewrite(titular) {
  if (!GEMINI_KEY) {
    return { headline: titular, caption: `${titular}\n\n👉 Síguenos para más noticias.\n\n#Cuba #Noticias`, ai: false };
  }
  const prompt = `Eres editor de una página de noticias en Facebook estilo CiberCuba. Te doy un titular original. Devuelve SOLO un JSON válido (sin texto extra, sin bloques de código) con dos campos:
- "headline": el titular reescrito con TUS palabras (original, no copies), tono gancho y claro, máximo 90 caracteres, en español, sin comillas internas.
- "caption": el texto para el post de Facebook (2-3 frases que enganchen, sin clickbait falso) seguido de 4-6 hashtags relevantes.
Titular original: "${titular}"`;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const j = text.match(/\{[\s\S]*\}/);
    if (j) { try { return { ...JSON.parse(j[0]), ai: true }; } catch {} }
  } catch {}
  return { headline: titular, caption: titular, ai: false };
}

// --- Extraer el texto del artículo real (para darle contexto a la IA) ---
async function fetchArticleText(url) {
  if (!url) return '';
  if (url.includes('news.google.com')) url = await decodeGoogleNews(url);
  try {
    const html = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const ogd = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    let text = ogd ? decodeEntities(ogd[1]) + '\n' : '';
    const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()))
      .filter((p) => p.length > 80);
    text += ps.slice(0, 30).join('\n');
    return text.slice(0, 6500);
  } catch { return ''; }
}

// --- Reescribir el cuerpo con Gemini (gratis) a partir del texto real ---
async function geminiBody(title, text) {
  if (!GEMINI_KEY) return (text || '').slice(0, 600); // fallback: extracto crudo
  const prompt = `Eres redactor de un medio digital de noticias. Reescribe la siguiente noticia con TUS PROPIAS PALABRAS, en español, estilo periodístico neutral y claro, organizada en párrafos.
REGLA MÁS IMPORTANTE: usa ÚNICAMENTE la información que aparece en el CONTENIDO ORIGINAL. NO añadas hechos, cifras, nombres, fechas, antecedentes ni contexto que no estén explícitamente en ese texto. No inventes ni completes con tu conocimiento general. Si el contenido es corto, la nota será corta; si es amplio, será larga (eso está bien).
Otras reglas: no incluyas el titular ni etiquetas como "Resumen:"; devuelve solo el cuerpo de la noticia.\n\nTITULAR: ${title}\n\nCONTENIDO ORIGINAL:\n${text}`;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } } }),
    });
    const j = await r.json();
    return (j?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim() || (text || '').slice(0, 600);
  } catch { return (text || '').slice(0, 600); }
}

// --- Publicar una noticia en la web estática ---
function slugify(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'noticia-' + Date.now();
}
// Publicar vía GitHub API (cuando corre en la nube; Netlify reconstruye con netlify.toml)
async function ghReq(method, p, body) {
  return fetch('https://api.github.com' + p, {
    method,
    headers: { Authorization: 'token ' + GH_TOKEN, 'User-Agent': 'PulsoLatino', Accept: 'application/vnd.github+json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function publishViaAPI(art) {
  const slug = slugify(art.title);
  let image = '';
  if (art.imageData && art.imageData.startsWith('data:')) {
    image = slug.slice(0, 30) + '.jpg';
    let sha;
    const ex = await ghReq('GET', `/repos/${GH_OWNER}/${GH_REPO}/contents/assets/img/${image}`);
    if (ex.ok) sha = (await ex.json()).sha;
    await ghReq('PUT', `/repos/${GH_OWNER}/${GH_REPO}/contents/assets/img/${image}`,
      { message: 'img: ' + slug, content: art.imageData.split(',')[1], sha });
  }
  let articles = [], sha;
  const cur = await ghReq('GET', `/repos/${GH_OWNER}/${GH_REPO}/contents/data/articles.json`);
  if (cur.ok) { const j = await cur.json(); sha = j.sha; try { articles = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); } catch {} }
  const item = { slug, title: art.title, category: art.category || 'Noticia', source: art.source || '', sourceUrl: art.sourceUrl || '', date: new Date().toISOString(), image, body: art.body || '' };
  articles = articles.filter((a) => a.slug !== slug && !a.demo);
  articles.unshift(item);
  const content = Buffer.from(JSON.stringify(articles, null, 2)).toString('base64');
  const put = await ghReq('PUT', `/repos/${GH_OWNER}/${GH_REPO}/contents/data/articles.json`,
    { message: 'Noticia: ' + (art.title || '').slice(0, 50), content, sha });
  return { ok: put.ok, slug, count: articles.length, deployed: put.ok };
}

async function publishArticle(art) {
  if (GH_TOKEN) return publishViaAPI(art); // nube
  const webDir = path.join(__dirname, 'web');
  const dataPath = path.join(webDir, 'data', 'articles.json');
  let articles = [];
  if (fs.existsSync(dataPath)) { try { articles = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {} }
  const slug = slugify(art.title);
  // guardar imagen (dataURL base64) si viene
  let image = '';
  if (art.imageData && art.imageData.startsWith('data:')) {
    const b64 = art.imageData.split(',')[1];
    image = slug.slice(0, 30) + '.jpg';
    fs.writeFileSync(path.join(webDir, 'assets', 'img', image), Buffer.from(b64, 'base64'));
  }
  const item = {
    slug, title: art.title, category: art.category || 'Noticia', source: art.source || '',
    sourceUrl: art.sourceUrl || '', date: new Date().toISOString(), image,
    body: art.body || '',
  };
  articles = articles.filter((a) => a.slug !== slug && !a.demo); // dedup + quitar ejemplos al publicar real
  articles.unshift(item);
  fs.writeFileSync(dataPath, JSON.stringify(articles, null, 2));
  require(path.join(webDir, 'build.js')).build();
  const deployed = gitDeploy(webDir, art.title);
  return { ok: true, slug, count: articles.length, deployed };
}

// Sube los cambios a GitHub (Netlify reconstruye solo). Si no hay remote, no hace nada.
function gitDeploy(webDir, title) {
  try {
    const cp = require('child_process');
    const sh = (cmd) => cp.execSync(cmd, { cwd: webDir, stdio: 'pipe' }).toString().trim();
    const hasRemote = sh('git remote').includes('origin');
    if (!hasRemote) return false; // aún no conectado a GitHub
    sh('git add -A');
    try { sh(`git commit -m "Noticia: ${(title || '').replace(/"/g, "'").slice(0, 60)}"`); } catch {} // nada que commitear = ok
    sh('git push origin HEAD');
    return true;
  } catch (e) { return false; }
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d));
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  // Control de acceso (solo si hay contraseña configurada, p.ej. en la nube)
  if (GEN_PASS) {
    const expected = 'Basic ' + Buffer.from('pulso:' + GEN_PASS).toString('base64');
    if ((req.headers.authorization || '') !== expected) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Pulso Latino"' });
      return res.end('Acceso restringido');
    }
  }
  try {
    if (u.pathname === '/api/publish' && req.method === 'POST') {
      const art = JSON.parse(await readBody(req) || '{}');
      return send(res, 200, JSON.stringify(await publishArticle(art)));
    }
    if (u.pathname === '/api/feed') {
      const items = await fetchFeed(u.searchParams.get('cat') || 'cuba');
      return send(res, 200, JSON.stringify({ items }));
    }
    if (u.pathname === '/api/og') {
      const img = await fetchOgImage(u.searchParams.get('url') || '');
      return send(res, 200, JSON.stringify({ image: img }));
    }
    if (u.pathname === '/api/rewrite') {
      const t = u.searchParams.get('t') || '';
      return send(res, 200, JSON.stringify(await rewrite(t)));
    }
    if (u.pathname === '/api/body') {
      const text = await fetchArticleText(u.searchParams.get('url') || '');
      const body = await geminiBody(u.searchParams.get('t') || '', text);
      return send(res, 200, JSON.stringify({ body, ai: !!GEMINI_KEY }));
    }
    if (u.pathname === '/api/imgproxy') {
      // proxy de imagen para evitar CORS al dibujar en canvas
      let src = u.searchParams.get('src') || '';
      let r = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      // si la miniatura de YouTube en alta no existe, bajar a hqdefault (siempre existe)
      if (!r.ok && src.includes('ytimg.com') && src.includes('maxresdefault')) {
        src = src.replace('maxresdefault', 'hqdefault');
        r = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
      return res.end(buf);
    }
    // previsualización de la web generada (/web/...)
    if (u.pathname.startsWith('/web/')) {
      const webDir = path.join(__dirname, 'web');
      const wf = path.join(webDir, path.normalize(u.pathname.slice(5)).replace(/^([/\\])+/, ''));
      if (wf.startsWith(webDir) && fs.existsSync(wf) && fs.statSync(wf).isFile()) {
        return send(res, 200, fs.readFileSync(wf), MIME[path.extname(wf)] || 'application/octet-stream');
      }
      return send(res, 404, 'no encontrado', 'text/plain');
    }
    // estáticos
    let f = u.pathname === '/' ? '/index.html' : u.pathname;
    const fp = path.join(PUBLIC, path.normalize(f).replace(/^([/\\])+/, ''));
    if (!fp.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
    if (fs.existsSync(fp)) {
      return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'application/octet-stream');
    }
    send(res, 404, 'no encontrado', 'text/plain');
  } catch (e) {
    send(res, 500, JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  NoticiasCuba corriendo en:  http://localhost:${PORT}\n`);
  console.log(`  IA de reescritura: ${ANTHROPIC_KEY ? 'ACTIVADA ✓' : 'desactivada (define ANTHROPIC_API_KEY para activarla)'}\n`);
});
