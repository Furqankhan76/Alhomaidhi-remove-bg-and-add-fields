import * as XLSX from "xlsx";
import path from "path";

async function peekExcel() {
  const filePath = path.join(process.cwd(), "english_products_export.xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log("Headers:", data[0]);
  console.log("Row 1:", data[1]);
  console.log("Total rows:", data.length);
}

peekExcel();
