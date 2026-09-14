import assert from "node:assert/strict";
import { addColumn, addRow, createWorkbook, importTables, mergeCells, updateCell } from "../core/runtime/index.mjs";

let workbook = createWorkbook();
workbook = addColumn(workbook, { id: "sku", name: "SKU" });
workbook = addColumn(workbook, { id: "price", name: "Price", type: "number" });
workbook = addRow(workbook, { name: "Brochure", sku: "BRO-1", price: 1200 });
assert.equal(workbook.rows.length, 1);
workbook = updateCell(workbook, workbook.rows[0].id, "price", 1250);
assert.equal(workbook.rows[0].cells.price, 1250);
workbook = mergeCells(workbook, "r1:r1:c1:c2");
assert.deepEqual(workbook.mergedRanges, ["r1:r1:c1:c2"]);

const imported = importTables(workbook, [{ name: "prices.csv", headers: ["SKU", "Name", "Price", "Vendor"], rows: [["BRO-1", "Brochure", "1300", "Acme"], ["CARD-1", "Cards", "900", "Print Co"]] }]);
assert.equal(imported.workbook.rows.length, 2);
assert.equal(imported.conflicts.length, 1);
assert.equal(imported.workbook.rows.find((row) => row.cells.sku === "BRO-1").cells.vendor, "Acme");
assert.ok(imported.workbook.columns.some((column) => column.name === "Vendor"));
console.log("catalog workbook self-test passed");
