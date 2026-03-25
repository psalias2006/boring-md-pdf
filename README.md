# Yet Another Boring MD to PDF Tool

A markdown to PDF converter than works. Write Markdown, get a PDF

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

```bash
docker compose up --build -d
```

Open [http://localhost:5050](http://localhost:5050) in your browser.

To stop:

```bash
docker compose down
```

## API

### Convert Markdown to PDF

```
POST /api/convert
Content-Type: multipart/form-data
```

**Form fields:**


| Field  | Type | Required | Description                                       |
| ------ | ---- | -------- | ------------------------------------------------- |
| `file` | file | yes      | A `.md` file to convert                           |
| `css`  | text | no       | Custom CSS for the PDF (overrides default styles) |


**Response:** `application/pdf` binary on success, JSON error on failure.

**Example:**

```bash
curl -X POST http://localhost:5050/api/convert \
  -F file=@document.md \
  -o output.pdf
```

With custom CSS:

```bash
curl -X POST http://localhost:5050/api/convert \
  -F file=@document.md \
  -F 'css=body { font-family: Georgia, serif; font-size: 14px; }' \
  -o output.pdf
```

### Get Default CSS

```
GET /api/default-css
```

Returns the default PDF stylesheet as `text/css`. Useful as a starting point for customization.

```bash
curl http://localhost:5050/api/default-css
```

## Custom PDF Styles

The preview pane has three tabs: **Preview**, **Settings**, and **CSS**.

**Settings** provides visual controls for the most common properties: page size, margins, fonts, colors, heading sizes, table colors, and code block styling. Changes apply immediately.

**CSS** gives full manual control over the PDF stylesheet. Editing the raw CSS overrides the visual settings. Use the reset button to go back to the visual settings defaults.

## Page Breaks

Insert a manual page break using the toolbar button (page icon) in the editor, or by typing directly in the markdown:

```html
<div class="page-break"></div>
```

This is standard inline HTML which markdown passes through to the PDF renderer.

## Project Structure

```
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
```

## Dependencies

**Backend:** Flask, markdown2, WeasyPrint

**Frontend:** EasyMDE (markdown editor), PDF.js (PDF rendering) -- loaded via CDN