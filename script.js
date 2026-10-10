var HIDDEN_REPOS = ["crodyy"];
var PINNED = ["ForenSight", "forest", "dot"];
var OVERRIDES = {
  ForenSight: { badge: "1st \u00B7 national level hackathon", tone: "gold" },
  forest: { badge: "3rd \u00B7 AIESEC hackathon", tone: "bronze" }
};
var FALLBACK = [
  { name: "ForenSight", html_url: "https://github.com/crodyy/ForenSight", desc: "case and evidence management platform with role-based access, timelines and pdf reports.", category: "full-stack", badge: OVERRIDES.ForenSight.badge, tone: "gold" },
  { name: "forest", html_url: "https://github.com/crodyy/forest", desc: "esp32-s3 sensor node that detects chainsaw and gunshot sounds on-device and reports over lora.", category: "embedded & freertos", badge: OVERRIDES.forest.badge, tone: "bronze" },
  { name: "dot", html_url: "https://github.com/crodyy/dot", desc: "hyprland desktop dotfiles with waybar, rofi, kitty and zsh, themed by pywal.", category: "linux & ricing" },
  { name: "qoi-port", html_url: "https://github.com/crodyy/qoi-port", desc: "rust port of the qoi image format, verified byte-identical to the c reference.", category: "rust" }
];
var CACHE_KEY = "crodyy-repos-v10";
var CACHE_TTL = 30 * 60 * 1000;

var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* theme: dark default, stored preference wins, then system.
   sun/moon toggle persists; burst accent refreshes through a hook. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById("theme-btn");
  var meta = document.querySelector('meta[name="theme-color"]');
  function paint(t) {
    if (btn) {
      var toLight = t !== "light";
      btn.setAttribute("aria-label", toLight ? "switch to light mode" : "switch to dark mode");
    }
    if (meta) meta.setAttribute("content", t === "light" ? "#fafafa" : "#000000");
  }
  function apply(t, save) {
    root.setAttribute("data-theme", t);
    paint(t);
    /* force the glassy header to repaint under the new tokens.
       some compositors (notably Safari) otherwise keep painting
       the stale backdrop-filter layer until a full reload. */
    var bar = document.querySelector(".site-nav");
    if (bar) { bar.style.display = "none"; void bar.offsetHeight; bar.style.display = ""; }
    if (window.__refreshBurst) window.__refreshBurst();
    if (save) { try { window.localStorage.setItem("crod-theme", t); } catch (e) {} }
  }
  function current() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  var stored = null;
  try { stored = window.localStorage.getItem("crod-theme"); } catch (e) {}
  if (stored !== "light" && stored !== "dark") {
    apply(window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark", false);
  } else {
    apply(stored, false);
  }
  if (btn) btn.addEventListener("click", function () {
    apply(current() === "light" ? "dark" : "light", true);
  });
})();

/* logo toggle: click swaps crod with japanese, click again swaps back */
(function () {
  var btn = document.getElementById("lang-btn");
  var text = document.getElementById("lang-text");
  if (!btn || !text) return;
  var showingJa = true;
  btn.addEventListener("click", function () {
    text.classList.add("is-fading");
    window.setTimeout(function () {
      showingJa = !showingJa;
      text.textContent = showingJa ? "クロッド" : "crod";
      text.setAttribute("lang", showingJa ? "ja" : "en");
      text.classList.remove("is-fading");
    }, 100);
  });
})();

/* hero rollers: 2.5s loop, line two offset 1.2s, grid stacked, transform/opacity only */
function startRoller(id, delay) {
  var stack = document.getElementById(id);
  if (!stack) return;
  var phrases = stack.querySelectorAll(".roller-phrase");
  if (!phrases.length || reduceMotion) return;
  var idx = 0;
  var widths = [];
  function measure() {
    widths = [];
    for (var i = 0; i < phrases.length; i++) widths.push(phrases[i].offsetWidth);
  }
  function fit() { stack.style.width = widths[idx] + "px"; }
  function advance() {
    var cur = phrases[idx];
    idx = (idx + 1) % phrases.length;
    var nxt = phrases[idx];
    cur.classList.remove("is-active");
    cur.classList.add("is-exiting");
    nxt.classList.add("is-active");
    fit();
    window.setTimeout(function () { cur.classList.remove("is-exiting"); }, 550);
  }
  function refit() { measure(); fit(); }
  refit();
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(refit); }
  window.addEventListener("resize", refit);
  window.setTimeout(function () {
    advance();
    window.setInterval(advance, 2500);
  }, delay);
}
startRoller("roller-a", 2500);
startRoller("roller-b", 3700);

