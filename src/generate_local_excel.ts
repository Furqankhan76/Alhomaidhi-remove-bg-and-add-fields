import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { CONFIG } from "./config";

/**
 * Generates a new Excel file by replacing image URLs with local image filenames.
 * Checks both the main output directory and the 'Others' subdirectory.
 */
async function generateLocalExcel() {
  const inputExcelPath = path.join(process.cwd(), CONFIG.INPUT_EXCEL);
  const outputExcelPath = path.join(process.cwd(), "english_products_local_images.xlsx");
  const bgRemovedDir = path.join(process.cwd(), CONFIG.REMOVE_BG_OUTPUT_DIR);
  const othersDir = path.join(process.cwd(), CONFIG.OTHERS_OUTPUT_DIR as string || "");

  if (!fs.existsSync(inputExcelPath)) {
    console.error(`❌ Input Excel not found: ${inputExcelPath}`);
    return;
  }

  console.log("🔍 Scanning local images...");
  const localFiles = new Map<string, string>(); // Lowercase full name -> Actual name
  const localBaseNames = new Map<string, string>(); // Lowercase name without ext -> Actual name

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
        const lowerFile = file.toLowerCase();
        localFiles.set(lowerFile, file);
        
        // Also map by name without extension for flexible matching
        const ext = path.extname(lowerFile);
        const base = path.basename(lowerFile, ext);
        localBaseNames.set(base, file);
      }
    }
  }

  scanDir(bgRemovedDir);
  if (othersDir) scanDir(othersDir);

  console.log(`📊 Found ${localFiles.size} local background-removed images.`);

  console.log("📖 Reading input Excel...");
  const workbook = XLSX.readFile(inputExcelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`🧪 Processing ${data.length} products...`);

  let replacedCount = 0;
  let missingCount = 0;

  const processedData = data.map((row: any) => {
    const newRow = { ...row };

    // Function to map URL to local filename
    const getLocalFilename = (url: string | undefined): string => {
      if (!url || typeof url !== 'string') return url || "";
      
      const urlBasename = path.basename(url); // e.g., UFBWUDczcEdvb1RIOGtlWTlhVkZyQT09.png
      const ext = path.extname(urlBasename);
      const nameWithoutExt = path.basename(urlBasename, ext);
      
      // 1. Try exact match (original ext + _bg_removed)
      const expectedWithExt = `${nameWithoutExt}_bg_removed${ext}`.toLowerCase();
      if (localFiles.has(expectedWithExt)) {
        replacedCount++;
        return localFiles.get(expectedWithExt)!;
      }
      
      // 2. Try base name only match (any extension)
      const expectedBase = `${nameWithoutExt}_bg_removed`.toLowerCase();
      if (localBaseNames.has(expectedBase)) {
        replacedCount++;
        return localBaseNames.get(expectedBase)!;
      }

      missingCount++;
      return url; // Keep URL if local file not found
    };

    // Replace Featured Image URL
    if (newRow['Featured Image URL']) {
      newRow['Featured Image URL'] = getLocalFilename(newRow['Featured Image URL']);
    }

    // Replace Gallery Image URLs (joined by ' | ')
    if (newRow['Gallery Image URLs']) {
      const urls = (newRow['Gallery Image URLs'] as string).split(' | ');
      newRow['Gallery Image URLs'] = urls.map(url => getLocalFilename(url)).join(' | ');
    }

    return newRow;
  });

  console.log("💾 Writing new Excel...");
  const newWorksheet = XLSX.utils.json_to_sheet(processedData);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Products");
  XLSX.writeFile(newWorkbook, outputExcelPath);

  console.log("—".repeat(50));
  console.log(`✅ Success! New Excel created: ${outputExcelPath}`);
  console.log(`📊 Replacement Summary:`);
  console.log(`✅ URLs Replaced: ${replacedCount}`);
  console.log(`❌ Files Missing (kept as URL): ${missingCount}`);
  console.log("—".repeat(50));
}

generateLocalExcel();
