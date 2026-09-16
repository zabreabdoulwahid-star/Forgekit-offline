/* ForgeKit — offline design toolkit
   Vanilla ES5 JavaScript on purpose: no build step, no external libraries,
   maximum compatibility with older Android WebView engines (minSdk 21). */

// ============================= UTILITIES =============================
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function on(el, ev, fn) { if (el) el.addEventListener(ev, fn, false); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function toast(msg) {
  var t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function () { t.className = 'toast'; }, 1600);
}

function copyText(str) {
  var done = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str);
      done = true;
    }
  } catch (e) {}
  if (!done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done = true;
    } catch (e2) {}
  }
  toast(done ? 'Copied to clipboard' : 'Could not copy');
  return done;
}

// ============================= STORAGE =============================
var STORE_KEY = 'forgekit_v1';
function loadStore() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { icons: [], fonts: [], palettes: [], gradients: [] };
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch (e) {}
}
var STORE = loadStore();

function isFav(kind, id) { return STORE[kind].indexOf(id) !== -1; }
function toggleFav(kind, id) {
  var idx = STORE[kind].indexOf(id);
  if (idx === -1) { STORE[kind].push(id); } else { STORE[kind].splice(idx, 1); }
  saveStore();
  return isFav(kind, id);
}

// ============================= COLOR MATH =============================
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) { hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
  var num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
  function h(v) { var s = clamp(Math.round(v), 0, 255).toString(16); return s.length === 1 ? '0' + s : s; }
  return '#' + h(r) + h(g) + h(b);
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: h, s: s * 100, l: l * 100 };
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  var r=0,g=0,b=0;
  if (h < 60) { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  return { r: (r+m)*255, g: (g+m)*255, b: (b+m)*255 };
}
function hexToHsl(hex) { var rgb = hexToRgb(hex); return rgbToHsl(rgb.r, rgb.g, rgb.b); }
function hslToHex(h, s, l) { var rgb = hslToRgb(h, s, l); return rgbToHex(rgb.r, rgb.g, rgb.b); }

