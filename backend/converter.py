import markdown2
from weasyprint import HTML

PDF_STYLES = """
@page {
  size: A4;
  margin: 2cm 2.2cm;
  @bottom-center {
    content: counter(page);
    font-size: 9px;
    color: #888;
  }
}
body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.55;
  color: #1a1a1a;
}
h1 {
  font-size: 24px;
  border-bottom: 2px solid #2c3e50;
  padding-bottom: 8px;
  margin-top: 0;
  color: #2c3e50;
}
h2 {
  font-size: 18px;
  color: #2c3e50;
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
  margin-top: 28px;
}
h3 {
  font-size: 14px;
  color: #34495e;
  margin-top: 20px;
}
h4 {
  font-size: 12px;
  color: #34495e;
  margin-top: 16px;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  font-size: 10px;
}
th, td {
  border: 1px solid #ccc;
  padding: 6px 10px;
  text-align: left;
}
th {
  background-color: #2c3e50;
  color: white;
  font-weight: 600;
}
tr:nth-child(even) {
  background-color: #f8f9fa;
}
code {
  background-color: #f0f0f0;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
}
pre {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 10px;
  line-height: 1.45;
}
pre code {
  background-color: transparent;
  padding: 0;
  color: #d4d4d4;
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
  color: #2c3e50;
  text-decoration: none;
}
blockquote {
  border-left: 4px solid #2c3e50;
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
}
"""

HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{styles}</style>
</head>
<body>
{body}
</body>
</html>"""


def convert_md_to_pdf(md_text: str, css: str | None = None) -> bytes:
    styles = css if css else PDF_STYLES
    html_body = markdown2.markdown(
        md_text,
        extras=["tables", "fenced-code-blocks", "code-friendly", "header-ids", "break-on-newline"],
    )
    html_doc = HTML_TEMPLATE.format(styles=styles, body=html_body)
    return HTML(string=html_doc).write_pdf()
