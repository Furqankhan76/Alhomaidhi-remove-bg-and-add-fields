import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { CONFIG } from "./config";
import { isWhiteBackground } from "./is-white-bg";

/**
 * Recursively collect all images
 */
function getAllImages(dir: string): string[] {
  let results: string[] = [];

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results = results.concat(getAllImages(fullPath));
    } else if (
      item.isFile() &&
      /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name)
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

async function generateExcelReport() {
  console.log(`🔍 Scanning images from: ${CONFIG.ALL_IMAGES_DIR}`);
  console.log("—".repeat(50));

const images = getAllImages(CONFIG.ALL_IMAGES_DIR);

  console.log(`📸 Total images found: ${images.length}`);
  console.log("—".repeat(50));

  const rows: any[] = [];

  for (const imagePath of images) {
    const fileName = path.basename(imagePath);

    const { result, ratio } = await isWhiteBackground(imagePath);

    rows.push({
      Name: fileName,
      Accuracy: `${(ratio * 100).toFixed(1)}%`,
      "Remove Background": result ? "Yes" : "No",
    });

    if (CONFIG.DEBUG) {
      console.log(
        `${result ? "✅ YES" : "❌ NO"} | ${(ratio * 100).toFixed(1)}% | ${fileName}`
      );
    }
  }

  // Create worksheet & workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Image Report");

  // Ensure output directory exists
  const reportDir = path.dirname(CONFIG.ALL_REPORT_FILE);
  fs.mkdirSync(reportDir, { recursive: true });

  // Write file
  XLSX.writeFile(workbook, CONFIG.ALL_REPORT_FILE);

  console.log("—".repeat(50));
  console.log(`📄 Excel report generated at:`);
  console.log(`📍 ${CONFIG.ALL_REPORT_FILE}`);
  console.log("—".repeat(50));
  console.log("✅ Report generation complete");
}

generateExcelReport();
