import fs from "fs";
import path from "path";
import axios from "axios";
import * as XLSX from "xlsx";
import { execSync } from "child_process";

// Configuration
const CONFIG = {
  INPUT_EXCEL: "english_products_export.xlsx",
  OUTPUT_BASE_DIR: "images/output/All images",
  TEST_LIMIT: 0,
  DEBUG: true
};

async function downloadImage(url: string, folderPath: string): Promise<boolean> {
  try {
    const fileName = path.basename(url.split("?")[0]);
    const filePath = path.join(folderPath, fileName);
    
    if (fs.existsSync(filePath)) return true;

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 10000,
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(true));
      writer.on("error", (err: any) => {
        console.error(`Error writing ${fileName}:`, err.message);
        resolve(false);
      });
    });
  } catch (error: any) {
    console.error(`Error downloading ${url}:`, error.message);
    return false;
  }
}

async function runDownloader() {
  const excelPath = path.join(process.cwd(), CONFIG.INPUT_EXCEL);
  if (!fs.existsSync(excelPath)) return console.error(`❌ Input file not found: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  let rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  if (CONFIG.TEST_LIMIT > 0) {
    rows = rows.slice(0, CONFIG.TEST_LIMIT);
  }

  console.log(`🚀 Starting download for ${rows.length} products...`);

  for (const row of rows) {
    const productId = row["Product ID"]?.toString().trim();
    const sku = row["SKU"]?.toString().trim();
    const featuredUrl = row["Featured Image URL"]?.toString().trim();
    const galleryUrlsStr = row["Gallery Image URLs"]?.toString().trim();

    if (!productId || !sku) continue;

    const skuFolder = path.join(CONFIG.OUTPUT_BASE_DIR, productId, sku);
    const featuredFolder = path.join(skuFolder, "Featured Image");
    const galleryFolder = path.join(skuFolder, "Gallery Images");

    if (featuredUrl && featuredUrl.startsWith("http")) {
      fs.mkdirSync(featuredFolder, { recursive: true });
      await downloadImage(featuredUrl, featuredFolder);
    }

    if (galleryUrlsStr) {
      const urls = galleryUrlsStr.split("|").map((u: string) => u.trim()).filter((u: string) => u.startsWith("http"));
      if (urls.length > 0) {
        fs.mkdirSync(galleryFolder, { recursive: true });
        for (const url of urls) {
          await downloadImage(url, galleryFolder);
        }
      }
    }

    if (CONFIG.DEBUG) console.log(`Processed ${productId} | ${sku}`);
  }

  console.log("✅ Download complete!");
  
  console.log("📊 Running report generator...");
  try {
    execSync("npx ts-node src/generate-report.ts", { stdio: "inherit" });
  } catch (error) {
    console.error("❌ Failed to run report generator");
  }
}

runDownloader();
