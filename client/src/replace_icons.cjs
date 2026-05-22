const fs = require('fs');
const path = require('path');

const dir = 'd:/cmo/CMO-Dashboard-/client/src';

const mappings = {
  // Common strings that are JSX children
  '📄 Excel Import': '<><i className="bi bi-file-earmark-spreadsheet-fill"></i> Excel Import</>',
  '🔗 API Integration': '<><i className="bi bi-link-45deg"></i> API Integration</>',
  '🧮 Custom Parameter': '<><i className="bi bi-calculator-fill"></i> Custom Parameter</>',
  '📊 Google Ads Connector': '<><i className="bi bi-bar-chart-fill"></i> Google Ads Connector</>',
  '🗺️ Column Mapper': '<><i className="bi bi-map-fill"></i> Column Mapper</>',
  '✅ Validation Passed': '<><i className="bi bi-check-circle-fill"></i> Validation Passed</>',
  '⚠️ Validation Issues': '<><i className="bi bi-exclamation-triangle-fill"></i> Validation Issues</>',
  'ℹ️ Configuration:': '<><i className="bi bi-info-circle-fill"></i> Configuration:</>',
  '⚙️ Setup Required:': '<><i className="bi bi-gear-fill"></i> Setup Required:</>',
  '📄 {typeLabel} Report Generator': '<><i className="bi bi-file-earmark-text-fill"></i> {typeLabel} Report Generator</>',
  '📊 Generate Report': '<><i className="bi bi-bar-chart-fill"></i> Generate Report</>',
  '🔍 Report Details': '<><i className="bi bi-search"></i> Report Details</>',
  '📊 Chart Data Summary': '<><i className="bi bi-bar-chart-fill"></i> Chart Data Summary</>',
  '🔍 Key Insights': '<><i className="bi bi-search"></i> Key Insights</>',
  '📊 Channel ROI': '<><i className="bi bi-bar-chart-fill"></i> Channel ROI</>',
  '📊 Metrics': '<><i className="bi bi-bar-chart-fill"></i> Metrics</>',
  'ℹ️ Info Centre': '<><i className="bi bi-info-circle-fill"></i> Info Centre</>',
  '🧮 Custom Parameter Builder': '<><i className="bi bi-calculator-fill"></i> Custom Parameter Builder</>',

  // Emojis alone in tags
  '>✕<': '><i className="bi bi-x-lg"></i><',
  '\'✕\'': '(() => <i className="bi bi-x-lg"></i>)()', // fallback if used in logic, though rare
  '>📁<': '><i className="bi bi-folder-fill"></i><',
  '>📂<': '><i className="bi bi-folder2-open"></i><',
  '>➕ Add More Files<': '><><i className="bi bi-plus-lg"></i> Add More Files</><',
  '>✓ Validate<': '><><i className="bi bi-check-lg"></i> Validate</><',
  '>⬇ Download Mapped Excel<': '><><i className="bi bi-download"></i> Download Mapped Excel</><',
  '>💾 Save & Calculate KPIs<': '><><i className="bi bi-check-lg"></i> Save & Calculate KPIs</><',
  '>💾 Save<': '><><i className="bi bi-check-lg"></i> Save</><',
  '>⏳ Saving...<': '><><i className="bi bi-hourglass-split"></i> Saving...</><',
  '>⏳ Calculating...<': '><><i className="bi bi-hourglass-split"></i> Calculating...</><',
  '>🔢 Calculate<': '><><i className="bi bi-calculator"></i> Calculate</><',
  '>＋ Add Parameter<': '><><i className="bi bi-plus-lg"></i> Add Parameter</><',
  '>🔑<': '><i className="bi bi-key-fill"></i><',
  '>⚡<': '><i className="bi bi-lightning-charge-fill"></i><',
  '>💡<': '><i className="bi bi-lightbulb-fill"></i><',
  '>🛒<': '><i className="bi bi-cart-fill"></i><',
  '>🏢<': '><i className="bi bi-building-fill"></i><',

  // Inline buttons
  '\'🙈\' : \'👁️\'': '<i className="bi bi-eye-slash-fill"></i> : <i className="bi bi-eye-fill"></i>',
  '>💾 Save Changes<': '><><i className="bi bi-check-lg"></i> Save Changes</><',
  
  // Dashboard/B2B/B2C arrays:
  '\'👥\'': '(() => <i className="bi bi-people-fill"></i>)()',
  '\'🛍️\'': '(() => <i className="bi bi-bag-fill"></i>)()',
  '\'📊\'': '(() => <i className="bi bi-bar-chart-fill"></i>)()',

  // Strings with emojis
  'placeholder="🔍 Search parameters..."': 'placeholder="Search parameters..."',
  'placeholder="e.g. Marketing ROI"': 'placeholder="e.g. Marketing ROI"',
  "'✅ ' +": "'✅ ' +", // toast messages, I'll ignore these or replace them
  "'✅ Validation Passed'": "'Validation Passed'",
  "'⚠️ Validation Issues'": "'Validation Issues'",
  "'✅ Saved'": "'Saved'"
};

function walkDir(currentPath) {
  const files = fs.readdirSync(currentPath);
  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const [key, value] of Object.entries(mappings)) {
        if (content.includes(key)) {
          content = content.split(key).join(value);
          changed = true;
        }
      }

      // Handle toast emoji removals specifically using regex
      const toastRegexes = [
        { regex: /'✅ /g, replacement: "'" },
        { regex: /`✅ /g, replacement: "`" },
        { regex: />✅ Saved/g, replacement: '><><i className="bi bi-check-circle-fill"></i> Saved</>' }
      ];

      for (const tr of toastRegexes) {
        if (tr.regex.test(content)) {
          content = content.replace(tr.regex, tr.replacement);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  }
}

walkDir(dir);
console.log('Done');
