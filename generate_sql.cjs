const ExcelJS = require('exceljs');
const fs = require('fs');
async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('D:\\\\InfTeleKarbala\\\\Summer_Training_Quiz_150.xlsx');
  
  let sql = 'CREATE TABLE IF NOT EXISTS summer_training_questions (\\n';
  sql += '  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\\n';
  sql += '  question_text TEXT NOT NULL,\\n';
  sql += '  option_1 TEXT NOT NULL, -- Correct answer\\n';
  sql += '  option_2 TEXT NOT NULL,\\n';
  sql += '  option_3 TEXT NOT NULL,\\n';
  sql += '  option_4 TEXT NOT NULL,\\n';
  sql += '  level VARCHAR(1) NOT NULL -- E, M, A\\n';
  sql += ');\\n\\n';
  
  sql += 'TRUNCATE TABLE summer_training_questions;\\n\\n';
  
  sql += 'INSERT INTO summer_training_questions (question_text, option_1, option_2, option_3, option_4, level) VALUES\\n';
  
  let values = [];
  
  const sheets = [
    { name: 'Easy_Level', level: 'E' },
    { name: 'Medium_Level', level: 'M' },
    { name: 'Advanced_Level', level: 'A' }
  ];
  
  for (const sheetInfo of sheets) {
    const worksheet = workbook.getWorksheet(sheetInfo.name);
    if (!worksheet) continue;
    
    worksheet.eachRow((row, rowNumber) => {
      let q = String(row.getCell(1).value || '').replace(/'/g, "''").trim();
      let o1 = String(row.getCell(2).value || '').replace(/'/g, "''").trim();
      let o2 = String(row.getCell(3).value || '').replace(/'/g, "''").trim();
      let o3 = String(row.getCell(4).value || '').replace(/'/g, "''").trim();
      let o4 = String(row.getCell(5).value || '').replace(/'/g, "''").trim();
      
      // Some cells might have objects { richText: [...] } if they have formatting
      if (typeof row.getCell(1).value === 'object' && row.getCell(1).value.richText) {
          q = row.getCell(1).value.richText.map(t => t.text).join('').replace(/'/g, "''").trim();
      }
      if (typeof row.getCell(2).value === 'object' && row.getCell(2).value.richText) {
          o1 = row.getCell(2).value.richText.map(t => t.text).join('').replace(/'/g, "''").trim();
      }
      if (typeof row.getCell(3).value === 'object' && row.getCell(3).value.richText) {
          o2 = row.getCell(3).value.richText.map(t => t.text).join('').replace(/'/g, "''").trim();
      }
      if (typeof row.getCell(4).value === 'object' && row.getCell(4).value.richText) {
          o3 = row.getCell(4).value.richText.map(t => t.text).join('').replace(/'/g, "''").trim();
      }
      if (typeof row.getCell(5).value === 'object' && row.getCell(5).value.richText) {
          o4 = row.getCell(5).value.richText.map(t => t.text).join('').replace(/'/g, "''").trim();
      }
      
      if (rowNumber > 1 && q && o1 && q !== 'السؤال') {
        values.push(`('${q}', '${o1}', '${o2}', '${o3}', '${o4}', '${sheetInfo.level}')`);
      }
    });
  }
  
  sql += values.join(',\\n') + ';\\n\\n';
  
  // RPC for fetching random questions securely
  sql += `CREATE OR REPLACE FUNCTION get_random_training_questions()
RETURNS TABLE (
  id UUID,
  question_text TEXT,
  option_1 TEXT,
  option_2 TEXT,
  option_3 TEXT,
  option_4 TEXT,
  level VARCHAR
) LANGUAGE sql AS $$
  (SELECT * FROM summer_training_questions WHERE level = 'E' ORDER BY random() LIMIT 15)
  UNION ALL
  (SELECT * FROM summer_training_questions WHERE level = 'M' ORDER BY random() LIMIT 15)
  UNION ALL
  (SELECT * FROM summer_training_questions WHERE level = 'A' ORDER BY random() LIMIT 20);
$$;`;

  fs.writeFileSync('D:\\\\InfTeleKarbala\\\\questions_seed.sql', sql);
  console.log('SQL generated successfully.');
}
run();
