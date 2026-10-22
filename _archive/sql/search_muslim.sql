SELECT id, username, full_name, role, (face_descriptor IS NOT NULL) as has_face,
       CASE WHEN face_descriptor IS NOT NULL THEN length(face_descriptor::text) ELSE 0 END as face_len
FROM profiles 
WHERE username ILIKE '%muslim%' OR full_name ILIKE '%مسلم%' OR role = 'admin'
LIMIT 10;
