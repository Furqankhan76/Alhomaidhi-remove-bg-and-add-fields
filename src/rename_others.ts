import fs from "fs";
import path from "path";
import { CONFIG } from "./config";

/**
 * Renames images in the 'Others' manually verified folder 
 * by appending '_bg_removed' to their filenames.
 */
async function renameOthers() {
  const targetDir = path.join(process.cwd(), CONFIG.OTHERS_MANUAL_DIR as string);
  const outputDir = path.join(process.cwd(), CONFIG.OTHERS_OUTPUT_DIR as string);

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Source directory not found: ${targetDir}`);
    return;
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  const files = fs.readdirSync(targetDir).filter(file => 
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
  );

  console.log(`🔍 Found ${files.length} images to process in: ${targetDir}`);
  console.log(`📤 Destination: ${outputDir}`);
  console.log("—".repeat(50));

  let movedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const oldPath = path.join(targetDir, file);
    
    // Split filename and extension
    const ext = path.extname(file);
    const basename = path.basename(file, ext);

    const newFilename = `${basename}_bg_removed${ext}`;
    const newPath = path.join(outputDir, newFilename);

    // Skip if file already exists in destination
    if (fs.existsSync(newPath)) {
      console.log(`⏩ Skipping, already exists in destination: ${newFilename}`);
      skippedCount++;
      continue;
    }

    try {
      // Use renameSync to move the file
      fs.renameSync(oldPath, newPath);
      console.log(`✅ Moved & Renamed: ${file} -> ${newFilename}`);
      movedCount++;
    } catch (error: any) {
      console.error(`❌ Error moving ${file}: ${error.message}`);
    }
  }

  console.log("—".repeat(50));
  console.log(`📊 Summary:`);
  console.log(`✅ Total Moved: ${movedCount}`);
  console.log(`⏩ Total Skipped: ${skippedCount}`);
  console.log(`📁 Destination: ${outputDir}`);
  console.log("—".repeat(50));
  console.log("✅ Renaming and moving process complete");
}

renameOthers();