/* nav active state via intersection observer */
(function () {
  var links = document.querySelectorAll("[data-nav]");
  if (!links.length || !("IntersectionObserver" in window)) return;
  var map = {};
  links.forEach(function (l) { map[l.getAttribute("data-nav")] = l; });
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (window.__navScrollLock && window.__navScrollLock()) return;
      var id = e.target.id;
      links.forEach(function (l) { l.classList.remove("is-active"); });
      if (map[id]) map[id].classList.add("is-active");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["top", "contact"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el);
  });
})();

/* projects: fetch github, cache 30min, pinned first, newest rest */
(function () {
  var grid = document.getElementById("project-grid");
  if (!grid) return;
  var allRepos = [];

  function normalize(api) {
    return api.map(function (r) {
      var o = OVERRIDES[r.name] || {};
      return {
        name: r.name,
        html_url: r.html_url,
        desc: o.desc || r.description || "",
        category: (o.category || (r.topics && r.topics[0]) || r.language || "project").toString().toLowerCase(),
        badge: o.badge || "",
        tone: o.tone || ""
      };
    });
  }

  function renderGrid() {
    grid.innerHTML = "";
    allRepos.forEach(function (r) {
      var a = document.createElement("a");
      a.className = "project-cell";
      a.href = r.html_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      var badge = '<span class="cell-badge-row">' + (r.badge ? '<span class="cell-badge' + (r.tone ? ' is-' + r.tone : '') + '">\u2605 ' + r.badge + '</span>' : '') + '</span>';
      a.innerHTML =
        '<span class="cell-title">' + escapeHtml(r.name.toLowerCase()) + '</span>' +
        badge +
        (r.desc ? '<span class="cell-desc">' + escapeHtml(r.desc.toLowerCase()) + '</span>' : '<span class="cell-desc"></span>') +
        '<span class="cell-cat">' + escapeHtml(r.category) + '</span>';
      grid.appendChild(a);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function readCache() {
    try {
      var raw = window.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.time || !parsed.data) return null;
      if (Date.now() - parsed.time > CACHE_TTL) return null;
      return parsed.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: data })); }
    catch (e) { /* ignore */ }
  }

  function sortRepos(repos) {
    var pinned = [];
    var rest = [];
    repos.forEach(function (r) {
      if (PINNED.indexOf(r.name) >= 0) pinned.push(r);
      else rest.push(r);
    });
    pinned.sort(function (a, b) { return PINNED.indexOf(a.name) - PINNED.indexOf(b.name); });
    rest.sort(function (a, b) { return new Date(b.pushed_at) - new Date(a.pushed_at); });
    return pinned.concat(rest);
  }

  var cached = readCache();
  if (cached) {
    allRepos = cached;
    renderGrid();
    return;
  }

  fetch("https://api.github.com/users/crodyy/repos?per_page=100&sort=pushed")
    .then(function (res) {
      if (!res.ok) throw new Error("github " + res.status);
      return res.json();
    })
    .then(function (data) {
      var kept = data.filter(function (r) {
        return !r.fork && !r.archived && HIDDEN_REPOS.indexOf(r.name) < 0;
      });
      var ordered = sortRepos(kept);
      allRepos = normalize(ordered);
      if (!allRepos.length) allRepos = FALLBACK;
      writeCache(allRepos);
      renderGrid();
    })
    .catch(function () {
      allRepos = FALLBACK;
      renderGrid();
    });
})();

/* avatar toggle: pressing the avatar cycles the profile photos.
   preloads first so a missing file never breaks the visible photo. */
(function () {
  var frame = document.querySelector(".nav-avatar");
  var img = frame ? frame.querySelector("img") : null;
  if (!frame || !img) return;
  var PHOTOS = ["photos/pfp-1.png", "photos/pfp-2.png"];
  var idx = 1;
  frame.addEventListener("click", function () {
    var next = PHOTOS[(idx + 1) % PHOTOS.length];
    var probe = new Image();
    probe.onload = function () {
      idx = (idx + 1) % PHOTOS.length;
      img.src = next;
      frame.setAttribute("aria-pressed", idx === 1 ? "false" : "true");
    };
    probe.src = next;
  });
})();

