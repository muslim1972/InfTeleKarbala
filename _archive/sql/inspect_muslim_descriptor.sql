SELECT id, username, full_name,
       jsonb_typeof(face_descriptor::jsonb) as json_type,
       jsonb_array_length(face_descriptor::jsonb) as array_len,
       jsonb_typeof((face_descriptor::jsonb)->0) as elem0_type,
       CASE WHEN jsonb_typeof((face_descriptor::jsonb)->0) = 'array' 
            THEN jsonb_array_length((face_descriptor::jsonb)->0) 
            ELSE 0 
       END as elem0_len
FROM profiles 
WHERE id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d';
