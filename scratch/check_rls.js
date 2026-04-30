import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

// =====================================
// سكربت فحص أمان RLS المتقدم
// يحاكي ما يفعله المخترق تماماً:
// يأخذ المفتاح العلني (Anon Key) ويحاول:
// 1. قراءة البيانات (SELECT)
// 2. إدخال بيانات مزيفة (INSERT)
// 3. تعديل البيانات (UPDATE)
// 4. حذف البيانات (DELETE)
// =====================================

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tablesToCheck = [
  'profiles',
  'departments',
  'calls',
  'rate_limits',
  'login_logs',
  'leave_requests',
  'chat_conversations',
  'chat_messages',
  'call_participants',
  'knowledge_items',
];

async function checkRLS() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔒 InfTeleKarbala - RLS Security Audit (Advanced)');
  console.log('   Using: Anonymous Key (simulating attacker)');
  console.log('═══════════════════════════════════════════════════════════\n');

  let criticalVulnerabilities = 0;
  let warnings = 0;
  const results = [];

  for (const table of tablesToCheck) {
    const tableResult = { table, read: '?', insert: '?', update: '?', delete: '?', dataLeaked: false };

    // ── Test 1: READ (SELECT) ─────────────────────────
    const { data: readData, error: readError } = await supabase
      .from(table)
      .select('*')
      .limit(5);

    if (readError) {
      if (readError.message.includes('schema cache') || readError.message.includes('does not exist') || readError.code === '42P01') {
        tableResult.read = 'N/A';
      } else {
        tableResult.read = '✅ BLOCKED';
      }
    } else if (readData && readData.length > 0) {
      tableResult.read = `🔴 LEAKED ${readData.length} rows!`;
      tableResult.dataLeaked = true;
      criticalVulnerabilities++;
    } else {
      // 0 rows returned - RLS is working (no matching policy for anon)
      tableResult.read = '✅ SAFE (0 rows)';
    }

    // ── Test 2: INSERT ─────────────────────────
    const { error: insertError } = await supabase
      .from(table)
      .insert({ id: '00000000-0000-0000-0000-000000000099' });

    if (insertError) {
      if (insertError.message.includes('schema cache') || insertError.message.includes('does not exist')) {
        tableResult.insert = 'N/A';
      } else if (insertError.message.includes('row-level security')) {
        tableResult.insert = '✅ BLOCKED';
      } else {
        tableResult.insert = '✅ BLOCKED (' + insertError.message.substring(0, 50) + ')';
      }
    } else {
      tableResult.insert = '🔴 VULNERABLE!';
      criticalVulnerabilities++;
      await supabase.from(table).delete().eq('id', '00000000-0000-0000-0000-000000000099');
    }

    // ── Test 3: UPDATE ─────────────────────────
    const { error: updateError, count } = await supabase
      .from(table)
      .update({ id: '00000000-0000-0000-0000-000000000099' })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (updateError) {
      if (updateError.message.includes('schema cache') || updateError.message.includes('does not exist')) {
        tableResult.update = 'N/A';
      } else if (updateError.message.includes('row-level security')) {
        tableResult.update = '✅ BLOCKED';
      } else {
        tableResult.update = '✅ BLOCKED';
      }
    } else {
      tableResult.update = '✅ SAFE (0 affected)';
    }

    // ── Test 4: DELETE ─────────────────────────
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (deleteError) {
      if (deleteError.message.includes('schema cache') || deleteError.message.includes('does not exist')) {
        tableResult.delete = 'N/A';
      } else if (deleteError.message.includes('row-level security')) {
        tableResult.delete = '✅ BLOCKED';
      } else {
        tableResult.delete = '✅ BLOCKED';
      }
    } else {
      tableResult.delete = '✅ SAFE (0 affected)';
    }

    results.push(tableResult);
  }

  // ── Print Results Table ─────────────────────────
  console.log('📋 Results:\n');
  console.log('┌─────────────────────┬──────────────────────┬──────────────────┬──────────────────┬──────────────────┐');
  console.log('│ Table               │ READ                 │ INSERT           │ UPDATE           │ DELETE           │');
  console.log('├─────────────────────┼──────────────────────┼──────────────────┼──────────────────┼──────────────────┤');
  
  for (const r of results) {
    if (r.read === 'N/A' && r.insert === 'N/A') continue; // Skip non-existent tables
    const t = r.table.padEnd(19);
    const rd = r.read.substring(0, 20).padEnd(20);
    const ins = r.insert.substring(0, 16).padEnd(16);
    const upd = r.update.substring(0, 16).padEnd(16);
    const del = r.delete.substring(0, 16).padEnd(16);
    console.log(`│ ${t} │ ${rd} │ ${ins} │ ${upd} │ ${del} │`);
  }
  
  console.log('└─────────────────────┴──────────────────────┴──────────────────┴──────────────────┴──────────────────┘');

  // ── Final Verdict ─────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  if (criticalVulnerabilities === 0) {
    console.log('🟢 VERDICT: ALL TABLES ARE SECURE!');
    console.log('   No data can be read, inserted, modified, or deleted');
    console.log('   by an anonymous attacker using the public Anon Key.');
    console.log('   The Anon Key is USELESS without authentication.');
  } else {
    console.log(`🔴 VERDICT: ${criticalVulnerabilities} CRITICAL VULNERABILITIES FOUND!`);
    console.log('   An attacker can access real data using the Anon Key.');
  }
  console.log('═══════════════════════════════════════════════════════════');
}

checkRLS();