function relLuminance(hex) {
  var rgb = hexToRgb(hex);
  var chans = [rgb.r, rgb.g, rgb.b].map(function (v) {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chans[0] + 0.7152 * chans[1] + 0.0722 * chans[2];
}
function contrastRatio(hexA, hexB) {
  var la = relLuminance(hexA) + 0.05, lb = relLuminance(hexB) + 0.05;
  return la > lb ? la / lb : lb / la;
}
function idealTextColor(bgHex) { return contrastRatio(bgHex, '#000000') > contrastRatio(bgHex, '#ffffff') ? '#14161B' : '#ffffff'; }

// ============================= APP STATE =============================
var STATE = {
  tab: 'icons',
  iconCat: 'All', iconQuery: '',
  fontCat: 'All', fontQuery: '', fontText: 'Design something bold.', fontWeightOverride: null, fontLsOverride: null,
  baseHue: 22, baseSat: 92, baseLight: 58,
  gradStops: [ { hex: '#FF8A3D', pos: 0 }, { hex: '#FF5C5C', pos: 100 } ],
  gradAngle: 135, gradType: 'linear',
  logo: { iconId: 'zap', fontId: 'roboto-cond-bold', text: 'Forge', layout: 'left', color: '#FF8A3D', bg: '#1C1F26' },
  sheetIcon: null
};

// ============================= ICON HELPERS =============================
function iconById(id) { for (var i=0;i<ICONS.length;i++){ if (ICONS[i].n === id) return ICONS[i]; } return ICONS[0]; }
function iconSvg(icon, extraAttrs) {
  return '<svg viewBox="0 0 24 24" ' + (extraAttrs||'') + '>' + icon.s + '</svg>';
}
function iconCategories() {
  var seen = {}, out = ['All'];
  for (var i=0;i<ICONS.length;i++){ if(!seen[ICONS[i].c]){ seen[ICONS[i].c]=1; out.push(ICONS[i].c); } }
  return out;
}

// ============================= RENDER: ICONS TAB =============================
function renderIconChips() {
  var cats = iconCategories();
  var html = cats.map(function (c) {
    return '<button class="chip' + (STATE.iconCat === c ? ' active' : '') + '" onclick="setIconCat(\'' + c + '\')">' + c + '</button>';
  }).join('');
  $('#iconChips').innerHTML = html;
}
function setIconCat(c) { STATE.iconCat = c; renderIconChips(); renderIconGrid(); }
function setIconQuery(v) { STATE.iconQuery = v.toLowerCase(); renderIconGrid(); }

function renderIconGrid() {
  var q = STATE.iconQuery;
  var list = ICONS.filter(function (ic) {
    var inCat = STATE.iconCat === 'All' || ic.c === STATE.iconCat;
    var inQuery = !q || ic.n.indexOf(q) !== -1 || ic.t.indexOf(q) !== -1 || ic.c.toLowerCase().indexOf(q) !== -1;
    return inCat && inQuery;
  });
  var grid = $('#iconGrid');
  if (!list.length) { grid.innerHTML = '<div class="empty-msg">No icons match that search.</div>'; return; }
  grid.innerHTML = list.map(function (ic) {
    var fav = isFav('icons', ic.n) ? ' is-fav' : '';
    return '<div class="icon-card' + fav + '" onclick="openIconSheet(\'' + ic.n + '\')">' +
      '<span class="fav-dot"></span>' + iconSvg(ic) + '<div class="ic-name">' + ic.n + '</div></div>';
  }).join('');
}

function iconHtmlCode(ic) {
  return '<span class="fk-icon fk-icon--' + ic.n + '" aria-hidden="true">\n  ' + iconSvg(ic).replace(/></g, '>\n  <') + '\n</span>';
}
function iconCssCode(ic) {
  return '.fk-icon--' + ic.n + ' svg {\n  width: 24px;\n  height: 24px;\n  fill: none;\n  stroke: currentColor;\n  stroke-width: 1.8;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}';
}

function openIconSheet(id) {
  var ic = iconById(id);
  STATE.sheetIcon = id;
  $('#sheetIconTitle').textContent = titleCase(ic.n);
  $('#sheetIconSub').textContent = ic.c + ' · tags: ' + ic.t.split(',').join(', ');
  $('#sheetIconPreview').innerHTML = iconSvg(ic);
  $('#sheetIconHtml').textContent = iconHtmlCode(ic);
  $('#sheetIconCss').textContent = iconCssCode(ic);
  var favBtn = $('#sheetIconFav');
  var fav = isFav('icons', ic.n);
  favBtn.className = 'btn fav' + (fav ? ' is-fav' : '');
  favBtn.innerHTML = starSvg() + (fav ? 'Favorited' : 'Add to favorites');
  showSheet('#iconSheet');
}
function toggleIconFavFromSheet() {
  var fav = toggleFav('icons', STATE.sheetIcon);
  var favBtn = $('#sheetIconFav');
  favBtn.className = 'btn fav' + (fav ? ' is-fav' : '');
  favBtn.innerHTML = starSvg() + (fav ? 'Favorited' : 'Add to favorites');
  renderIconGrid();
  if (STATE.tab === 'favorites') renderFavorites();
}
function titleCase(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
function starSvg() { return '<svg viewBox="0 0 24 24"><polygon points="12,2.5 15,9.5 22.5,10.2 17,15.2 18.5,22.5 12,18.7 5.5,22.5 7,15.2 1.5,10.2 9,9.5"/></svg>'; }

// ============================= RENDER: TYPOGRAPHY TAB =============================
function renderFontChips() {
  var cats = ['All','Sans','Serif','Mono','Condensed','Display'];
  $('#fontChips').innerHTML = cats.map(function (c) {
    return '<button class="chip' + (STATE.fontCat === c ? ' active' : '') + '" onclick="setFontCat(\'' + c + '\')">' + c + '</button>';
  }).join('');
}
function setFontCat(c) { STATE.fontCat = c; renderFontChips(); renderFontList(); }
function setFontQuery(v) { STATE.fontQuery = v.toLowerCase(); renderFontList(); }
function setFontText(v) { STATE.fontText = v || 'Design something bold.'; renderFontList(); }
function setFontWeightOverride(v) {
  STATE.fontWeightOverride = v ? parseInt(v, 10) : null;
  $('#weightVal').textContent = v ? v : 'auto';
  renderFontList();
}
function setFontLsOverride(v) {
  STATE.fontLsOverride = (v === '' || v === null) ? null : parseFloat(v);
  $('#lsVal').textContent = (STATE.fontLsOverride === null) ? 'auto' : (STATE.fontLsOverride + 'px');
  renderFontList();
}

function fontCssCode(f) {
  var w = STATE.fontWeightOverride !== null ? STATE.fontWeightOverride : f.weight;
  var ls = STATE.fontLsOverride !== null ? STATE.fontLsOverride : f.ls;
  return "font-family: " + f.stack + ";\nfont-weight: " + w + ";\nfont-style: " + f.style + ";\nletter-spacing: " + ls + "px;";
}

function renderFontList() {
  var q = STATE.fontQuery;
  var list = FONTS.filter(function (f) {
    var inCat = STATE.fontCat === 'All' || f.cat === STATE.fontCat;
    var inQuery = !q || f.name.toLowerCase().indexOf(q) !== -1 || f.cat.toLowerCase().indexOf(q) !== -1;
    return inCat && inQuery;
  });
  var wrap = $('#fontList');
  if (!list.length) { wrap.innerHTML = '<div class="empty-msg">No fonts match that search.</div>'; return; }
  wrap.innerHTML = list.map(function (f) {
    var w = STATE.fontWeightOverride !== null ? STATE.fontWeightOverride : f.weight;
    var ls = STATE.fontLsOverride !== null ? STATE.fontLsOverride : f.ls;
    var fav = isFav('fonts', f.id);
    var style = 'font-family:' + f.stack + ';font-weight:' + w + ';font-style:' + f.style + ';letter-spacing:' + ls + 'px;';
    return '<div class="font-card">' +
      '<div class="fc-preview" style="' + style + '">' + esc(STATE.fontText) + '</div>' +
      '<div class="fc-meta"><div><div class="fc-name">' + f.name + '</div>' +
      '<div class="fc-spec">' + f.cat + ' · weight ' + w + ' · ' + f.style + '</div></div>' +
      '<button class="fc-star' + (fav ? ' is-fav' : '') + '" onclick="toggleFontFav(\'' + f.id + '\', this)">' + starSvg() + '</button></div>' +
      '<div class="fc-pair"><b>Pair:</b> ' + f.pair + '</div>' +
      '<div class="rowbtns"><button class="btn primary" onclick="copyText(' + attrJs(fontCssCode(f)) + ')">Copy CSS</button></div>' +
      '</div>';
  }).join('');
}
function toggleFontFav(id, el) {
  var fav = toggleFav('fonts', id);
  el.className = 'fc-star' + (fav ? ' is-fav' : '');
  if (STATE.tab === 'favorites') renderFavorites();
}
function attrJs(s) { return JSON.stringify(s); }

// ============================= RENDER: COLOR STUDIO TAB =============================
var WHEEL_SIZE = 220, WHEEL_R = WHEEL_SIZE / 2;

function drawColorWheel() {
  var canvas = $('#colorWheel');
  if (!canvas) return;
  canvas.width = WHEEL_SIZE; canvas.height = WHEEL_SIZE;
  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
  var cx = WHEEL_R, cy = WHEEL_R;
  for (var y = 0; y < WHEEL_SIZE; y++) {
    for (var x = 0; x < WHEEL_SIZE; x++) {
      var dx = x - cx, dy = y - cy;
      var dist = Math.sqrt(dx*dx + dy*dy);
      var idx = (y * WHEEL_SIZE + x) * 4;
      if (dist > WHEEL_R) { img.data[idx+3] = 0; continue; }
      var ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
      var sat = clamp((dist / WHEEL_R) * 100, 0, 100);
      var rgb = hslToRgb(ang, sat, STATE.baseLight);
      img.data[idx] = rgb.r; img.data[idx+1] = rgb.g; img.data[idx+2] = rgb.b; img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  positionWheelThumb();
}
function positionWheelThumb() {
  var thumb = $('#wheelThumb');
  var rad = STATE.baseHue * Math.PI / 180;
  var dist = (STATE.baseSat / 100) * WHEEL_R;
  var x = WHEEL_R + Math.cos(rad) * dist, y = WHEEL_R + Math.sin(rad) * dist;
  thumb.style.left = x + 'px'; thumb.style.top = y + 'px';
  thumb.style.background = hslToHex(STATE.baseHue, STATE.baseSat, STATE.baseLight);
}
function wheelPointerHandler(e) {
  var canvas = $('#colorWheel');
  var rect = canvas.getBoundingClientRect();
  var pt = e.touches ? e.touches[0] : e;
  var x = pt.clientX - rect.left - WHEEL_R, y = pt.clientY - rect.top - WHEEL_R;
  var dist = Math.min(Math.sqrt(x*x + y*y), WHEEL_R);
  var ang = Math.atan2(y, x) * 180 / Math.PI; if (ang < 0) ang += 360;
  STATE.baseHue = ang; STATE.baseSat = clamp((dist / WHEEL_R) * 100, 0, 100);
  positionWheelThumb();
  updateColorOutputs();
  e.preventDefault();
}
function bindWheel() {
  var canvas = $('#colorWheel');
  var dragging = false;
  on(canvas, 'mousedown', function (e) { dragging = true; wheelPointerHandler(e); });
  on(document, 'mousemove', function (e) { if (dragging) wheelPointerHandler(e); });
  on(document, 'mouseup', function () { dragging = false; });
  on(canvas, 'touchstart', function (e) { dragging = true; wheelPointerHandler(e); });
  on(canvas, 'touchmove', function (e) { if (dragging) wheelPointerHandler(e); });
  on(canvas, 'touchend', function () { dragging = false; });
}
function setBaseLightness(v) {
  STATE.baseLight = parseInt(v, 10);
  $('#lightVal').textContent = STATE.baseLight + '%';
  drawColorWheel();
  updateColorOutputs();
}
function setHexDirect(v) {
  v = v.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return;
  if (v[0] !== '#') v = '#' + v;
  var hsl = hexToHsl(v);
  STATE.baseHue = hsl.h; STATE.baseSat = hsl.s; STATE.baseLight = Math.round(hsl.l);
  $('#lightSlider').value = STATE.baseLight;
  $('#lightVal').textContent = STATE.baseLight + '%';
  drawColorWheel();
  updateColorOutputs();
}

function baseHex() { return hslToHex(STATE.baseHue, STATE.baseSat, STATE.baseLight); }

function swatchHtml(hex) {
  var rgb = hexToRgb(hex);
  var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  var rgbStr = 'rgb(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ')';
  var hslStr = 'hsl(' + Math.round(hsl.h) + ',' + Math.round(hsl.s) + '%,' + Math.round(hsl.l) + '%)';
  var copyPayload = hex.toUpperCase() + '  |  ' + rgbStr + '  |  ' + hslStr;
  return '<div class="swatch" onclick="copyText(' + attrJs(copyPayload) + ')">' +
    '<div class="swatch-color" style="background:' + hex + '"></div>' +
    '<div class="swatch-info"><span class="shex">' + hex.toUpperCase() + '</span></div></div>';
}

function buildPalettes() {
  var h = STATE.baseHue, s = STATE.baseSat, l = STATE.baseLight;
  return [
    { name: 'Complementary', desc: 'Base color and its direct opposite — high contrast, high energy.',
      colors: [hslToHex(h,s,l), hslToHex(h+180,s,l)] },
    { name: 'Analogous', desc: 'Neighbors on the color wheel — calm, cohesive, low tension.',
      colors: [hslToHex(h-30,s,l), hslToHex(h-15,s,l), hslToHex(h,s,l), hslToHex(h+15,s,l), hslToHex(h+30,s,l)] },
    { name: 'Triadic', desc: 'Three colors evenly spaced — vibrant while staying balanced.',
      colors: [hslToHex(h,s,l), hslToHex(h+120,s,l), hslToHex(h+240,s,l)] },
    { name: 'Monochromatic', desc: 'Same hue, stepped lightness — a safe, elegant single-color system.',
      colors: [hslToHex(h,s,clamp(l-32,6,94)), hslToHex(h,s,clamp(l-16,6,94)), hslToHex(h,s,l), hslToHex(h,s,clamp(l+16,6,94)), hslToHex(h,s,clamp(l+32,6,94))] },
    { name: 'Split Complementary', desc: 'Base plus the two neighbors of its opposite — contrast with more nuance.',
      colors: [hslToHex(h,s,l), hslToHex(h+150,s,l), hslToHex(h+210,s,l)] }
  ];
}

function renderColorTab() {
  var hex = baseHex();
  $('#currentSwatch').style.background = hex;
  $('#currentHex').textContent = hex.toUpperCase();
  var rgb = hexToRgb(hex);
  $('#currentRgbHsl').textContent = 'rgb(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ')  ·  hsl(' + Math.round(STATE.baseHue) + ',' + Math.round(STATE.baseSat) + '%,' + Math.round(STATE.baseLight) + '%)';
  $('#hexInput').value = hex.toUpperCase();

  var palettes = buildPalettes();
  $('#paletteWrap').innerHTML = palettes.map(function (p) {
    return '<div class="palette-block"><h4>' + p.name + '</h4><p class="pdesc">' + p.desc + '</p>' +
      '<div class="swatch-row">' + p.colors.map(swatchHtml).join('') + '</div></div>';
  }).join('');

  // Mockup
  var textColor = idealTextColor(hex);
  $('#mockupBox').style.background = hex;
  $('#mockupBox').style.color = textColor;
  $('#mockupLogo').style.background = textColor === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';
  $('#mockupLogo').style.color = textColor;
  $('#mockupLogo').textContent = 'F';

  // Contrast checker
  var pairs = [
    { label: hex.toUpperCase() + ' on white', a: hex, b: '#ffffff' },
    { label: hex.toUpperCase() + ' on black', a: hex, b: '#000000' },
    { label: 'White text on ' + hex.toUpperCase(), a: '#ffffff', b: hex },
    { label: 'Black text on ' + hex.toUpperCase(), a: '#000000', b: hex }
  ];
  $('#contrastWrap').innerHTML = pairs.map(function (p) {
    var ratio = contrastRatio(p.a, p.b);
    var passAA = ratio >= 4.5, passAAA = ratio >= 7;
    return '<div class="contrast-row"><span class="cr-label">' + p.label + '</span>' +
      '<span class="cr-ratio">' + ratio.toFixed(2) + ':1' +
      '<span class="badge ' + (passAA ? 'pass' : 'fail') + '">' + (passAA ? 'AA' : 'FAIL') + '</span>' +
      (passAAA ? '<span class="badge pass">AAA</span>' : '') + '</span></div>';
  }).join('');
}

// ============================= RENDER: GRADIENT TAB =============================
var GRADIENT_PRESETS = [
  { name: 'Forge', stops: ['#FF8A3D','#FF5C5C'], angle: 135, type: 'linear' },
  { name: 'Dusk', stops: ['#5B8CFF','#8A5BFF'], angle: 120, type: 'linear' },
  { name: 'Mint', stops: ['#34D399','#0EA5E9'], angle: 100, type: 'linear' },
  { name: 'Ember', stops: ['#FFD23F','#FF5C5C','#7B2FF7'], angle: 145, type: 'linear' },
  { name: 'Ocean', stops: ['#0EA5E9','#14161B'], angle: 160, type: 'linear' },
  { name: 'Citrus', stops: ['#FFE066','#FF8A3D'], angle: 90, type: 'linear' },
  { name: 'Berry', stops: ['#F2545B','#7B2FF7'], angle: 130, type: 'linear' },
  { name: 'Steel', stops: ['#8B8F98','#20242C'], angle: 180, type: 'linear' },
  { name: 'Sunrise Radial', stops: ['#FFD23F','#FF5C5C'], angle: 0, type: 'radial' },
  { name: 'Aurora', stops: ['#34D399','#5B8CFF','#7B2FF7'], angle: 110, type: 'linear' },
  { name: 'Blush', stops: ['#FF9FB2','#FF5C8A'], angle: 140, type: 'linear' },
  { name: 'Slate Radial', stops: ['#5B8CFF','#14161B'], angle: 0, type: 'radial' }
];

function gradientCss() {
  var stops = STATE.gradStops.slice().sort(function(a,b){return a.pos-b.pos;});
  var stopStr = stops.map(function (s) { return s.hex + ' ' + Math.round(s.pos) + '%'; }).join(', ');
  if (STATE.gradType === 'radial') return 'radial-gradient(circle, ' + stopStr + ')';
  return 'linear-gradient(' + Math.round(STATE.gradAngle) + 'deg, ' + stopStr + ')';
}

function renderGradientTab() {
  var css = gradientCss();
  $('#gradPreview').style.background = css;
  $('#gradCssOut').textContent = 'background: ' + css + ';';
  $('#gradAngleRow').style.display = STATE.gradType === 'radial' ? 'none' : 'block';
  $('#angleVal').textContent = Math.round(STATE.gradAngle) + '\u00B0';

  $('#stopWrap').innerHTML = STATE.gradStops.map(function (s, i) {
    return '<div class="stop-row">' +
      '<div class="stop-swatch" style="background:' + s.hex + '"></div>' +
      '<input type="text" value="' + s.hex.toUpperCase() + '" onchange="setStopHex(' + i + ', this.value)"/>' +
      '<button class="btn" style="flex:0 0 auto;padding:7px 10px;margin-right:6px;" onclick="setStopPos(' + i + ')">' + Math.round(s.pos) + '%</button>' +
      (STATE.gradStops.length > 2 ? '<button class="btn" style="flex:0 0 auto;padding:7px 10px;" onclick="removeStop(' + i + ')">\u2715</button>' : '') +
      '</div>';
  }).join('');

  $('#presetGrid').innerHTML = GRADIENT_PRESETS.map(function (p, i) {
    var pcss = p.type === 'radial' ? 'radial-gradient(circle, ' + p.stops.join(',') + ')' : 'linear-gradient(' + p.angle + 'deg, ' + p.stops.join(',') + ')';
    return '<div class="preset-swatch" style="background:' + pcss + '" onclick="loadPreset(' + i + ')"></div>';
  }).join('');
}
function setGradType(t) {
  STATE.gradType = t;
  $all('#gradTypeSeg button').forEach(function (b) { b.className = b.getAttribute('data-t') === t ? 'active' : ''; });
  renderGradientTab();
}
function setGradAngle(v) { STATE.gradAngle = parseFloat(v); renderGradientTab(); }
function setStopHex(i, v) {
  v = v.trim(); if (v[0] !== '#') v = '#' + v;
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) { toast('Enter a valid hex color'); renderGradientTab(); return; }
  STATE.gradStops[i].hex = v; renderGradientTab();
}
function setStopPos(i) {
  var cur = Math.round(STATE.gradStops[i].pos);
  var next = cur + 10; if (next > 100) next = 0;
  STATE.gradStops[i].pos = next; renderGradientTab();
}
function addStop() {
  if (STATE.gradStops.length >= 4) { toast('Max 4 color stops'); return; }
  STATE.gradStops.push({ hex: baseHex(), pos: 50 });
  renderGradientTab();
}
function removeStop(i) { STATE.gradStops.splice(i, 1); renderGradientTab(); }
function loadPreset(i) {
  var p = GRADIENT_PRESETS[i];
  STATE.gradType = p.type; STATE.gradAngle = p.angle;
  STATE.gradStops = p.stops.map(function (hex, idx) { return { hex: hex, pos: p.stops.length === 1 ? 0 : Math.round((idx / (p.stops.length - 1)) * 100) }; });
  renderGradientTab();
}

// alias used by color-wheel interactions
function updateColorOutputs() { renderColorTab(); }

// ============================= RENDER: LOGO CANVAS TAB =============================
var LOGO_BGS = ['#1C1F26', '#FFFFFF', '#14161B'];
var LOGO_COLOR_SWATCHES = ['#FF8A3D','#FF5C5C','#5B8CFF','#34D399','#FFD23F','#7B2FF7','#F2545B','#0EA5E9','#ECEAE4','#14161B'];

function setLogoText(v) { STATE.logo.text = v || 'Forge'; renderLogoTab(); }
function setLogoLayout(v) {
  STATE.logo.layout = v;
  $all('#logoLayoutSeg button').forEach(function (b) { b.className = b.getAttribute('data-l') === v ? 'active' : ''; });
  renderLogoTab();
}
function setLogoFont(v) { STATE.logo.fontId = v; renderLogoTab(); }
function setLogoColor(hex) { STATE.logo.color = hex; renderLogoTab(); }
function setLogoBg(hex) { STATE.logo.bg = hex; renderLogoTab(); }
function setLogoIcon(id) { STATE.logo.iconId = id; renderLogoTab(); }

function renderLogoIconPicker() {
  var favIcons = ICONS.filter(function (ic) { return isFav('icons', ic.n); });
  var pool = favIcons.length ? favIcons : ICONS.slice(0, 24);
  $('#logoIconPicker').innerHTML = pool.map(function (ic) {
    return '<div class="mi' + (STATE.logo.iconId === ic.n ? ' sel' : '') + '" onclick="setLogoIcon(\'' + ic.n + '\')">' + iconSvg(ic) + '</div>';
  }).join('');
}
function renderLogoColorPicker() {
  $('#logoColorPicker').innerHTML = LOGO_COLOR_SWATCHES.map(function (hex) {
    return '<div class="mc' + (STATE.logo.color === hex ? ' sel' : '') + '" style="background:' + hex + '" onclick="setLogoColor(\'' + hex + '\')"></div>';
  }).join('');
}
function renderLogoBgPicker() {
  $('#logoBgPicker').innerHTML = LOGO_BGS.map(function (hex) {
    return '<div class="mc' + (STATE.logo.bg === hex ? ' sel' : '') + '" style="background:' + hex + ';border:1px solid #2A2E37" onclick="setLogoBg(\'' + hex + '\')"></div>';
  }).join('');
}
function renderLogoFontSelect() {
  var sel = $('#logoFontSelect');
  if (sel.options.length === 0) {
    sel.innerHTML = FONTS.map(function (f) { return '<option value="' + f.id + '">' + f.name + '</option>'; }).join('');
  }
  sel.value = STATE.logo.fontId;
}

function renderLogoTab() {
  renderLogoIconPicker(); renderLogoColorPicker(); renderLogoBgPicker(); renderLogoFontSelect();
  var ic = iconById(STATE.logo.iconId);
  var font = FONTS.filter(function (f) { return f.id === STATE.logo.fontId; })[0] || FONTS[0];
  var showIcon = STATE.logo.layout !== 'text';
  var showText = STATE.logo.layout !== 'icon';
  var stackDir = STATE.logo.layout === 'top' ? 'column' : 'row';
  var textColor = STATE.logo.color;

  var stage = $('#logoStage');
  stage.style.background = STATE.logo.bg;
  var html = '<div style="display:flex;flex-direction:' + stackDir + ';align-items:center;gap:12px;">';
  if (showIcon) {
    html += '<div style="width:48px;height:48px;border-radius:12px;background:' + textColor + '22;display:flex;align-items:center;justify-content:center;">' +
      '<svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:' + textColor + ';fill:none;stroke-width:1.8;">' + ic.s + '</svg></div>';
  }
  if (showText) {
    html += '<div style="font-family:' + font.stack + ';font-weight:' + font.weight + ';font-style:' + font.style + ';letter-spacing:' + font.ls + 'px;font-size:26px;color:' + textColor + ';">' + esc(STATE.logo.text) + '</div>';
  }
  html += '</div>';
  stage.innerHTML = html;

  // code exports
  var htmlCode = buildLogoHtml(ic, font, showIcon, showText, stackDir, textColor);
  $('#logoHtmlOut').textContent = htmlCode.html;
  $('#logoCssOut').textContent = htmlCode.css;
}

function buildLogoHtml(ic, font, showIcon, showText, stackDir, textColor) {
  var css = '.fk-logo {\n  display: flex;\n  flex-direction: ' + stackDir + ';\n  align-items: center;\n  gap: 12px;\n}\n';
  var html = '<div class="fk-logo">\n';
  if (showIcon) {
    css += '.fk-logo-icon {\n  width: 48px; height: 48px; border-radius: 12px;\n  background: ' + textColor + '22;\n  display: flex; align-items: center; justify-content: center;\n}\n.fk-logo-icon svg { width: 28px; height: 28px; stroke: ' + textColor + '; fill: none; stroke-width: 1.8; }\n';
    html += '  <span class="fk-logo-icon">' + iconSvg(ic) + '</span>\n';
  }
  if (showText) {
    css += '.fk-logo-text {\n  font-family: ' + font.stack + ';\n  font-weight: ' + font.weight + ';\n  font-style: ' + font.style + ';\n  letter-spacing: ' + font.ls + 'px;\n  font-size: 26px;\n  color: ' + textColor + ';\n}\n';
    html += '  <span class="fk-logo-text">' + esc(STATE.logo.text) + '</span>\n';
  }
  html += '</div>';
  return { html: html, css: css };
}

function exportLogoSvg() {
  var ic = iconById(STATE.logo.iconId);
  var font = FONTS.filter(function (f) { return f.id === STATE.logo.fontId; })[0] || FONTS[0];
  var showIcon = STATE.logo.layout !== 'text';
  var showText = STATE.logo.layout !== 'icon';
  var w = 360, h = STATE.logo.layout === 'top' ? 220 : 140;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
  svg += '<rect width="' + w + '" height="' + h + '" fill="' + STATE.logo.bg + '"/>';
  var cx = w / 2;
  if (STATE.logo.layout === 'top') {
    if (showIcon) svg += '<g transform="translate(' + (cx - 24) + ',30) scale(2)" stroke="' + STATE.logo.color + '" fill="none" stroke-width="1.8">' + ic.s + '</g>';
    if (showText) svg += '<text x="' + cx + '" y="' + (h - 40) + '" text-anchor="middle" font-family="' + font.stack.replace(/"/g,'') + '" font-weight="' + font.weight + '" font-style="' + font.style + '" letter-spacing="' + font.ls + '" font-size="30" fill="' + STATE.logo.color + '">' + esc(STATE.logo.text) + '</text>';
  } else if (STATE.logo.layout === 'icon') {
    svg += '<g transform="translate(' + (cx - 28) + ',' + (h/2 - 28) + ') scale(2.3)" stroke="' + STATE.logo.color + '" fill="none" stroke-width="1.6">' + ic.s + '</g>';
  } else if (STATE.logo.layout === 'text') {
    svg += '<text x="' + cx + '" y="' + (h/2 + 10) + '" text-anchor="middle" font-family="' + font.stack.replace(/"/g,'') + '" font-weight="' + font.weight + '" font-style="' + font.style + '" letter-spacing="' + font.ls + '" font-size="32" fill="' + STATE.logo.color + '">' + esc(STATE.logo.text) + '</text>';
  } else {
    svg += '<g transform="translate(50,' + (h/2 - 24) + ') scale(2)" stroke="' + STATE.logo.color + '" fill="none" stroke-width="1.8">' + ic.s + '</g>';
    svg += '<text x="130" y="' + (h/2 + 10) + '" text-anchor="start" font-family="' + font.stack.replace(/"/g,'') + '" font-weight="' + font.weight + '" font-style="' + font.style + '" letter-spacing="' + font.ls + '" font-size="30" fill="' + STATE.logo.color + '">' + esc(STATE.logo.text) + '</text>';
  }
  svg += '</svg>';
  triggerDownload('forgekit-logo.svg', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  toast('SVG downloaded');
}

function exportLogoPng() {
  var ic = iconById(STATE.logo.iconId);
  var font = FONTS.filter(function (f) { return f.id === STATE.logo.fontId; })[0] || FONTS[0];
  var showIcon = STATE.logo.layout !== 'text';
  var showText = STATE.logo.layout !== 'icon';
  var scale = 3, w = 360 * scale, h = (STATE.logo.layout === 'top' ? 220 : 140) * scale;
  var canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = STATE.logo.bg; ctx.fillRect(0, 0, w, h);

  var iconSvgStr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="' + STATE.logo.color + '" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ic.s + '</svg>';
  var img = new Image();
  img.onload = function () {
    ctx.font = font.style + ' ' + font.weight + ' ' + (30 * scale) + 'px ' + font.stack;
    ctx.fillStyle = STATE.logo.color;
    ctx.textBaseline = 'middle';
    if (STATE.logo.layout === 'top') {
      if (showIcon) ctx.drawImage(img, w/2 - 24*scale, 40*scale, 48*scale, 48*scale);
      if (showText) { ctx.textAlign = 'center'; ctx.fillText(STATE.logo.text, w/2, h - 50*scale); }
    } else if (STATE.logo.layout === 'icon') {
      ctx.drawImage(img, w/2 - 55*scale, h/2 - 55*scale, 110*scale, 110*scale);
    } else if (STATE.logo.layout === 'text') {
      ctx.textAlign = 'center'; ctx.fillText(STATE.logo.text, w/2, h/2);
    } else {
      ctx.drawImage(img, 50*scale, h/2 - 24*scale, 48*scale, 48*scale);
      ctx.textAlign = 'left'; ctx.fillText(STATE.logo.text, 130*scale, h/2);
    }
    var dataUrl = canvas.toDataURL('image/png');
    triggerDownload('forgekit-logo.png', dataUrl);
    toast('PNG downloaded');
  };
  img.onerror = function () { toast('PNG export failed — try SVG export instead'); };
  img.src = 'data:image/svg+xml;base64,' + btoa(iconSvgStr);
}

function triggerDownload(filename, dataUrl) {
  try {
    var a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (e) { window.open(dataUrl, '_blank'); }
}

// ============================= RENDER: FAVORITES TAB =============================
function renderFavorites() {
  var wrap = $('#favWrap');
  var favIcons = ICONS.filter(function (ic) { return isFav('icons', ic.n); });
  var favFonts = FONTS.filter(function (f) { return isFav('fonts', f.id); });
  var out = '';

  out += '<div class="fav-section"><h4>Favorite Icons (' + favIcons.length + ')</h4>';
  if (!favIcons.length) { out += '<div class="empty-msg">Tap the star on any icon to save it here.</div>'; }
  else {
    out += '<div class="icon-grid">' + favIcons.map(function (ic) {
      return '<div class="icon-card is-fav" onclick="openIconSheet(\'' + ic.n + '\')"><span class="fav-dot"></span>' + iconSvg(ic) + '<div class="ic-name">' + ic.n + '</div></div>';
    }).join('') + '</div>';
  }
  out += '</div>';

  out += '<div class="fav-section"><h4>Favorite Fonts (' + favFonts.length + ')</h4>';
  if (!favFonts.length) { out += '<div class="empty-msg">Tap the star on any font to save it here.</div>'; }
  else {
    out += favFonts.map(function (f) {
      var style = 'font-family:' + f.stack + ';font-weight:' + f.weight + ';font-style:' + f.style + ';letter-spacing:' + f.ls + 'px;';
      return '<div class="font-card"><div class="fc-preview" style="' + style + '">' + esc(STATE.fontText) + '</div>' +
        '<div class="fc-meta"><div><div class="fc-name">' + f.name + '</div><div class="fc-spec">' + f.cat + '</div></div>' +
        '<button class="fc-star is-fav" onclick="toggleFontFav(\'' + f.id + '\', this)">' + starSvg() + '</button></div></div>';
    }).join('');
  }
  out += '</div>';
  wrap.innerHTML = out;
}

// ============================= SHEET / MODAL =============================
function showSheet(sel) {
  $('#overlay').className = 'overlay show';
  $(sel).className = 'sheet show';
}
function hideSheets() {
  $('#overlay').className = 'overlay';
  $all('.sheet').forEach(function (s) { s.className = 'sheet'; });
}

// ============================= TAB NAVIGATION =============================
var TABS = ['dashboard','icons', 'fonts', 'colors', 'gradients', 'logo', 'favorites'];
function switchTab(tab) {
  STATE.tab = tab;
  TABS.forEach(function (t) {
    $('#panel-' + t).className = 'panel' + (t === tab ? ' active' : '');
    $('#nav-' + t).className = 'navbtn' + (t === tab ? ' active' : '');
  });
  if (tab === 'favorites') renderFavorites();
  if (tab === 'logo') renderLogoTab();
  if (tab === 'colors' && !STATE._wheelDrawn) { drawColorWheel(); STATE._wheelDrawn = true; }
}

// ============================= INIT =============================
function init() {
  renderIconChips(); renderIconGrid();
  renderFontChips(); renderFontList();
  bindWheel(); drawColorWheel(); renderColorTab(); STATE._wheelDrawn = true;
  renderGradientTab();
  renderLogoTab();
  on($('#overlay'), 'click', hideSheets);
  switchTab('dashboard');
}
document.addEventListener('DOMContentLoaded', init);
