const DEBOUNCE_MS = 800;
const PDF_SCALE = 1.5;

const pdfjsLib = globalThis.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

// ---- State ----
let debounceTimer = null;
let currentPdfBytes = null;
let convertInFlight = false;
let scrollSource = null;
let cssManualOverride = false;

// ---- Settings defaults (maps to PDF_STYLES values) ----
const DEFAULTS = {
  pageSize: "A4",
  marginTop: "2cm",
  marginBottom: "2cm",
  marginLeft: "2.2cm",
  marginRight: "2.2cm",
  bodyFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  bodyFontSize: "11px",
  bodyLineHeight: "1.55",
  bodyColor: "#1a1a1a",
  h1Size: "24px",
  h2Size: "18px",
  headingColor: "#2c3e50",
  tableHeaderBg: "#2c3e50",
  tableHeaderColor: "#ffffff",
  tableBorderColor: "#cccccc",
  codeBlockBg: "#1e1e1e",
  codeBlockColor: "#d4d4d4",
  codeBlockFontSize: "10px",
};

let settings = { ...DEFAULTS };

function buildCssFromSettings() {
  const s = settings;
  return `@page {
  size: ${s.pageSize};
  margin: ${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft};
  @bottom-center {
    content: counter(page);
    font-size: 9px;
    color: #888;
  }
}
body {
  font-family: ${s.bodyFont};
  font-size: ${s.bodyFontSize};
  line-height: ${s.bodyLineHeight};
  color: ${s.bodyColor};
}
h1 {
  font-size: ${s.h1Size};
  border-bottom: 2px solid ${s.headingColor};
  padding-bottom: 8px;
  margin-top: 0;
  color: ${s.headingColor};
}
h2 {
  font-size: ${s.h2Size};
  color: ${s.headingColor};
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
  margin-top: 28px;
}
h3 {
  font-size: 14px;
  color: ${s.headingColor};
  margin-top: 20px;
}
h4 {
  font-size: 12px;
  color: ${s.headingColor};
  margin-top: 16px;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 10px;
}
th, td {
  border: 1px solid ${s.tableBorderColor};
  padding: 6px 10px;
  text-align: left;
}
th {
  background-color: ${s.tableHeaderBg};
  color: ${s.tableHeaderColor};
  font-weight: 600;
}
tr:nth-child(even) {
  background-color: #f8f9fa;
}
code {
  background-color: #f0f0f0;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: ${s.codeBlockFontSize};
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
}
pre {
  background-color: ${s.codeBlockBg};
  color: ${s.codeBlockColor};
  padding: 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: ${s.codeBlockFontSize};
  line-height: 1.45;
}
pre code {
  background-color: transparent;
  padding: 0;
  color: ${s.codeBlockColor};
}
hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 24px 0;
}
ul {
  padding-left: 22px;
}
li {
  margin-bottom: 3px;
}
a {
  color: ${s.headingColor};
  text-decoration: none;
}
blockquote {
  border-left: 4px solid ${s.headingColor};
  margin: 12px 0;
  padding: 8px 16px;
  color: #555;
  background-color: #f9f9f9;
}
h1, h2, h3, h4 {
  page-break-after: avoid;
}
pre, table, blockquote, img, figure {
  page-break-inside: avoid;
}
ul, ol {
  page-break-inside: avoid;
}
.page-break {
  page-break-before: always;
  height: 0;
  margin: 0;
  padding: 0;
}`;
}

function getCurrentCss() {
  if (cssManualOverride) return cssEditor.value;
  return buildCssFromSettings();
}

// ---- DOM refs ----
const editorWrap = document.getElementById("editor-wrap");
const cssWrap = document.getElementById("css-wrap");
const cssEditor = document.getElementById("css-editor");
const cssNotice = document.getElementById("css-notice");
const cssResetLink = document.getElementById("css-reset-link");
const pdfViewer = document.getElementById("pdf-viewer");
const placeholder = document.getElementById("placeholder");
const statusDot = document.getElementById("status");
const downloadBtn = document.getElementById("download-btn");
const pageInfo = document.getElementById("page-info");
const divider = document.getElementById("divider");
const editorPane = document.getElementById("editor-pane");
const previewPane = document.getElementById("preview-pane");
const pageBreakBtn = document.getElementById("page-break-btn");
const settingsPanel = document.getElementById("settings-panel");
const resetSettingsBtn = document.getElementById("reset-settings-btn");
const tabs = document.querySelectorAll(".tab");

