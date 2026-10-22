import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, face_descriptor')
    .eq('username', 'muslim')
    .single();

  if (error) {
    console.error('Error fetching muslim:', error);
    return;
  }

  console.log('User found:', data.id, data.username, data.full_name);
  if (!data.face_descriptor) {
    console.log('face_descriptor is NULL / falsy!');
  } else {
    console.log('Type of face_descriptor:', typeof data.face_descriptor);
    console.log('Is array?', Array.isArray(data.face_descriptor));
    if (Array.isArray(data.face_descriptor)) {
      console.log('Array length:', data.face_descriptor.length);
      console.log('Element 0 is array?', Array.isArray(data.face_descriptor[0]));
      if (Array.isArray(data.face_descriptor[0])) {
        console.log('Descriptors count:', data.face_descriptor.length, 'sub-len:', data.face_descriptor[0].length);
      }
    }
  }
}

main();
