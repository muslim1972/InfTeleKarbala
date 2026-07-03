const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('D:/InfTeleKarbala/البصمة.xlsx');
  const worksheet = workbook.getWorksheet(1);

  const locationsMap = new Map(); // key: "name", value: { name, latitude, longitude }
  const employeesUpdates = [];

  // Read data
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const jobNumber = row.getCell(1).value?.toString();
    const name = row.getCell(2).value?.toString();
    const locName = row.getCell(3).value?.toString() || 'موقع غير محدد';
    let lat = parseFloat(row.getCell(4).value);
    let lng = parseFloat(row.getCell(5).value);
    
    // Time might be a Date object or string
    let checkIn = row.getCell(6).value;
    if (checkIn && typeof checkIn === 'object') checkIn = checkIn.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    else if (checkIn) checkIn = checkIn.toString();

    let checkOut = row.getCell(7).value;
    if (checkOut && typeof checkOut === 'object') checkOut = checkOut.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    else if (checkOut) checkOut = checkOut.toString();

    if (!jobNumber) return;

    // Build map of unique locations by name
    if (!locationsMap.has(locName)) {
      locationsMap.set(locName, { name: locName, latitude: isNaN(lat) ? 0 : lat, longitude: isNaN(lng) ? 0 : lng });
    } else {
      // If we found valid coordinates, update them if previously 0
      const existing = locationsMap.get(locName);
      if (existing.latitude === 0 && !isNaN(lat) && lat !== 0) {
        existing.latitude = lat;
        existing.longitude = lng;
      }
    }

    employeesUpdates.push({
      jobNumber,
      name,
      locName,
      shift_start: checkIn,
      shift_end: checkOut
    });
  });

  console.log(`Found ${locationsMap.size} unique locations and ${employeesUpdates.length} employee records.`);

  // 1. Ensure locations exist
  console.log('Ensuring locations exist...');
  for (const [key, locData] of locationsMap.entries()) {
    console.log(`Checking location: ${locData.name}...`);
    // Check if exists
    let { data: existingLocs, error: queryErr } = await supabase
      .from('work_locations')
      .select('id, latitude, longitude')
      .eq('name', locData.name)
      .limit(1);

    let existingLoc = existingLocs && existingLocs.length > 0 ? existingLocs[0] : null;

    if (queryErr) console.error('Query error for', locData.name, queryErr);

    if (!existingLoc) {
      console.log(`Creating location: ${locData.name}`);
      const { data: newLoc, error } = await supabase
        .from('work_locations')
        .insert([{ ...locData, radius_meters: 100 }])
        .select('id')
        .single();
        
      if (error) {
        console.error('Error creating location', error);
        continue;
      }
      existingLoc = newLoc;
    } else {
      // Update coordinates if they are 0 and we have new ones, or just leave it.
    }
    
    locData.id = existingLoc.id;
  }

  // 2. Fetch all profiles to get IDs by job_number
  console.log('Fetching profiles...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, job_number');
  if (pError) {
    console.error('Error fetching profiles:', pError);
    throw pError;
  }
  console.log(`Fetched ${profiles.length} profiles.`);

  const profileMap = new Map();
  for (const p of profiles) {
    if (p.job_number) profileMap.set(p.job_number.toString(), p.id);
  }

  // 3. Upsert employee locations
  let successCount = 0;
  let missingProfiles = 0;

  let processedCount = 0;
  for (const update of employeesUpdates) {
    processedCount++;
    console.log(`Processing [${processedCount}/${employeesUpdates.length}] Job#: ${update.jobNumber}...`);
    
    const profileId = profileMap.get(update.jobNumber);
    if (!profileId) {
      console.warn(`Profile not found for job_number: ${update.jobNumber} (${update.name})`);
      missingProfiles++;
      continue;
    }

    const locData = locationsMap.get(update.locName);
    if (!locData || !locData.id) continue;

    try {
      await supabase.from('work_location_employees').delete().eq('employee_id', profileId);

      const { error: insertError } = await supabase
        .from('work_location_employees')
        .insert([{
          employee_id: profileId,
          location_id: locData.id,
          shift_start: update.shift_start,
          shift_end: update.shift_end
        }]);

      if (insertError) {
        console.error(`Error mapping employee ${update.jobNumber}:`, insertError);
      } else {
        successCount++;
      }
    } catch (e) {
       console.error(`Exception processing ${update.jobNumber}:`, e.message);
    }
  }

  console.log(`Successfully updated ${successCount} employees. Missing profiles: ${missingProfiles}`);
}

run().catch(console.error);
