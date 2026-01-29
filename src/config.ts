import dotenv from "dotenv";

dotenv.config();


export const CONFIG = {

  // For download-images.ts
  INPUT_EXCEL: "english_products_export.xlsx",
  OUTPUT_BASE_DIR: "images/output/All images",
  REPORT_FILE: "images/output/products_report.xlsx",


  //For All images
  ALL_IMAGES_DIR: "images/output/All images",
  ALL_REPORT_FILE: "images/output/all_images_report.xlsx",


  // For remove_bg.ts (Dezgo API)
  DEZGO_API_KEY: process.env.DEZGO_API_KEY,
  DEZGO_API_URL: "https://api.dezgo.com/remove-background",
  REMOVE_BG_INPUT_DIR: "images/output/Manually verified/White background",
  SINGLE_IMAGE_DIR: "",
  REMOVE_BG_OUTPUT_DIR: "images/output/bg-removed images",
  PROGRESS_STATE_FILE: "images/output/bg_removal_progress.json",
  PROGRESS_EXCEL_FILE: "images/output/bg_removal_progress.xlsx",
  OTHERS_MANUAL_DIR: "images/output/Manually verified/Others",
  OTHERS_OUTPUT_DIR: "images/output/bg-removed images/Others",
    REMOVE_BG_INPUT_DIR_TEST: "images/output/test",

  // For divide-image.ts
  INPUT_DIR: "/Volumes/ssd/projects/remove-bg/images/output/All images/40046/1792219/Gallery Images",
  WHITE_BG_DIR: "images/output/Divided images/White background",
  OTHERS_DIR: "images/output/Divided images/Others",

  // Detection tuning
  REQUIRED_WHITE_PERCENTAGE: 0.3,
  TEST_LIMIT: 0, // Set to 0 to disable limit

  // Debug
  DEBUG: true
};

console.log(CONFIG.DEZGO_API_KEY);