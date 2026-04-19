/* global markdownit, texmath, katex, hljs */

(function () {
  'use strict';

  const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(str, { language: lang }).value; } catch (e) {}
      }
      return '';
    }
  });

  md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false, trust: true }
  });

  let currentPath = '';

  function stripFrontmatter(raw) {
    return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function addHeadingIds(html) {
    return html.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, attrs, content) => {
        const text = content.replace(/<[^>]*>/g, '');
        const id = slugify(text);
        return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
      });
  }

  function normalizePath(p) {
    const parts = [];
    for (const seg of p.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg && seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  }

  function rewriteLinks(html, pagePath) {
    const dir = pagePath.substring(0, pagePath.lastIndexOf('/'));
    return html.replace(/href="([^"]*\.md)(#[^"]*)?"/g,
      (match, mdPath, anchor) => {
        if (mdPath.startsWith('http://') || mdPath.startsWith('https://'))
          return match;
        let resolved;
        if (mdPath.charAt(0) === '/') {
          resolved = mdPath.slice(1);
        } else {
          resolved = normalizePath(dir + '/' + mdPath);
        }
        return `href="md:${resolved}${anchor || ''}"`;
      });
  }

  // Called from C++ via runJavaScript("window.renderPage([raw, path])")
  window.renderPage = function (args) {
    const raw = args[0];
    const pagePath = args[1];
    currentPath = pagePath;

    const stripped = stripFrontmatter(raw);
    let html = md.render(stripped);
    html = addHeadingIds(html);
    html = rewriteLinks(html, pagePath);

    const el = document.getElementById('content');
    el.innerHTML = html;
    window.scrollTo(0, 0);

    // Handle anchor clicks (same-page #id links) via event delegation
    el.onclick = function (e) {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      e.preventDefault();
      const target = document.getElementById(href.slice(1));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    };
  };
  // --- Vim-style keybindings ---
  let gPending = false;
  let gTimer = 0;

  document.addEventListener('keydown', function (e) {
    const key = e.key;
    const ctrl = e.ctrlKey;

    // j — scroll down
    if (key === 'j' && !ctrl) {
      window.scrollBy(0, 80);
      e.preventDefault(); return;
    }
    // k — scroll up
    if (key === 'k' && !ctrl) {
      window.scrollBy(0, -80);
      e.preventDefault(); return;
    }
    // G (shift+g) — scroll to bottom
    if (key === 'G') {
      window.scrollTo(0, document.body.scrollHeight);
      e.preventDefault(); return;
    }
    // g — gg sequence for scroll to top
    if (key === 'g' && !ctrl) {
      if (gPending) {
        gPending = false;
        clearTimeout(gTimer);
        window.scrollTo(0, 0);
      } else {
        gPending = true;
        gTimer = setTimeout(function () { gPending = false; }, 500);
      }
      e.preventDefault(); return;
    }
    // Ctrl+d — half page down
    if (key === 'd' && ctrl) {
      window.scrollBy(0, window.innerHeight / 2);
      e.preventDefault(); return;
    }
    // Ctrl+u — half page up
    if (key === 'u' && ctrl) {
      window.scrollBy(0, -window.innerHeight / 2);
      e.preventDefault(); return;
    }
    // Ctrl+f — full page down
    if (key === 'f' && ctrl) {
      window.scrollBy(0, window.innerHeight);
      e.preventDefault(); return;
    }
    // Ctrl+b — full page up
    if (key === 'b' && ctrl) {
      window.scrollBy(0, -window.innerHeight);
      e.preventDefault(); return;
    }
    // Tab — focus sidebar tree
    if (key === 'Tab') {
      window.location.href = 'cmd:focus-tree';
      e.preventDefault(); return;
    }
    // h — previous page
    if (key === 'h' && !ctrl) {
      window.location.href = 'cmd:prev';
      e.preventDefault(); return;
    }
    // l — next page
    if (key === 'l' && !ctrl) {
      window.location.href = 'cmd:next';
      e.preventDefault(); return;
    }

    // Reset g sequence on any other key
    if (gPending) {
      gPending = false;
      clearTimeout(gTimer);
    }
  });
})();
