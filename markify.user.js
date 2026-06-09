// ==UserScript==
// @name        Markify
// @namespace   Violentmonkey Scripts
// @version     1.0
// @match       *://*/*
// @grant       none
// @description Destaca múltiplos termos em qualquer página. F4 para abrir.
// ==/UserScript==

(function () {
  'use strict';

  const HL = 'mkf-hl';
  const ID = 'mkf-panel';
  const TID = 'mkf-ta';

  const COLORS = [
    ['rgba(255,235,59,.85)', '#5f4800'],
    ['rgba(165,214,167,.85)', '#1b4f1e'],
    ['rgba(144,202,249,.85)', '#0d3461'],
    ['rgba(239,154,154,.85)', '#6b1616'],
    ['rgba(206,147,216,.85)', '#4a1258'],
    ['rgba(255,204,128,.85)', '#5a3200'],
    ['rgba(128,222,234,.85)', '#00464e'],
    ['rgba(244,143,177,.85)', '#6b0e2e'],
  ];

  const css = document.createElement('style');
  css.textContent =
    '.' +
    HL +
    '{border-radius:2px;padding:0 2px;font-weight:500}' +
    COLORS.map(([bg, fg], i) => '.' + HL + i + '{background:' + bg + ';color:' + fg + '!important}').join('') +
    '#' +
    ID +
    '{' +
    'position:fixed;top:12px;right:12px;width:220px;z-index:2147483647;' +
    'background:rgba(255,255,255,0.72);' +
    'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
    'border:1px solid rgba(255,255,255,0.9);border-radius:10px;' +
    'padding:8px 10px;box-shadow:0 2px 16px rgba(0,0,0,.13);' +
    'font-family:system-ui,sans-serif;box-sizing:border-box' +
    '}' +
    '#mkf-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}' +
    '#mkf-hdr span{font-size:10px;font-weight:600;letter-spacing:.06em;' +
    'text-transform:uppercase;color:rgba(0,0,0,.38)}' +
    '#mkf-x{width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,.1);' +
    'border:none;cursor:pointer;font-size:10px;color:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;padding:0;line-height:1}' +
    '#mkf-x:hover{background:rgba(0,0,0,.2)}' +
    '#' +
    TID +
    '{width:100%;height:68px;resize:none;font-size:12px;line-height:1.5;' +
    'padding:5px 7px;box-sizing:border-box;border:1px solid rgba(0,0,0,.13);' +
    'border-radius:6px;background:rgba(255,255,255,.55);outline:none;' +
    'font-family:system-ui,sans-serif;color:#111}' +
    '#' +
    TID +
    '::placeholder{color:rgba(0,0,0,.28);font-size:11px}' +
    '#mkf-leg{display:flex;flex-wrap:wrap;gap:3px;margin-top:7px;min-height:0}' +
    '#mkf-leg span{font-size:10px;padding:1px 6px;border-radius:3px;font-weight:500;cursor:default}' +
    '#mkf-hint{font-size:10px;color:rgba(0,0,0,.28);margin-top:5px}';
  document.head.appendChild(css);

  function clearHighlights() {
    document.querySelectorAll('.' + HL).forEach((m) => {
      const p = m.parentNode;
      if (!p) return;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
  }

  function collectTextNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        if (el.closest('#' + ID + ',script,style,noscript,textarea,input,select')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function highlight(terms) {
    clearHighlights();
    if (!terms.length) return [];

    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const sorted = escaped.slice().sort((a, b) => b.length - a.length);
    const regex = new RegExp('(' + sorted.join('|') + ')', 'gi');

    const colorMap = {};
    terms.forEach((t, i) => {
      colorMap[t.toLowerCase()] = i % COLORS.length;
    });

    const counts = {};
    terms.forEach((t) => {
      counts[t.toLowerCase()] = 0;
    });

    collectTextNodes().forEach((node) => {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0,
        m;

      while ((m = regex.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));

        const matchedLower = m[1].toLowerCase();
        const colorIdx = colorMap[matchedLower] ?? 0;
        counts[matchedLower] = (counts[matchedLower] || 0) + 1;

        const mark = document.createElement('mark');
        mark.className = HL + ' ' + HL + colorIdx;
        mark.textContent = m[1];
        frag.appendChild(mark);
        last = regex.lastIndex;
      }

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });

    return terms.map((t, i) => ({
      label: t,
      count: counts[t.toLowerCase()] || 0,
      ci: i % COLORS.length,
    }));
  }

  function parseTerms(v) {
    return v
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function renderLegend(results) {
    const leg = document.getElementById('mkf-leg');
    if (!leg) return;
    while (leg.firstChild) leg.removeChild(leg.firstChild);
    results.forEach((r) => {
      const b = document.createElement('span');
      b.textContent = r.label + ' (' + r.count + ')';
      b.style.cssText = 'background:' + COLORS[r.ci][0] + ';color:' + COLORS[r.ci][1];
      leg.appendChild(b);
    });
  }

  function openPanel() {
    if (document.getElementById(ID)) {
      document.getElementById(TID).focus();
      return;
    }

    const panel = document.createElement('div');
    panel.id = ID;

    const hdr = document.createElement('div');
    hdr.id = 'mkf-hdr';
    const title = document.createElement('span');
    title.textContent = 'markify';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'mkf-x';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.addEventListener('click', closePanel);
    hdr.appendChild(title);
    hdr.appendChild(closeBtn);

    const ta = document.createElement('textarea');
    ta.id = TID;
    ta.placeholder = 'termos, um por linha ou vírgula...';

    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') return;
      e.stopPropagation();
      //if (e.key === 'Enter' && e.ctrlKey) {
      //  e.preventDefault();
      //  renderLegend(highlight(parseTerms(ta.value)));
      //}
    });

    let debounceTimer;

    ta.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        renderLegend(highlight(parseTerms(ta.value)));
      }, 300);
    });

    const leg = document.createElement('div');
    leg.id = 'mkf-leg';

    const hint = document.createElement('div');
    hint.id = 'mkf-hint';
    //hint.textContent = 'Ctrl+Enter buscar · Esc fechar';
    hint.textContent = 'Esc fechar';

    panel.appendChild(hdr);
    panel.appendChild(ta);
    panel.appendChild(leg);
    panel.appendChild(hint);
    document.body.appendChild(panel);
    ta.focus();
  }

  function closePanel() {
    const p = document.getElementById(ID);
    if (p) p.remove();
    clearHighlights();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F4') {
      e.preventDefault();
      openPanel();
      return;
    }
    if (e.key === 'Escape' && document.getElementById(ID)) {
      e.preventDefault();
      closePanel();
    }
  });
})();
