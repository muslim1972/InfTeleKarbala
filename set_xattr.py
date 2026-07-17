import csv
import os
import json

STORAGE_DIR = '/home/muslim/inftelekarbala/supabase/docker/volumes/storage/stub/stub/'

with open('objects.csv', 'r') as f:
    reader = csv.reader(f)
    for row in reader:
        if len(row) < 3:
            continue
        bucket = row[0].strip()
        name = row[1].strip()
        version = row[2].strip()
        
        local_file = os.path.join(STORAGE_DIR, bucket, name, version)
        
        if os.path.exists(local_file):
            try:
                # determine content type based on extension
                ext = name.split('.')[-1].lower() if '.' in name else ''
                content_type = 'application/octet-stream'
                if ext == 'mp3': content_type = 'audio/mpeg'
                elif ext == 'jpg' or ext == 'jpeg': content_type = 'image/jpeg'
                elif ext == 'png': content_type = 'image/png'
                elif ext == 'webp': content_type = 'image/webp'
                elif ext == 'webm': content_type = 'audio/webm'
                elif ext == 'pdf': content_type = 'application/pdf'
                elif ext == 'xlsx': content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                elif ext == 'docx': content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                
                # set xattr
                os.setxattr(local_file, 'user.supabase.content-type', content_type.encode('utf-8'))
                os.setxattr(local_file, 'user.supabase.cache-control', b'max-age=3600')
                print(f"Set xattr for {name}")
            except Exception as e:
                print(f"Failed to set xattr for {name}: {e}")
print("Done!")
