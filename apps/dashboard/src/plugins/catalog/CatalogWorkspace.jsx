import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

function parseCsv(text, name) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const cells = (line) => line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
  return { name, headers: cells(lines[0] ?? ""), rows: lines.slice(1).map(cells) };
}

export function CatalogWorkspace() {
  const [workbook, setWorkbook] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => { try { setWorkbook(await api.catalogWorkbook()); setError(null); } catch (cause) { setError(cause); } };
  useEffect(() => { refresh(); }, []);
  const change = async (operation) => { setBusy(true); try { setWorkbook(await api.catalogWorkbookOperation(operation)); setError(null); } catch (cause) { setError(cause); } finally { setBusy(false); } };
  if (!workbook) return <p className="notice">Loading catalog…</p>;
  return <div>
    <header className="plugin-header"><div><p className="eyebrow">Business App</p><h2>Catalog</h2><p className="plugin-description">A flexible spreadsheet for products, services, pricing, and any business columns you need.</p></div></header>
    {error && <p className="auth-error" role="alert">{error.message}</p>}
    <div className="row-actions">
      <button className="btn" disabled={busy} onClick={() => { const name = prompt("New column name"); if (name) change({ type: "add-column", name }); }}>Add column</button>
      <button className="btn" disabled={busy} onClick={() => change({ type: "add-row", cells: {} })}>Add row</button>
      <button className="btn" disabled={busy} onClick={() => { const range = prompt("Merge range, e.g. r1:r1:c1:c2"); if (range) change({ type: "merge-cells", range }); }}>Merge range</button>
      <button className="btn" disabled={busy} onClick={async () => { const file = await api.catalogWorkbookExport(); const link = document.createElement("a"); link.href = `data:${file.contentType};base64,${file.data}`; link.download = file.filename; link.click(); }}>Export XLSX</button>
      <label className="btn">Import CSV/XLSX files<input hidden type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple onChange={async (event) => { const files = await Promise.all([...event.target.files].map(async (file) => file.name.toLowerCase().endsWith(".xlsx") ? ({ name: file.name, format: "xlsx", content: arrayBufferToBase64(await file.arrayBuffer()) }) : ({ name: file.name, format: "csv", content: await file.text() }))); await api.catalogWorkbookImport({ files }); await refresh(); }} /></label>
    </div>
    <div className="table-scroll"><table><thead><tr>{workbook.columns.map((column) => <th key={column.id}>{column.name}</th>)}</tr></thead><tbody>
      {workbook.rows.map((row) => <tr key={row.id}>{workbook.columns.map((column) => <td key={column.id}><input value={row.cells[column.id] ?? ""} onChange={(event) => { const value = event.target.value; setWorkbook((current) => ({ ...current, rows: current.rows.map((item) => item.id === row.id ? { ...item, cells: { ...item.cells, [column.id]: value } } : item) })); }} onBlur={(event) => change({ type: "update-cell", rowId: row.id, columnId: column.id, value: event.target.value })} /></td>)}</tr>)}
    </tbody></table></div>
    <p className="muted">{workbook.rows.length} rows · {workbook.columns.length} columns · {workbook.mergedRanges.length} merged ranges</p>
  </div>;
}

function arrayBufferToBase64(buffer) { let binary = ""; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte); return btoa(binary); }
