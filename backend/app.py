import os
from flask import Flask, request, jsonify, send_from_directory, Response
from converter import convert_md_to_pdf, PDF_STYLES

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "Missing 'file' field"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    md_text = file.read().decode("utf-8")
    if not md_text.strip():
        return jsonify({"error": "Empty markdown file"}), 400

    css = request.form.get("css") or None

    try:
        pdf_bytes = convert_md_to_pdf(md_text, css=css)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return Response(pdf_bytes, mimetype="application/pdf")


@app.route("/api/default-css")
def default_css():
    return Response(PDF_STYLES, mimetype="text/css")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
