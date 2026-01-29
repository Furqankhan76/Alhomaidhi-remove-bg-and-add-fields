import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { CONFIG } from "./config";

/**
 * Remove background from a single image
 * Usage: ts-node src/remove_bg_single.ts <image_path>
 * Example: ts-node src/remove_bg_single.ts images/input/photo.jpg
 */

async function removeSingleBackground() {
  // Get image path from command line argument
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error("❌ Please provide an image path as argument");
    console.log("Usage: ts-node src/remove_bg_single.ts <image_path>");
    console.log("Example: ts-node src/remove_bg_single.ts images/input/photo.jpg");
    return;
  }

  const inputPath = path.resolve(process.cwd(), imagePath);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Image not found: ${inputPath}`);
    return;
  }

  // Check if it's a valid image file
  if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(inputPath)) {
    console.error("❌ Invalid file type. Supported: jpg, jpeg, png, webp, gif");
    return;
  }

  if (!CONFIG.DEZGO_API_KEY || CONFIG.DEZGO_API_KEY === "YOUR_DEZGO_API_KEY_HERE") {
    console.error("⚠️  Please set your DEZGO_API_KEY in .env file");
    return;
  }

  // Determine output path
  const inputDir = path.dirname(inputPath);
  const inputFileName = path.basename(inputPath);
  const outputFileName = inputFileName.replace(/\.[^/.]+$/, "") + "_bg_removed.png";
  const outputPath = path.join(inputDir, outputFileName);

  try {
    console.log(`🧪 Processing: ${inputFileName}...`);
    console.log(`📂 Input: ${inputPath}`);
    
    const startTime = Date.now();
    
    const imageBuffer = fs.readFileSync(inputPath);
    const form = new FormData();
    form.append("image", imageBuffer, {
      filename: inputFileName,
      contentType: "image/png",
    });
    form.append("mode", "transparent");

    const response = await axios.post(CONFIG.DEZGO_API_URL, form, {
      headers: {
        "X-Dezgo-Key": CONFIG.DEZGO_API_KEY,
        ...form.getHeaders(),
      },
      responseType: "arraybuffer",
    });

    fs.writeFileSync(outputPath, response.data);
    
    const processingTime = Date.now() - startTime;
    const processingSeconds = (processingTime / 1000).toFixed(2);
    
    console.log(`✅ Success! Background removed in ${processingSeconds}s`);
    console.log(`📂 Output: ${outputPath}`);

  } catch (error: any) {
    let errorMessage = error.message;
    if (error.response?.data && error.response.data instanceof Buffer) {
      try {
        const errorData = JSON.parse(error.response.data.toString());
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = error.response.data.toString() || errorMessage;
      }
    }
    console.error(`❌ Error: ${errorMessage}`);
    process.exit(1);
  }
}

removeSingleBackground();
