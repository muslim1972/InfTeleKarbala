SELECT id, username, full_name, (face_descriptor IS NOT NULL) as has_face, 
       jsonb_typeof(face_descriptor::jsonb) as face_type,
       jsonb_array_length(face_descriptor::jsonb) as outer_len,
       length(face_descriptor::text) as text_len
FROM profiles 
WHERE username = 'muslim';
