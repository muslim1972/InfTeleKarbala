SELECT id, username, full_name, role, length(face_descriptor::text) as face_len
FROM profiles 
WHERE face_descriptor IS NOT NULL;
