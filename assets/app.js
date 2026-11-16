(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---- theme
  var saved = get('gsb-theme');
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // ---- translation: fixed on a translation's own pages; chosen by the reader on shared pages (Gill, compare)
  var EDS = ['kjv', 'bsb', 'msb'];
  var OWN = root.getAttribute('data-ed'), ED = OWN;
  if (OWN) set('gsb-ed', OWN);
  else {
    var qe = /[?&]ed=(kjv|bsb|msb)/.exec(window.location.search), se = get('gsb-ed');
    ED = qe ? qe[1] : (EDS.indexOf(se) >= 0 ? se : 'kjv');
    root.setAttribute('data-ed', ED); set('gsb-ed', ED);
  }
  function withEd(h) {      // point a link on a shared page at the chosen translation
    if (/^\.\.\/(kjv|bsb|msb)\//.test(h)) return h.replace(/^\.\.\/(kjv|bsb|msb)\//, '../' + ED + '/');
    var m = /^((?:\.\.\/(?:gill|compare)\/)?[a-z0-9]+-\d+\.html)(?:\?ed=[a-z]+)?(#.*)?$/.exec(h);
    return m ? m[1] + '?ed=' + ED + (m[2] || '') : h;
  }
  function pointLinks() {
    var as = document.querySelectorAll('a[href]:not([data-keep])'), i, h, n;
    for (i = 0; i < as.length; i++) { h = as[i].getAttribute('href'); if (h.charAt(0) === '#') continue; n = withEd(h); if (n !== h) as[i].setAttribute('href', n); }
    var os = document.querySelectorAll('.chsel option');
    for (i = 0; i < os.length; i++) os[i].value = withEd(os[i].value);
  }

  var EMBED = /[?&]embed=1/.test(window.location.search);
  if (EMBED) {
    root.className += ' embed';
    var tm = /[?&]theme=(dark|light)/.exec(window.location.search);
    if (tm) root.setAttribute('data-theme', tm[1]);
  }

  // ---- "Go to" box: a reference goes to the text, a single word to the concordance
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function findBook(tok) {
    var B = window.GSB_BOOKS || [], t = norm(tok).replace(/^iii/, '3').replace(/^ii/, '2').replace(/^i(?=[a-z]{2})/, '1'), i, j;
    if (/^i(sam|ki|ch|co|th|ti|pe|jo|jn)/.test(norm(tok))) t = '1' + norm(tok).slice(1);
    for (i = 0; i < B.length; i++) {
      if (norm(B[i][1]) === t) return B[i];
      for (j = 0; j < B[i][3].length; j++) if (B[i][3][j] === t) return B[i];
    }
    if (t.length >= 2) for (i = 0; i < B.length; i++) if (norm(B[i][1]).indexOf(t) === 0) return B[i];
    return null;
  }
  function resolve(q) {
    q = q.replace(/^\s+|\s+$/g, '');
    if (!q) return null;
    var m = /^((?:[1-3]|i{1,3})?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\.?\s*(\d+)?(?:\s*[:.,\s]\s*(\d+))?/i.exec(q);
    if (m) {
      var b = findBook(m[1]);
      if (b) {
        if (!m[2]) return { href: 'bible/' + b[0] + '.html' };
        var c = +m[2], v = m[3] ? +m[3] : 0;
        if (b[2] === 1 && !m[3] && c > 1) { v = c; c = 1; }
        if (c < 1 || c > b[2]) return { msg: b[1] + ' has ' + b[2] + (b[2] === 1 ? ' chapter' : ' chapters') };
        return { href: 'bible/' + b[0] + '-' + c + '.html' + (v ? '#v' + v : '') };
      }
    }
    if (/^[a-z][a-z'’-]+$/i.test(q)) {
      var w = q.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
      return { href: 'concordance/' + w.charAt(0) + '.html#w-' + w };
    }
    return { msg: 'Try a reference such as John 3:16' };
  }

  // ---- notes and cross-references shown in place
  var pop = null, popFor = null;
  function closePop() { if (pop) { pop.parentNode.removeChild(pop); pop = null; popFor = null; } }
  function openPop(a) {
    var id = (a.getAttribute('href') || '').slice(1), target = id && document.getElementById(id);
    if (!target) return false;
    if (popFor === a) { closePop(); return true; }
    closePop();
    pop = document.createElement('div'); pop.className = 'pop'; pop.setAttribute('role', 'note');
    var c = target.cloneNode(true); c.removeAttribute('id');
    var back = c.querySelector('.fnb'); if (back) back.parentNode.removeChild(back);
    pop.innerHTML = c.innerHTML;
    document.body.appendChild(pop);
    var r = a.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.max(8, Math.min(r.left - 16, vw - w - 8));
    pop.style.left = (left + window.pageXOffset) + 'px';
    pop.style.top = (r.bottom + window.pageYOffset + 6) + 'px';
    popFor = a;
    return true;
  }

  // ---- Gill's comment on a verse, shown in a box over the text
  var gbox = null, gboxFor = null;
  function closeGill() { if (gbox) { gbox.parentNode.removeChild(gbox); gbox = null; gboxFor = null; } }
  function openGill(a) {
    if (gboxFor === a) { closeGill(); return; }
    closeGill(); closePop();
    var href = a.getAttribute('href'), parts = href.split('#');
    gbox = document.createElement('div'); gbox.className = 'gbox'; gbox.setAttribute('role', 'dialog');
    gbox.setAttribute('aria-label', a.getAttribute('title') || 'Gill on this verse');
    var head = document.createElement('div'); head.className = 'gbox-h';
    var ttl = document.createElement('span'); ttl.textContent = a.getAttribute('title') || 'Gill on this verse';
    var x = document.createElement('button'); x.type = 'button'; x.textContent = 'Close'; x.addEventListener('click', closeGill);
    head.appendChild(ttl); head.appendChild(x);
    var fr = document.createElement('iframe');
    fr.title = ttl.textContent;
    fr.src = parts[0] + (parts[0].indexOf('?') < 0 ? '?' : '&') + 'embed=1&theme=' + (isDark() ? 'dark' : 'light') + '#' + (parts[1] || '');
    var full = document.createElement('a'); full.href = href; full.className = 'gbox-full'; full.textContent = 'Open the full commentary';
    head.insertBefore(full, x);
    gbox.appendChild(head); gbox.appendChild(fr);
    document.body.appendChild(gbox);
    var r = a.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = gbox.offsetWidth;
    var main = document.querySelector('main'), mr = main ? main.getBoundingClientRect() : { left: 8 };
    gbox.style.left = (Math.max(8, Math.min(mr.left + 8, vw - w - 8)) + window.pageXOffset) + 'px';
    gbox.style.top = (r.bottom + window.pageYOffset + 8) + 'px';
    gboxFor = a; x.focus();
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (gbox && d && typeof d.gsbHeight === 'number') {
      var max = Math.max(220, Math.round(window.innerHeight * 0.6));
      gbox.querySelector('iframe').style.height = Math.min(max, Math.max(90, d.gsbHeight)) + 'px';
      var br = gbox.getBoundingClientRect();
      if (br.bottom > window.innerHeight) window.scrollBy(0, Math.min(br.bottom - window.innerHeight + 12, Math.max(0, br.top - 110)));
    }
    if (d && d.gsbClose) closeGill();
  });

  document.addEventListener('DOMContentLoaded', function () {
    var top = document.body.getAttribute('data-top') || '';
    var base = OWN ? (document.body.getAttribute('data-root') || '') : '../' + ED + '/';
    var page = /([a-z0-9]+)-(\d+)\.html$/.exec(window.location.pathname);
    if (!OWN) pointLinks();

    // translation picker: keeps the place
    var es = document.getElementById('edsel');
    if (es) {
      es.value = ED;
      es.addEventListener('change', function () {
        var to = es.value;
        if (!OWN) {          // Gill and compare pages change in place
          ED = to; set('gsb-ed', ED); root.setAttribute('data-ed', ED); base = '../' + ED + '/'; pointLinks(); closeGill();
          return;
        }
        var m = /\/(kjv|bsb|msb)\/([^?#]*)$/.exec(window.location.pathname), path = (m && m[2]) || 'index.html';
        var cl = /^concordance\/([a-z])\.html$/.exec(path);
        if (cl && window.GSB_CONC && (window.GSB_CONC[to] || '').indexOf(cl[1]) < 0) path = 'concordance/index.html';
        set('gsb-ed', to);
        window.location.href = top + to + '/' + path + window.location.hash;
      });
    }

    // compare view: which translations to show
    var cmp = document.querySelector('.cmp'), boxes = document.querySelectorAll('.cmpsel input');
    if (cmp && boxes.length) {
      var want = (get('gsb-cmp') || EDS.join(',')).split(',');
      var apply = function (save) {
        var on = [], i;
        for (i = 0; i < boxes.length; i++) if (boxes[i].checked) on.push(boxes[i].value);
        for (i = 0; i < EDS.length; i++) cmp.classList.toggle('hide-' + EDS[i], on.indexOf(EDS[i]) < 0);
        cmp.style.setProperty('--n', on.length);
        if (save) set('gsb-cmp', on.join(','));
      };
      for (var b = 0; b < boxes.length; b++) {
        boxes[b].checked = want.indexOf(boxes[b].value) >= 0;
        boxes[b].addEventListener('change', function (e) {
          var any = false;
          for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) any = true;
          if (!any) e.target.checked = true;      // always at least one
          apply(true);
        });
      }
      var anyOn = false;
      for (b = 0; b < boxes.length; b++) if (boxes[b].checked) anyOn = true;
      if (!anyOn) for (b = 0; b < boxes.length; b++) boxes[b].checked = true;
      apply(false);
    }

    // hosted copy: keep pages for offline reading
    var hosted = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (hosted && 'serviceWorker' in navigator && window.caches && !EMBED) {
      navigator.serviceWorker.register(top + 'sw.js').catch(function () {});
      var off = document.getElementById('offline'), om = document.getElementById('offmsg');
      if (off) {
        off.hidden = false;
        var saveAll = function (which, btn) {
          btn.disabled = true; om.textContent = 'Starting…';
          var rootUrl = new URL(top, window.location.href).href;
          fetch(rootUrl + 'assets/files-' + which + '.json').then(function (r) { return r.json(); }).then(function (list) {
            return caches.open('gsb-' + window.GSB_BUILD).then(function (cache) {
              var i = 0, done = 0, failed = 0;
              var one = function () {
                if (i >= list.length) return Promise.resolve();
                var u = rootUrl + list[i++];
                return cache.match(u).then(function (hit) {
                  if (hit) return null;
                  return fetch(u).then(function (r) {
                    if (!r.ok) { failed++; return null; }
                    if (!r.redirected) return cache.put(u, r);
                    return r.blob().then(function (bl) { return cache.put(u, new Response(bl, { status: r.status, statusText: r.statusText, headers: r.headers })); });
                  });
                }).catch(function () { failed++; }).then(function () {
                  done++;
                  if (done % 20 === 0 || done === list.length) om.textContent = 'Saved ' + done + ' of ' + list.length + ' pages…';
                  return one();
                });
              };
              return Promise.all([one(), one(), one(), one(), one(), one()]).then(function () {
                om.textContent = failed ? (list.length - failed) + ' pages saved; ' + failed + ' could not be fetched. Press the button again to finish.'
                                        : 'Done: ' + list.length + ' pages are saved on this device.';
                btn.disabled = false;
              });
            });
          }).catch(function () { om.textContent = 'Could not save just now. Check the connection and try again.'; btn.disabled = false; });
        };
        var sb = off.querySelectorAll('button[data-save]');
        for (var k = 0; k < sb.length; k++) sb[k].addEventListener('click', function (e) { saveAll(e.target.getAttribute('data-save'), e.target); });
      }
    }

    if (EMBED) {
      // show only the verse asked for; links to other pages open in the main window
      var id = window.location.hash.slice(1), sec = id && document.getElementById(id);
      if (sec) sec.className += ' only';
      var as = document.querySelectorAll('a[href]');
      for (var q = 0; q < as.length; q++) if (as[q].getAttribute('href').charAt(0) !== '#') as[q].target = '_top';
      var tell = function () { if (window.parent !== window) window.parent.postMessage({ gsbHeight: Math.ceil((document.querySelector('main') || document.body).getBoundingClientRect().height) + 2 }, '*'); };
      tell(); window.addEventListener('load', tell); window.setTimeout(tell, 300);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.querySelector('.pop')) window.parent.postMessage({ gsbClose: 1 }, '*'); });
    }

    var tb = document.getElementById('theme');
    if (tb) {
      var label = function () { tb.textContent = isDark() ? 'Light' : 'Dark'; };
      label();
      tb.addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        root.setAttribute('data-theme', next); set('gsb-theme', next); label();
      });
    }

    var go = document.getElementById('go'), msg = document.getElementById('gomsg');
    if (go && go.form) {
      go.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var r = resolve(go.value);
        if (!r) return;
        if (r.href) {
          var cm = cmp && /^bible\/([a-z0-9]+-\d+\.html)(#.*)?$/.exec(r.href);      // on a compare page, stay in the compare view
          window.location.href = cm ? cm[1] + '?ed=' + ED + (cm[2] || '') : base + r.href; return;
        }
        msg.textContent = r.msg;
      });
      go.addEventListener('input', function () { msg.textContent = ''; });
    }

    // chapter list in the page head
    var sel = document.querySelector('.chsel');
    if (sel) sel.addEventListener('change', function () { window.location.href = sel.value; });

    // left and right arrow keys turn the chapter; "/" puts the cursor in the Go box
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (e.key === 'Escape') { closePop(); closeGill(); return; }
      if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === '/' && go) { e.preventDefault(); go.focus(); return; }
      var a = e.key === 'ArrowLeft' ? document.querySelector('.cnav a[rel=prev]') : e.key === 'ArrowRight' ? document.querySelector('.cnav a[rel=next]') : null;
      if (a) window.location.href = a.href;
    });

    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.scripture a.xm, .scripture a.fnr, .gill a.nm:not(.fnb)') : null;
      if (a) { if (openPop(a)) e.preventDefault(); return; }
      if (pop && !(e.target.closest && e.target.closest('.pop'))) closePop();
      var vn = e.target.closest ? e.target.closest('.scripture a.vn, .cmp a.vn') : null;
      if (vn && !EMBED && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); openGill(vn); return; }
      if (gbox && !(e.target.closest && e.target.closest('.gbox'))) closeGill();
    });
    window.addEventListener('resize', function () { closePop(); closeGill(); });

    // remember the last chapter read; offer it on the home page
    var art = document.querySelector('article.chapter, article.gill, article.cmpart');
    var h1 = art && art.querySelector('.chead h1');
    if (h1 && !EMBED) {
      var path = (OWN ? OWN + '/' : '') + window.location.pathname.split('/').slice(-2).join('/');
      set('gsb-last', JSON.stringify({ href: path, label: (document.body.className.indexOf('gillpage') >= 0 ? 'Gill on ' : document.body.className.indexOf('cmppage') >= 0 ? 'Comparing ' : '') + h1.textContent.replace(/\s+/g, ' ') + (OWN ? ' (' + OWN.toUpperCase() + ')' : '') }));
    }
    var res = document.getElementById('resume');
    if (res) {
      try {
        var last = JSON.parse(get('gsb-last') || 'null');
        if (last && /^((kjv|bsb|msb)\/bible|gill|compare)\/[a-z0-9-]+\.html$/.test(last.href)) {
          var link = res.querySelector('a'); link.href = top + last.href; link.textContent = last.label; res.hidden = false;
        }
      } catch (err) {}
    }

    // reading plans: mark today's row and offer a jump to it
    var d = new Date(), id = 'd' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var row = document.getElementById(id), nav = document.querySelector('.monthnav');
    if (row && nav) {
      row.className += ' today';
      var j = document.createElement('a');
      j.href = '#' + id; j.className = 'jump'; j.textContent = 'Today';
      nav.insertBefore(j, nav.firstChild);
      if (window.location.hash === '#today') row.scrollIntoView({ block: 'center' });
    }

    // concordance: narrow the word list while typing
    var wf = document.getElementById('wf');
    if (wf) {
      var secs = document.querySelectorAll('.widx');
      wf.addEventListener('input', function () {
        var q = wf.value.toLowerCase().replace(/^\s+|\s+$/g, '');
        for (var i = 0; i < secs.length; i++) {
          var links = secs[i].querySelectorAll('a'), any = false;
          for (var k = 0; k < links.length; k++) {
            var ok = !q || links[k].textContent.toLowerCase().indexOf(q) === 0;
            links[k].hidden = !ok; if (ok) any = true;
          }
          secs[i].hidden = !any;
        }
      });
    }
  });
})();
