import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import * as XLSX from "xlsx";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  DEZGO_API_KEY: process.env.DEZGO_API_KEY,
  DEZGO_API_URL: "https://api.dezgo.com/remove-background",
  REMOVE_BG_INPUT_DIR: "images/output/Manually verified/White background",
  REMOVE_BG_OUTPUT_DIR: "images/output/bg-removed images",
  PROGRESS_STATE_FILE: "images/output/bg_removal_progress.json",
  PROGRESS_EXCEL_FILE: "images/output/bg_removal_progress.xlsx",
  OTHERS_OUTPUT_DIR: "images/output/bg-removed images/Others",
};

interface ProgressState {
  completedFiles: string[];
  failedFiles: string[];
  startTime: number;
  startTimeIST?: string;
  lastRunTime: number;
  lastRunTimeIST?: string;
  totalProcessingTime: number;
  filesProcessed: number;
}

interface ProcessingStats {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  averageTimePerFile: number;
  totalTime: number;
}

// Convert timestamp to IST format
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
    completedFiles: [],
    failedFiles: [],
    startTime: now,
    startTimeIST: toIST(now),
    lastRunTime: now,
    lastRunTimeIST: toIST(now),
    totalProcessingTime: 0,
    filesProcessed: 0,
  };
}

// Save progress state to JSON file
function saveProgressState(state: ProgressState): void {
  const stateFile = path.join(process.cwd(), CONFIG.PROGRESS_STATE_FILE);
  const stateDir = path.dirname(stateFile);
  
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  
  // Update IST timestamps before saving
  state.startTimeIST = toIST(state.startTime);
  state.lastRunTimeIST = toIST(state.lastRunTime);
  
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Format time in human-readable format
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Update Excel progress report
function updateExcelReport(state: ProgressState, stats: ProcessingStats): void {
  const excelFile = path.join(process.cwd(), CONFIG.PROGRESS_EXCEL_FILE);
  const excelDir = path.dirname(excelFile);
  
  if (!fs.existsSync(excelDir)) {
    fs.mkdirSync(excelDir, { recursive: true });
  }
  
  // Create completed files sheet
  const completedData = state.completedFiles.map((file, index) => ({
    "No.": index + 1,
    "File Name": file,
    "Status": "Completed",
    "Timestamp": new Date(state.lastRunTime).toLocaleString(),
  }));
  
  // Create failed files sheet
  const failedData = state.failedFiles.map((file, index) => ({
    "No.": index + 1,
    "File Name": file,
    "Status": "Failed",
    "Timestamp": new Date(state.lastRunTime).toLocaleString(),
  }));
  
  // Create summary sheet
  const summaryData = [
    { "Metric": "Total Files", "Value": stats.totalFiles },
    { "Metric": "Completed Files", "Value": stats.completedFiles },
    { "Metric": "Failed Files", "Value": stats.failedFiles },
    { "Metric": "Skipped Files", "Value": stats.skippedFiles },
    { "Metric": "Success Rate", "Value": `${((stats.completedFiles / stats.totalFiles) * 100).toFixed(2)}%` },
    { "Metric": "Average Time Per File", "Value": formatTime(stats.averageTimePerFile) },
    { "Metric": "Total Processing Time", "Value": formatTime(stats.totalTime) },
    { "Metric": "Last Updated", "Value": new Date().toLocaleString() },
  ];
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Add sheets
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  const completedSheet = XLSX.utils.json_to_sheet(completedData.length > 0 ? completedData : [{ "No.": "", "File Name": "No files completed yet", "Status": "", "Timestamp": "" }]);
  const failedSheet = XLSX.utils.json_to_sheet(failedData.length > 0 ? failedData : [{ "No.": "", "File Name": "No files failed", "Status": "", "Timestamp": "" }]);
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, completedSheet, "Completed Files");
  XLSX.utils.book_append_sheet(workbook, failedSheet, "Failed Files");
  
  // Write to file
  XLSX.writeFile(workbook, excelFile);
}

