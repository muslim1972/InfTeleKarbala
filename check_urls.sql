SELECT file_url FROM messages WHERE file_url LIKE '%http://10.56.3.3%' LIMIT 5;
SELECT * FROM messages WHERE file_url IS NOT NULL ORDER BY created_at DESC LIMIT 5;
