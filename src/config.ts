export const CONFIG = {

  // For download-images.ts
  INPUT_EXCEL: "english_products_export.xlsx",
  OUTPUT_BASE_DIR: "images/output/All images",
  REPORT_FILE: "images/output/products_report.xlsx",


  //For All images
  ALL_IMAGES_DIR: "images/output/All images",
  ALL_REPORT_FILE: "images/output/all_images_report.xlsx",


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
