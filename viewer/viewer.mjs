#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// --- Content directory from CLI arg ---

const contentArg = process.argv[2];
if (!contentArg) {
  console.error('Usage: node viewer.mjs <content-directory>');
  console.error('  e.g. node viewer.mjs courses/type-theory');
  process.exit(1);
}

const contentDir = path.resolve(contentArg);
if (!fs.existsSync(contentDir)) {
  console.error(`Directory not found: ${contentDir}`);
  process.exit(1);
}

// --- Frontmatter extraction ---

function extractFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*"?(.+?)"?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

function titleFromFrontmatter(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const fm = extractFrontmatter(raw);
    if (fm.title) return fm.title;
    // Fallback: first # heading
    const hm = raw.match(/^#\s+(.+)$/m);
    if (hm) return hm[1];
  } catch { /* ignore */ }
  return null;
}

function prettyName(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// --- Manifest builder ---

function buildManifest() {
  const knownFiles = new Set();
  const sections = [];
  const flatOrder = [];

  function addPage(relPath) {
    const abs = path.join(contentDir, relPath);
    if (!fs.existsSync(abs)) return;
    knownFiles.add(relPath);
    const title = titleFromFrontmatter(abs) || prettyName(path.basename(relPath));
    const entry = { path: relPath, title };
    flatOrder.push(entry);
    return entry;
  }

  // 1. Course overview
  const overviewFiles = ['README.md', 'SYLLABUS.md', 'PREREQUISITES.md', 'SETUP.md', 'NOTATION.md'];
  const overviewPages = [];
  for (const f of overviewFiles) {
    const page = addPage(f);
    if (page) overviewPages.push(page);
  }
  if (overviewPages.length) {
    sections.push({ title: 'Course Overview', pages: overviewPages });
  }

  // 2. Modules
  const modulesDir = path.join(contentDir, 'modules');
  if (fs.existsSync(modulesDir)) {
    const moduleDirs = fs.readdirSync(modulesDir)
      .filter(d => fs.statSync(path.join(modulesDir, d)).isDirectory())
      .sort();

    for (const mod of moduleDirs) {
      const modPath = path.join(modulesDir, mod);
      const files = fs.readdirSync(modPath).filter(f => f.endsWith('.md')).sort();

      // Order: index file, lectures, recitation, homework
      const index = files.filter(f => f === `${mod}.md`);
      const lectures = files.filter(f => f.startsWith('lecture_')).sort();
      const recitations = files.filter(f => f.startsWith('recitation_')).sort();
      const homeworks = files.filter(f => f.startsWith('hw')).sort();
      const rest = files.filter(f =>
        !index.includes(f) && !lectures.includes(f) &&
        !recitations.includes(f) && !homeworks.includes(f)
      ).sort();

      const ordered = [...index, ...lectures, ...recitations, ...homeworks, ...rest];
      const pages = [];
      for (const f of ordered) {
        const rel = path.join('modules', mod, f);
        const page = addPage(rel);
        if (page) pages.push(page);
      }

      // Derive section title from index file or directory name
      let sectionTitle = prettyName(mod);
      if (index.length) {
        const t = titleFromFrontmatter(path.join(modPath, index[0]));
        if (t) sectionTitle = t;
      }

      if (pages.length) sections.push({ title: sectionTitle, pages });
    }
  }

  // 3. Projects
  const projectsDir = path.join(contentDir, 'projects');
  if (fs.existsSync(projectsDir)) {
    const projDirs = fs.readdirSync(projectsDir)
      .filter(d => fs.statSync(path.join(projectsDir, d)).isDirectory())
      .sort();

    const allProjectPages = [];
    for (const proj of projDirs) {
      const projPath = path.join(projectsDir, proj);
      const files = fs.readdirSync(projPath).filter(f => f.endsWith('.md')).sort();

      // spec first, milestones, then final report
      const spec = files.filter(f => f === 'spec.md');
      const milestones = files.filter(f => f.startsWith('milestone_')).sort();
      const report = files.filter(f => f === 'final_report.md');
      const rest = files.filter(f =>
        !spec.includes(f) && !milestones.includes(f) && !report.includes(f)
      ).sort();

      const ordered = [...spec, ...milestones, ...report, ...rest];
      for (const f of ordered) {
        const rel = path.join('projects', proj, f);
        const page = addPage(rel);
        if (page) allProjectPages.push(page);
      }
    }
    if (allProjectPages.length) sections.push({ title: 'Projects', pages: allProjectPages });
  }

  // 4. Resources (alphabetical)
  const resourcesDir = path.join(contentDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    const files = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.md')).sort();
    const pages = [];
    for (const f of files) {
      const rel = path.join('resources', f);
      const page = addPage(rel);
      if (page) pages.push(page);
    }
    if (pages.length) sections.push({ title: 'Resources', pages });
  }

  return { sections, flatOrder, knownFiles: [...knownFiles] };
}

// --- Static file serving ---

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// --- HTTP server ---

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // API: manifest
  if (pathname === '/api/manifest') {
    const manifest = buildManifest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sections: manifest.sections, flatOrder: manifest.flatOrder }));
    return;
  }

  // API: page content
  if (pathname === '/api/page') {
    const pagePath = parsed.searchParams.get('path');
    if (!pagePath) {
      res.writeHead(400);
      res.end('Missing path parameter');
      return;
    }

    // Path traversal prevention: validate against known files
    const manifest = buildManifest();
    const normalized = path.normalize(pagePath);
    if (!manifest.knownFiles.includes(normalized)) {
      res.writeHead(404);
      res.end('Page not found');
      return;
    }

    try {
      const content = fs.readFileSync(path.join(contentDir, normalized), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Page not found');
    }
    return;
  }

  // Static files
  if (pathname === '/') {
    serveStatic(res, path.join(__dirname, 'public', 'index.html'));
  } else if (pathname === '/style.css') {
    serveStatic(res, path.join(__dirname, 'public', 'style.css'));
  } else if (pathname === '/app.js') {
    serveStatic(res, path.join(__dirname, 'public', 'app.js'));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const manifest = buildManifest();
  console.log(`Viewer running at http://localhost:${PORT}`);
  console.log(`Serving: ${contentDir}`);
  console.log(`${manifest.flatOrder.length} pages in ${manifest.sections.length} sections`);
});
