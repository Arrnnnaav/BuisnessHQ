import base64
import json
import sys
import zipfile
import io
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

def text(node):
    return "".join(node.itertext()) if node is not None else ""

def read_xlsx(encoded):
    raw = base64.b64decode(encoded)
    with zipfile.ZipFile(__import__("io").BytesIO(raw)) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [text(item) for item in root.findall("m:si", NS)]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            values = []
            for cell in row.findall("m:c", NS):
                kind = cell.get("t")
                value = cell.find("m:v", NS)
                inline = cell.find("m:is", NS)
                result = text(inline) if inline is not None else text(value)
                if kind == "s" and result.isdigit(): result = shared[int(result)]
                values.append(result)
            rows.append(values)
        return {"headers": rows[0] if rows else [], "rows": rows[1:] if len(rows) > 1 else []}

def write_xlsx(workbook):
    columns = workbook.get("columns", [])
    rows = [[column.get("name", "") for column in columns]]
    for row in workbook.get("rows", []): rows.append([row.get("cells", {}).get(column.get("id"), "") for column in columns])
    sheet_rows = []
    for row_number, values in enumerate(rows, 1):
        cells = []
        for column_number, value in enumerate(values, 1):
            letters = ""
            number = column_number
            while number:
                number, remainder = divmod(number - 1, 26)
                letters = chr(65 + remainder) + letters
            cells.append(f'<c r="{letters}{row_number}" t="inlineStr"><is><t>{escape(str(value if value is not None else ""))}</t></is></c>')
        sheet_rows.append(f'<row r="{row_number}">{"".join(cells)}</row>')
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catalog" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{"".join(sheet_rows)}</sheetData></worksheet>',
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items(): archive.writestr(name, content)
    return base64.b64encode(output.getvalue()).decode("ascii")

request = json.loads(sys.stdin.read())
if request.get("operation") == "read": print(json.dumps(read_xlsx(request["data"])))
elif request.get("operation") == "write": print(json.dumps({"data": write_xlsx(request["workbook"])}))
else: raise SystemExit("unsupported operation")