/* click burst: 3 short lines radiate from the click point and fade.
   fires on every primary pointerdown; disabled under reduced motion. */
(function () {
  if (reduceMotion) return;
  var canvas = document.getElementById("burst");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var bursts = [];
  var running = false;
  var LIFE = 380;
  var burstRGB = "158,221,247";
  function refreshBurst() {
    var v = window.getComputedStyle(document.documentElement).getPropertyValue("--burst");
    if (v) burstRGB = v.trim().replace(/\s+/g, "");
  }
  refreshBurst();
  window.__refreshBurst = refreshBurst;
  /* fan of 3 lines across 75 degrees, tilted just right of the
     arrowhead, so nothing overlaps the arrow body */
  var FAN_CENTER = -11 * Math.PI / 18;
  var DIRS = [-1, 0, 1].map(function (i) { return FAN_CENTER + i * (5 * Math.PI / 24); });
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);
  function tick(now) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    bursts = bursts.filter(function (b) { return now - b.t0 < LIFE; });
    bursts.forEach(function (b) {
      var t = (now - b.t0) / LIFE;
      var e = 1 - Math.pow(1 - t, 3);
      var r = 10 + e * 26;
      ctx.strokeStyle = "rgba(" + burstRGB + "," + (0.9 * (1 - t)).toFixed(3) + ")";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      b.dirs.forEach(function (a) {
        ctx.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
        ctx.lineTo(b.x + Math.cos(a) * (r + 10), b.y + Math.sin(a) * (r + 10));
      });
      ctx.stroke();
    });
    if (bursts.length) { window.requestAnimationFrame(tick); }
    else { running = false; }
  }
  document.addEventListener("pointerdown", function (e) {
    if (e.button === 2) return;
    bursts.push({ x: e.clientX, y: e.clientY, t0: performance.now(), dirs: DIRS });
    if (!running) { running = true; window.requestAnimationFrame(tick); }
  });
})();

/* mobile menu: burger toggles a slide-in panel from the right.
   closes on link tap, outside tap, or escape. */
(function () {
  var btn = document.getElementById("menu-btn");
  var nav = document.querySelector(".site-nav nav");
  if (!btn || !nav) return;
  function set(open) {
    nav.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "close menu" : "open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  btn.addEventListener("click", function () { set(!nav.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  document.addEventListener("click", function (e) {
    if (nav.classList.contains("is-open") && !e.target.closest(".site-nav")) set(false);
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768 && nav.classList.contains("is-open")) set(false);
  });
})();

/* nav scroll behavior: below 120px the bar sits still; past that it
   eases away with downward scrolls and eases fully back on sustained
   upward scrolls. one passive listener, rAF throttle, transform-only
   motion, plain variables. */
(function () {
  var nav = document.querySelector(".site-nav");
  if (!nav) return;
  var menuNav = nav.querySelector("nav");
  var navH = nav.offsetHeight || 64;
  var RANGE = 120;
  var focused = false;
  var ticking = false;
  var lastY = -1;
  var upTravel = 0;
  var downTravel = 0;
  var shown = 0;
  var target = 0;
  var smoothing = false;
  function limits() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return Math.max(0, max);
  }
  function paint() {
    nav.style.transform = shown > 0.5 ? "translateY(" + (-shown).toFixed(1) + "px)" : "";
  }
  function smooth() {
    var d = target - shown;
    if (Math.abs(d) < 0.3) {
      smoothing = false;
      shown = target;
      paint();
      return;
    }
    shown += d * 0.18;
    paint();
    window.requestAnimationFrame(smooth);
  }
  function kick() {
    if (!smoothing) { smoothing = true; window.requestAnimationFrame(smooth); }
  }
  function update() {
    ticking = false;
    var max = limits();
    var y = window.scrollY || window.pageYOffset;
    if (y < 0) y = 0;
    if (y > max) y = max;
    nav.setAttribute("data-scrolled", y > 8 ? "true" : "false");
    var pinned = reduceMotion || focused ||
      (menuNav && menuNav.classList.contains("is-open")) ||
      max - y <= 40;
    if (pinned) {
      target = 0;
      upTravel = 0;
      downTravel = 0;
    } else if (lastY >= 0 && y > lastY) {
      upTravel = 0;
      downTravel += y - lastY;
      if (downTravel >= 8) {
        var past = Math.max(0, y - 120);
        target = Math.min(navH, (past * navH) / RANGE);
      }
    } else if (lastY >= 0 && y < lastY) {
      downTravel = 0;
      upTravel += lastY - y;
      if (upTravel >= 24) target = 0;
    }
    lastY = y;
    if (reduceMotion) { shown = target; paint(); return; }
    kick();
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", function () { navH = nav.offsetHeight || 64; });
  nav.addEventListener("focusin", function () { focused = true; update(); });
  nav.addEventListener("focusout", function () { focused = false; update(); });
  update();
  var lockedUntil = 0;
  var navLinks = nav.querySelectorAll('a[href^="#"]');
  navLinks.forEach(function (l) {
    l.addEventListener("click", function () {
      navLinks.forEach(function (o) { o.classList.remove("is-active"); });
      l.classList.add("is-active");
      lockedUntil = Date.now() + 600;
    });
  });
  window.__navScrollLock = function () { return Date.now() < lockedUntil; };
})();