async function removeBackground() {
  const inputDir = path.join(process.cwd(), CONFIG.REMOVE_BG_INPUT_DIR);
  const outputDir = path.join(process.cwd(), CONFIG.REMOVE_BG_OUTPUT_DIR);

  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input directory not found: ${inputDir}`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (CONFIG.DEZGO_API_KEY === "YOUR_DEZGO_API_KEY_HERE") {
    console.warn("⚠️  Please set your DEZGO_API_KEY in src/config.ts");
    return;
  }

  // Load progress state
  const progressState = loadProgressState();
  const sessionStartTime = Date.now();

  const files = fs.readdirSync(inputDir).filter(file => 
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
  );

  console.log(`🔍 Found ${files.length} images to process in: ${inputDir}`);
  console.log(`📊 Previously completed: ${progressState.completedFiles.length} files`);
  console.log(`❌ Previously failed: ${progressState.failedFiles.length} files`);
  console.log("—".repeat(50));

  let skippedCount = 0;
  let processedThisSession = 0;
  let failedThisSession = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace(/\.[^/.]+$/, "") + "_bg_removed.png");

    // Check if already processed (auto-resume logic)
    if (progressState.completedFiles.includes(file) || fs.existsSync(outputPath)) {
      console.log(`⏩ Skipping already processed: ${file}`);
      skippedCount++;
      continue;
    }

    // Calculate progress
    const totalProcessed = progressState.filesProcessed + processedThisSession;
    const progressPercent = ((i + 1) / files.length * 100).toFixed(1);
    
    // Calculate estimated time remaining
    let estimatedTimeRemaining = "Calculating...";
    if (totalProcessed > 0) {
      const avgTime = (progressState.totalProcessingTime + (Date.now() - sessionStartTime)) / totalProcessed;
      const remainingFiles = files.length - (i + 1);
      const estimatedMs = avgTime * remainingFiles;
      estimatedTimeRemaining = formatTime(estimatedMs);
    }

    try {
      console.log(`\n🧪 Processing [${i + 1}/${files.length}] (${progressPercent}%) - ${file}`);
      console.log(`⏱️  Estimated time remaining: ${estimatedTimeRemaining}`);
      
      const fileStartTime = Date.now();
      
      const imageBuffer = fs.readFileSync(inputPath);
      const form = new FormData();
      form.append("image", imageBuffer, {
        filename: file,
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
      
      const fileProcessingTime = Date.now() - fileStartTime;
      
      // Update progress state
      progressState.completedFiles.push(file);
      progressState.filesProcessed++;
      progressState.totalProcessingTime += fileProcessingTime;
      progressState.lastRunTime = Date.now();
      
      processedThisSession++;
      
      console.log(`✅ Saved: ${path.basename(outputPath)} (took ${formatTime(fileProcessingTime)})`);
      
      // Save progress after each successful file
      saveProgressState(progressState);
      
      // Update Excel report after each file (so it's available even if interrupted)
      const currentStats: ProcessingStats = {
        totalFiles: files.length,
        completedFiles: progressState.completedFiles.length,
        failedFiles: progressState.failedFiles.length,
        skippedFiles: skippedCount,
        averageTimePerFile: progressState.filesProcessed > 0 
          ? progressState.totalProcessingTime / progressState.filesProcessed 
          : 0,
        totalTime: progressState.totalProcessingTime,
      };
      updateExcelReport(progressState, currentStats);

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
      console.error(`❌ Error processing ${file}: ${errorMessage}`);
      
      // Track failed files
      if (!progressState.failedFiles.includes(file)) {
        progressState.failedFiles.push(file);
      }
      failedThisSession++;
      
      // Save progress even on failure
      saveProgressState(progressState);
      
      // Update Excel report even on failure (so it's available even if interrupted)
      const currentStats: ProcessingStats = {
        totalFiles: files.length,
        completedFiles: progressState.completedFiles.length,
        failedFiles: progressState.failedFiles.length,
        skippedFiles: skippedCount,
        averageTimePerFile: progressState.filesProcessed > 0 
          ? progressState.totalProcessingTime / progressState.filesProcessed 
          : 0,
        totalTime: progressState.totalProcessingTime,
      };
      updateExcelReport(progressState, currentStats);
    }
  }

  // Calculate final statistics
  const totalSessionTime = Date.now() - sessionStartTime;
  const stats: ProcessingStats = {
    totalFiles: files.length,
    completedFiles: progressState.completedFiles.length,
    failedFiles: progressState.failedFiles.length,
    skippedFiles: skippedCount,
    averageTimePerFile: progressState.filesProcessed > 0 
      ? progressState.totalProcessingTime / progressState.filesProcessed 
      : 0,
    totalTime: progressState.totalProcessingTime,
  };

  // Update Excel report
  updateExcelReport(progressState, stats);

  // Display final summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 PROCESSING SUMMARY");
  console.log("=".repeat(50));
  console.log(`✅ Total Completed: ${stats.completedFiles}/${stats.totalFiles} (${(stats.completedFiles / stats.totalFiles * 100).toFixed(1)}%)`);
  console.log(`⏩ Skipped (already processed): ${skippedCount}`);
  console.log(`❌ Failed: ${stats.failedFiles}`);
  console.log(`📈 This Session: ${processedThisSession} processed, ${failedThisSession} failed`);
  console.log(`⏱️  Average Time Per File: ${formatTime(stats.averageTimePerFile)}`);
  console.log(`🕐 Total Processing Time: ${formatTime(stats.totalTime)}`);
  console.log(`📄 Excel Report: ${CONFIG.PROGRESS_EXCEL_FILE}`);
  console.log(`💾 Progress State: ${CONFIG.PROGRESS_STATE_FILE}`);
  console.log("=".repeat(50));
  console.log("✅ Background removal process complete");
}

removeBackground();