// ---- Sample markdown (uses the project's own README) ----
const SAMPLE_MD = `# boring md to pdf

A self-hosted markdown to PDF converter with a live preview editor and a REST API.

## Features

- Browser-based markdown editor with formatting toolbar (bold, italic, headings, code, tables, etc.)
- Live PDF preview that updates as you type
- Bidirectional scroll sync between editor and preview
- Page break insertion via toolbar button
- Customizable PDF stylesheet (edit CSS directly in the browser)
- Download the generated PDF
- REST API for programmatic conversion
- Runs in Docker, single container

## Quick Start

\`\`\`bash
docker compose up --build -d
\`\`\`

Open [http://localhost:5050](http://localhost:5050) in your browser.

## API

### Convert Markdown to PDF

\`\`\`
POST /api/convert
Content-Type: multipart/form-data
\`\`\`

**Form fields:**

| Field  | Type | Required | Description                                       |
|--------|------|----------|---------------------------------------------------|
| \`file\` | file | yes      | A .md file to convert                             |
| \`css\`  | text | no       | Custom CSS for the PDF (overrides default styles) |

**Response:** \`application/pdf\` binary on success, JSON error on failure.

**Example:**

\`\`\`bash
curl -X POST http://localhost:5050/api/convert \\
  -F file=@document.md \\
  -o output.pdf
\`\`\`

### Get Default CSS

\`\`\`
GET /api/default-css
\`\`\`

Returns the default PDF stylesheet as \`text/css\`. Useful as a starting point for customization.

## Custom PDF Styles

Click the **Settings** tab in the preview pane to visually adjust colors, fonts, margins, and sizes. For full control, use the **CSS** tab to edit the raw stylesheet directly.

To reset to defaults, use the reset button in either panel.

## Page Breaks

Insert a manual page break using the toolbar button (page icon) in the editor, or by typing directly in the markdown:

\`\`\`html
<div class="page-break"></div>
\`\`\`

## Project Structure

\`\`\`
boring-md-to-pdf/
  backend/
    app.py             Flask application
    converter.py       Markdown to PDF conversion (markdown2 + WeasyPrint)
    requirements.txt   Python dependencies
  frontend/
    index.html         Main page
    app.js             Editor, preview, and conversion logic
    style.css          UI styles
  Dockerfile
  docker-compose.yml
\`\`\`

## Dependencies

**Backend:** Flask, markdown2, WeasyPrint

**Frontend:** EasyMDE (markdown editor), PDF.js (PDF rendering) -- loaded via CDN
`;

// ---- EasyMDE Setup ----
const easyMDE = new EasyMDE({
  element: document.getElementById("editor"),
  initialValue: SAMPLE_MD,
  spellChecker: false,
  status: false,
  renderingConfig: {
    codeSyntaxHighlighting: false,
  },
  toolbar: [
    "bold", "italic", "strikethrough", "heading", "|",
    "code", "quote", "unordered-list", "ordered-list", "|",
    "link", "image", "table", "horizontal-rule", "|",
    {
      name: "page-break",
      action: insertPageBreak,
      className: "fa fa-file-o",
      title: "Insert Page Break",
    },
  ],
});

easyMDE.codemirror.on("change", () => {
  scheduleConvert();
});

function insertPageBreak(editor) {
  const cm = editor.codemirror;
  const cursor = cm.getCursor();
  cm.replaceRange('\n<div class="page-break"></div>\n', cursor);
}

pageBreakBtn.addEventListener("click", () => {
  insertPageBreak(easyMDE);
  easyMDE.codemirror.focus();
});

// ---- Preview pane tab switching ----
const panels = previewPane.querySelectorAll("[data-panel]");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    panels.forEach((p) => {
      if (p.dataset.panel === target) {
        p.classList.remove("hidden");
      } else {
        p.classList.add("hidden");
      }
    });

    if (target === "css") {
      if (!cssManualOverride) {
        cssEditor.value = buildCssFromSettings();
      }
      cssNotice.classList.toggle("hidden", !cssManualOverride);
    }
  });
});

// ---- Settings form wiring ----
function populateSettingsForm() {
  settingsPanel.querySelectorAll("[data-key]").forEach((el) => {
    const key = el.dataset.key;
    if (key in settings) {
      el.value = settings[key];
    }
  });
}

settingsPanel.addEventListener("input", (e) => {
  const el = e.target;
  const key = el.dataset.key;
  if (!key) return;
  settings[key] = el.value;
  cssManualOverride = false;
  cssNotice.classList.add("hidden");
  scheduleConvert();
});

