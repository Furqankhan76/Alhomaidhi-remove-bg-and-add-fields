import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { CONFIG } from "./config";

function countFilesInFolder(folderPath: string): number {
  if (!fs.existsSync(folderPath)) return 0;
  return fs.readdirSync(folderPath).filter(file => !file.startsWith(".")).length;
}

async function runReporter() {
  const excelPath = path.join(process.cwd(), CONFIG.INPUT_EXCEL);
  if (!fs.existsSync(excelPath)) return console.error(`❌ Input file not found: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  let rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  if (CONFIG.TEST_LIMIT > 0) {
    rows = rows.slice(0, CONFIG.TEST_LIMIT);
  }

  const productRows: any[] = [];
  let grandTotalFeatured = 0;
  let grandTotalGallery = 0;
  let grandTotalImages = 0;

  console.log(`📊 Generating report for ${rows.length} products...`);

  for (const row of rows) {
    const productId = row["Product ID"]?.toString().trim();
    const sku = row["SKU"]?.toString().trim();

    if (!productId || !sku) continue;

    const skuFolder = path.join(CONFIG.OUTPUT_BASE_DIR, productId, sku);
    const featuredCount = countFilesInFolder(path.join(skuFolder, "Featured Image"));
    const galleryCount = countFilesInFolder(path.join(skuFolder, "Gallery Images"));
    const totalCount = featuredCount + galleryCount;

    grandTotalFeatured += featuredCount;
    grandTotalGallery += galleryCount;
    grandTotalImages += totalCount;

    productRows.push({
      "Total Images": totalCount,
      "Product ID": productId,
      "SKU": sku,
      "Featured Image URL": featuredCount,
      "Gallery Image URLs": galleryCount
    });
  }

  // Create the summary row for the top
  const summaryRow = {
    "Total Images": grandTotalImages,
    "Product ID": "TOTAL (All Products)",
    "SKU": "---",
    "Featured Image URL": grandTotalFeatured,
    "Gallery Image URLs": grandTotalGallery
  };

  // Combine rows: Summary first, then individual products
  const finalData = [summaryRow, ...productRows];

  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(finalData);
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Products Summary");
  
  const reportPath = path.join(process.cwd(), CONFIG.REPORT_FILE);
  XLSX.writeFile(newWorkbook, reportPath);

  console.log("—".repeat(50));
  console.log(`✅ Report generated with ${rows.length} products.`);
  console.log(`📈 Grand Totals: Featured=${grandTotalFeatured}, Gallery=${grandTotalGallery}, All=${grandTotalImages}`);
  console.log(`📝 Location: ${CONFIG.REPORT_FILE}`);
  console.log("—".repeat(50));
}

runReporter();
