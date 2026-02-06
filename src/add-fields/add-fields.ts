import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();



// Configuration
const CONFIG = {
  EXCEL_FILE: 'english_products_with_brands.xlsx',
  OUTPUT_FILE: 'english_products_updated.xlsx',
  FIELDS_JSON: 'fields.json',
  PROGRESS_STATE_FILE: 'add_fields_state.json',
  TEST_LIMIT: 99999, // Highly enough to process all items
  GEMINI_MODEL: 'gemini-2.0-flash',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

if (!CONFIG.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);

interface ProgressState {
  completedIds: number[];
  failedIds: number[];
  processedData: any[]; // Store the results as we go
  startTime: number;
  startTimeIST?: string;
  lastRunTime: number;
  lastRunTimeIST?: string;
  totalProcessingTime: number;
}

interface AllowedFields {
  [key: string]: string[];
}

// Helper: Convert timestamp to IST format
function toIST(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Helper: Format time
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Load progress state from JSON file
function loadProgressState(): ProgressState {
  const stateFile = path.join(process.cwd(), CONFIG.PROGRESS_STATE_FILE);
  if (fs.existsSync(stateFile)) {
    try {
      const data = fs.readFileSync(stateFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.warn("⚠️  Could not load progress state, starting fresh");
    }
  }
  const now = Date.now();
  return {
    completedIds: [],
    failedIds: [],
    processedData: [],
    startTime: now,
    startTimeIST: toIST(now),
    lastRunTime: now,
    lastRunTimeIST: toIST(now),
    totalProcessingTime: 0,
  };
}

// Save progress state to JSON file
function saveProgressState(state: ProgressState): void {
  const stateFile = path.join(process.cwd(), CONFIG.PROGRESS_STATE_FILE);
  state.lastRunTime = Date.now();
  state.lastRunTimeIST = toIST(state.lastRunTime);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

async function run() {
  try {
    // 1. Load fields.json
    const fieldsData: AllowedFields = JSON.parse(fs.readFileSync(CONFIG.FIELDS_JSON, 'utf8'));
    const fieldNames = Object.keys(fieldsData);

    // 2. Load Excel file
    const workbook = XLSX.readFile(CONFIG.EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const allData: any[] = XLSX.utils.sheet_to_json(worksheet);

    // 3. Load progress
    const state = loadProgressState();
    const sessionStartTime = Date.now();

    console.log(`🔍 Found ${allData.length} items in Excel.`);
    console.log(`📊 Previously completed: ${state.completedIds.length}`);
    console.log(`❌ Previously failed: ${state.failedIds.length}`);
    console.log(`🧪 Test limit: ${CONFIG.TEST_LIMIT}`);
    console.log("—".repeat(50));

    // 4. Fields Configuration
    const dropdownFields = fieldNames; // From fields.json (includes 'display_type' or similar)
    const directFields = [
      'model_number', 
      'product_name', 
      'case_diameter', 
      'case_thickness', 
      'description', 
      'band_material'
    ];
    const allRequestFields = [...dropdownFields, ...directFields];

    // 5. Initialize Gemini model
    const model = genAI.getGenerativeModel({ 
      model: CONFIG.GEMINI_MODEL,
      tools: [
        {
          //@ts-ignore
          googleSearch: {},
        },
      ],
    });

    const itemsToProcess = allData.slice(0, CONFIG.TEST_LIMIT);
    
    for (let i = 0; i < itemsToProcess.length; i++) {
      const row = itemsToProcess[i];
      const productId = row.product_id;
      const sku = row.sku || 'N/A';
      const brand = row.brand_name || 'N/A';
      const imageUrl = row.featured_image;

      // Auto-resume logic: Skip if already completed
      if (state.completedIds.includes(productId)) {
        console.log(`⏩ Skipping already processed: SKU ${sku} (ID ${productId})`);
        continue;
      }

      const progressPercent = ((i + 1) / itemsToProcess.length * 100).toFixed(1);
      console.log(`\n🧪 [${i + 1}/${itemsToProcess.length}] (${progressPercent}%) - SKU: ${sku}, Brand: ${brand}`);

      const fileStartTime = Date.now();

      let imagePart: any = null;
      if (imageUrl && imageUrl.startsWith('http')) {
        try {
          const response = await fetch(imageUrl);
          const buffer = await response.arrayBuffer();
          imagePart = {
            inlineData: {
              data: Buffer.from(buffer).toString('base64'),
              mimeType: 'image/png' 
            }
          };
        } catch (err) {
          console.warn(`⚠️  Failed to download image for SKU ${sku}`);
        }
      }

      const prompt = `
        You are a luxury watch expert. I am providing you with a watch's SKU, Brand Name, and an image of the watch.
        Your task is to identify the watch's detailed specifications as accurately as possible. 
        USE THE GOOGLE SEARCH TOOL to find the exact official specifications for this SKU and Brand.
        Compare the search results with the visual details from the image.

        SKU: ${sku}
        Brand: ${brand}

        Available categories and their allowed values (DROPDOWN FIELDS):
        ${JSON.stringify(fieldsData, null, 2)}

        Other fields to identify (DIRECT FIELDS):
        ${directFields.join(', ')}

        Return a JSON object containing ALL requested fields: ${allRequestFields.join(', ')}, reasoning.

        CRITICAL RULES:
        1. For DROPDOWN FIELDS: If the identified value matches one of the "allowed values" EXACTLY, use that string.
        2. For DIRECT FIELDS: Provide the most accurate professional value found.
        3. Include a "reasoning" key briefly explaining the data source.
        4. Return ONLY valid JSON.
      `;

      try {
        const parts: any[] = [prompt];
        if (imagePart) parts.push(imagePart);

        const result = await model.generateContent(parts);
        const response = await result.response;
        let text = response.text();
        
        // Robust JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`AI response did not contain valid JSON: ${text.slice(0, 100)}...`);
        }
        const cleanJson = jsonMatch[0];
        const aiResponse = JSON.parse(cleanJson);
        const updatedRow = { ...row };

        // console.log(`💡 Reasoning: ${aiResponse.reasoning || 'N/A'}`);
        // updatedRow['ai_reasoning'] = aiResponse.reasoning || '';

        // Initialize ALL fields to empty string first to ensure they exist in JSON/Excel
        for (const field of dropdownFields) {
          updatedRow[field] = updatedRow[field] || "";
          updatedRow[`${field}_diff`] = updatedRow[`${field}_diff`] || "";
        }
        for (const field of directFields) {
          updatedRow[field] = updatedRow[field] || "";
        }

        // Handle Dropdown Fields (with _diff logic)
        for (const field of dropdownFields) {
          const aiValue = aiResponse[field];
          const allowedValues = fieldsData[field];
          
          if (aiValue) {
            if (allowedValues.includes(aiValue)) {
              updatedRow[field] = aiValue;
              updatedRow[`${field}_diff`] = '';
            } else {
              updatedRow[field] = '';
              updatedRow[`${field}_diff`] = aiValue;
            }
          }
        }

        // Handle Direct Fields (simple fill)
        for (const field of directFields) {
          if (aiResponse[field]) {
            updatedRow[field] = aiResponse[field];
          }
        }

        // Update State
        state.completedIds.push(productId);
        state.processedData.push(updatedRow);
        
        // Remove from failed if it was there before
        state.failedIds = state.failedIds.filter(id => id !== productId);
        
        const timeTaken = Date.now() - fileStartTime;
        state.totalProcessingTime += timeTaken;
        
        console.log(`✅ Completed (took ${formatTime(timeTaken)})`);
        saveProgressState(state);

      } catch (error: any) {
        console.error(`❌ Error processing SKU ${sku}: ${error.message}`);
        if (!state.failedIds.includes(productId)) {
          state.failedIds.push(productId);
        }
        saveProgressState(state);
      }
    }

    // 5. Final Save to Excel
    // Merge existing processed data with any remaining unprocessed data from the EXCEL file to build a full sheet if needed,
    // but here we just follow the pattern and save whatever we have processed.
    const finalData = state.processedData;
    if (finalData.length > 0) {
      const newWorksheet = XLSX.utils.json_to_sheet(finalData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Updated Products");
      XLSX.writeFile(newWorkbook, CONFIG.OUTPUT_FILE);
      console.log(`\n🎉 Done! Updated Excel saved to ${CONFIG.OUTPUT_FILE}`);
    }

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  }
}

run();