resetSettingsBtn.addEventListener("click", () => {
  settings = { ...DEFAULTS };
  cssManualOverride = false;
  cssNotice.classList.add("hidden");
  populateSettingsForm();
  cssEditor.value = buildCssFromSettings();
  scheduleConvert();
});

// ---- CSS editor wiring ----
cssEditor.value = buildCssFromSettings();

cssEditor.addEventListener("input", () => {
  cssManualOverride = true;
  cssNotice.classList.remove("hidden");
  scheduleConvert();
});

cssResetLink.addEventListener("click", () => {
  cssManualOverride = false;
  cssNotice.classList.add("hidden");
  settings = { ...DEFAULTS };
  populateSettingsForm();
  cssEditor.value = buildCssFromSettings();
  scheduleConvert();
});

populateSettingsForm();

// ---- Conversion ----
function setStatus(state) {
  statusDot.className = "status " + state;
}

function scheduleConvert() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doConvert, DEBOUNCE_MS);
}

async function doConvert() {
  const mdText = easyMDE.value();
  if (!mdText.trim()) {
    clearPdf();
    return;
  }
  if (convertInFlight) return;

  convertInFlight = true;
  setStatus("loading");

  const formData = new FormData();
  formData.append("file", new Blob([mdText], { type: "text/markdown" }), "input.md");
  const css = getCurrentCss();
  if (css) formData.append("css", css);

  try {
    const resp = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const blob = await resp.blob();
    currentPdfBytes = await blob.arrayBuffer();
    await renderPdf(currentPdfBytes);

    downloadBtn.disabled = false;
    setStatus("done");
  } catch (e) {
    console.error("Conversion failed:", e);
    setStatus("error");
  } finally {
    convertInFlight = false;
  }
}

function clearPdf() {
  pdfViewer.innerHTML = "";
  pdfViewer.appendChild(placeholder);
  placeholder.style.display = "flex";
  downloadBtn.disabled = true;
  currentPdfBytes = null;
  pageInfo.textContent = "";
  setStatus("idle");
}

// ---- PDF Rendering ----
async function renderPdf(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  const totalPages = pdf.numPages;

  pageInfo.textContent = `${totalPages} page${totalPages !== 1 ? "s" : ""}`;

  const scrollTop = pdfViewer.scrollTop;

  pdfViewer.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: PDF_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    pdfViewer.appendChild(canvas);
  }

  pdfViewer.scrollTop = scrollTop;
}

// ---- Download ----
downloadBtn.addEventListener("click", () => {
  if (!currentPdfBytes) return;
  const blob = new Blob([currentPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "document.pdf";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

// ---- Resizable divider ----
let isDragging = false;

divider.addEventListener("mousedown", (e) => {
  isDragging = true;
  divider.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const mainEl = document.querySelector("main");
  const rect = mainEl.getBoundingClientRect();
  const offset = e.clientX - rect.left;
  const pct = (offset / rect.width) * 100;
  const clamped = Math.min(Math.max(pct, 20), 80);
  editorPane.style.flex = `0 0 ${clamped}%`;
  previewPane.style.flex = `1`;
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  divider.classList.remove("dragging");
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

// ---- Bidirectional sync-scroll ----
const editorScroller = easyMDE.codemirror.getScrollerElement();

editorScroller.addEventListener("scroll", () => {
  if (scrollSource === "pdf") return;
  scrollSource = "editor";
  const max = editorScroller.scrollHeight - editorScroller.clientHeight;
  if (max > 0) {
    const pct = editorScroller.scrollTop / max;
    pdfViewer.scrollTop = pct * (pdfViewer.scrollHeight - pdfViewer.clientHeight);
  }
  requestAnimationFrame(() => { scrollSource = null; });
});

pdfViewer.addEventListener("scroll", () => {
  if (scrollSource === "editor") return;
  scrollSource = "pdf";
  const max = pdfViewer.scrollHeight - pdfViewer.clientHeight;
  if (max > 0) {
    const pct = pdfViewer.scrollTop / max;
    editorScroller.scrollTop = pct * (editorScroller.scrollHeight - editorScroller.clientHeight);
  }
  requestAnimationFrame(() => { scrollSource = null; });
});

// ---- Dark mode toggle ----
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const moonIcon = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
const sunIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  themeToggleBtn.innerHTML = dark ? sunIcon : moonIcon;
}

applyTheme(localStorage.getItem("theme") === "dark");

themeToggleBtn.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") !== "dark";
  localStorage.setItem("theme", isDark ? "dark" : "light");
  applyTheme(isDark);
});

// ---- Initial conversion on load ----
doConvert();
