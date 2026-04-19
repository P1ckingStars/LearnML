/* global markdownit, texmath, katex, hljs */

(function () {
  'use strict';

  // --- Markdown renderer setup ---

  const md = markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(str, { language: lang }).value; } catch {}
      }
      return '';
    }
  });

  md.use(texmath, {
    engine: katex,
    delimiters: 'dollars',
    katexOptions: { throwOnError: false, trust: true }
  });

  // --- State ---

  let manifest = null;   // { sections, flatOrder }
  let currentPath = null;

  const tocEl = document.getElementById('toc');
  const pageEl = document.getElementById('page');
  const pageNavEl = document.getElementById('page-nav');
  const sidebarEl = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const titleEl = document.getElementById('site-title');

  // --- Sidebar toggle ---

  toggleBtn.addEventListener('click', () => {
    sidebarEl.classList.toggle('open');
  });

  // Close sidebar when clicking content on mobile
  document.getElementById('content').addEventListener('click', () => {
    sidebarEl.classList.remove('open');
  });

  // --- Load manifest and boot ---

  async function boot() {
    const res = await fetch('/api/manifest');
    manifest = await res.json();

    // Set title from first section's first page if it's README
    if (manifest.flatOrder.length > 0) {
      const first = manifest.flatOrder[0];
      if (first.path === 'README.md') {
        titleEl.textContent = first.title;
      }
    }

    renderTOC();

    // Navigate to hash or first page
    if (location.hash && location.hash.length > 2) {
      await navigateTo(location.hash.slice(2)); // strip #/
    } else if (manifest.flatOrder.length > 0) {
      await navigateTo(manifest.flatOrder[0].path);
    }
  }

  // --- TOC rendering ---

  function renderTOC() {
    tocEl.innerHTML = '';
    for (const section of manifest.sections) {
      const details = document.createElement('details');
      details.className = 'toc-section';
      details.open = true;

      const summary = document.createElement('summary');
      summary.textContent = section.title;
      details.appendChild(summary);

      const ul = document.createElement('ul');
      for (const page of section.pages) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#/' + page.path;
        a.textContent = page.title;
        a.dataset.path = page.path;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo(page.path);
          sidebarEl.classList.remove('open');
        });
        li.appendChild(a);
        ul.appendChild(li);
      }
      details.appendChild(ul);
      tocEl.appendChild(details);
    }
  }

  function updateActiveTOC(pagePath) {
    const links = tocEl.querySelectorAll('a');
    for (const a of links) {
      if (a.dataset.path === pagePath) {
        a.classList.add('active');
        // Ensure parent details is open
        const details = a.closest('details');
        if (details) details.open = true;
        // Scroll into view
        a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        a.classList.remove('active');
      }
    }
  }

  // --- Heading slug generation ---

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Add IDs to rendered headings
  function addHeadingIds(html) {
    return html.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
      const text = content.replace(/<[^>]*>/g, '');
      const id = slugify(text);
      return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
    });
  }

  // --- Link rewriting ---

  function rewriteLinks(html) {
    // Rewrite relative .md links to hash links
    return html.replace(/href="([^"]*\.md)(#[^"]*)?"/, (match, mdPath, anchor) => {
      // Skip absolute URLs
      if (mdPath.startsWith('http://') || mdPath.startsWith('https://')) return match;

      // Resolve relative path against current page's directory
      let resolved;
      if (mdPath.startsWith('/')) {
        resolved = mdPath.slice(1);
      } else if (currentPath) {
        const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        resolved = normalizePath(dir + '/' + mdPath);
      } else {
        resolved = mdPath;
      }

      return `href="#/${resolved}${anchor || ''}"`;
    });
  }

  // Replace all occurrences (the regex above only replaces one)
  function rewriteAllLinks(html) {
    return html.replace(/href="([^"]*\.md)(#[^"]*)?"?/g, (match, mdPath, anchor) => {
      if (mdPath.startsWith('http://') || mdPath.startsWith('https://')) return match;
      let resolved;
      if (mdPath.startsWith('/')) {
        resolved = mdPath.slice(1);
      } else if (currentPath) {
        const dir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        resolved = normalizePath(dir + '/' + mdPath);
      } else {
        resolved = mdPath;
      }
      return `href="#/${resolved}${anchor || ''}"`;
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

  // --- Strip frontmatter ---

  function stripFrontmatter(raw) {
    return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  }

  // --- Page rendering ---

  async function navigateTo(pagePath) {
    // Handle anchor-only navigations
    const hashIdx = pagePath.indexOf('#');
    let anchor = null;
    if (hashIdx !== -1) {
      anchor = pagePath.slice(hashIdx + 1);
      pagePath = pagePath.slice(0, hashIdx);
    }

    // If same page, just scroll to anchor
    if (pagePath === currentPath && anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Fetch page content
    try {
      const res = await fetch(`/api/page?path=${encodeURIComponent(pagePath)}`);
      if (!res.ok) {
        pageEl.innerHTML = `<h1>Page not found</h1><p>Could not load: ${pagePath}</p>`;
        pageNavEl.innerHTML = '';
        return;
      }

      const raw = await res.text();
      const stripped = stripFrontmatter(raw);

      // Render markdown
      let html = md.render(stripped);
      html = addHeadingIds(html);
      html = rewriteAllLinks(html);

      pageEl.innerHTML = html;
      currentPath = pagePath;

      // Update URL hash
      history.replaceState(null, '', '#/' + pagePath);

      // Update document title
      const pageEntry = manifest.flatOrder.find(p => p.path === pagePath);
      if (pageEntry) {
        document.title = pageEntry.title + ' - LearnML';
      }

      // Update sidebar
      updateActiveTOC(pagePath);

      // Render prev/next nav
      renderPageNav(pagePath);

      // Scroll to anchor or top
      if (anchor) {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView();
          return;
        }
      }
      document.getElementById('content').scrollTop = 0;

    } catch (err) {
      pageEl.innerHTML = `<h1>Error</h1><p>${err.message}</p>`;
      pageNavEl.innerHTML = '';
    }
  }

  // --- Prev/Next navigation ---

  function renderPageNav(pagePath) {
    const idx = manifest.flatOrder.findIndex(p => p.path === pagePath);
    if (idx === -1) { pageNavEl.innerHTML = ''; return; }

    const prev = idx > 0 ? manifest.flatOrder[idx - 1] : null;
    const next = idx < manifest.flatOrder.length - 1 ? manifest.flatOrder[idx + 1] : null;

    let html = '<div class="page-nav-inner">';
    if (prev) {
      html += `<a class="nav-prev" href="#/${prev.path}">&larr; ${prev.title}</a>`;
    } else {
      html += '<span></span>';
    }
    if (next) {
      html += `<a class="nav-next" href="#/${next.path}">${next.title} &rarr;</a>`;
    } else {
      html += '<span></span>';
    }
    html += '</div>';
    pageNavEl.innerHTML = html;

    // Add click handlers
    for (const a of pageNavEl.querySelectorAll('a')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(a.getAttribute('href').slice(2));
      });
    }
  }

  // --- Keyboard navigation ---

  document.addEventListener('keydown', (e) => {
    if (!manifest) return;

    // Alt+Left / Alt+Right for prev/next
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const idx = manifest.flatOrder.findIndex(p => p.path === currentPath);
      if (idx === -1) return;

      if (e.key === 'ArrowLeft' && idx > 0) {
        navigateTo(manifest.flatOrder[idx - 1].path);
      } else if (e.key === 'ArrowRight' && idx < manifest.flatOrder.length - 1) {
        navigateTo(manifest.flatOrder[idx + 1].path);
      }
    }
  });

  // --- Hash change handling ---

  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash.length > 2) {
      navigateTo(location.hash.slice(2));
    }
  });

  // --- Intercept anchor clicks in content ---

  pageEl.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;

    // Handle hash links
    if (href.startsWith('#/')) {
      e.preventDefault();
      navigateTo(href.slice(2));
    } else if (href.startsWith('#')) {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // --- Boot ---
  boot();
})();