/* activity heatmap: last-year github contributions, rendered in site type.
   hidden section stays hidden if the data source is unreachable. */
(function () {
  var section = document.getElementById("activity");
  var grid = document.getElementById("activity-grid");
  var monthsEl = document.getElementById("activity-months");
  var totalEl = document.getElementById("activity-total");
  if (!section || !grid || !monthsEl || !totalEl) return;
  var KEY = "crodyy-activity-v1";
  var TTL = 60 * 60 * 1000;
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function readCache() {
    try {
      var raw = window.sessionStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.time || !parsed.data) return null;
      if (Date.now() - parsed.time > TTL) return null;
      return parsed.data;
    } catch (e) { return null; }
  }
  function writeCache(data) {
    try { window.sessionStorage.setItem(KEY, JSON.stringify({ time: Date.now(), data: data })); }
    catch (e) { /* ignore */ }
  }
  function monthName(dateStr) {
    return MONTHS[new Date(dateStr + "T00:00:00").getMonth()];
  }
  function render(data) {
    var days = data && data.contributions;
    if (!days || !days.length) return false;
    var weeks = Math.ceil(days.length / 7);
    var template = "repeat(" + weeks + ", 14px)";
    grid.style.gridTemplateColumns = template;
    monthsEl.style.gridTemplateColumns = template;
    var cellFrag = document.createDocumentFragment();
    var monthFrag = document.createDocumentFragment();
    var lastLabel = "";
    var lastLabelCol = -10;
    for (var w = 0; w < weeks; w++) {
      var first = days[w * 7];
      var label = document.createElement("span");
      if (first) {
        var name = monthName(first.date);
        if (name !== lastLabel && w - lastLabelCol >= 5) {
          label.textContent = name;
          lastLabel = name;
          lastLabelCol = w;
        }
      }
      monthFrag.appendChild(label);
      for (var d = 0; d < 7 && w * 7 + d < days.length; d++) {
        var day = days[w * 7 + d];
        var cell = document.createElement("div");
        var level = Math.max(0, Math.min(4, day.level || 0));
        cell.className = "act-cell lv" + level;
        cell.title = day.count + " contribution" + (day.count === 1 ? "" : "s") + " on " + day.date;
        cellFrag.appendChild(cell);
      }
    }
    monthsEl.appendChild(monthFrag);
    grid.appendChild(cellFrag);
    var total = data.total && (data.total.lastYear || data.total.last_year);
    if (typeof total !== "number") {
      total = days.reduce(function (sum, day) { return sum + (day.count || 0); }, 0);
    }
    totalEl.textContent = total + " contributions in the last year";
    section.removeAttribute("hidden");
    return true;
  }
  var cached = readCache();
  if (cached) { render(cached); return; }
  fetch("https://github-contributions-api.jogruber.de/v4/crodyy?y=last")
    .then(function (res) {
      if (!res.ok) throw new Error("activity " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (render(data)) writeCache(data);
    })
    .catch(function () { /* section stays hidden */ });
})();
