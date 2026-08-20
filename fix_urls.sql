UPDATE messages SET file_url = REPLACE(file_url, 'http://10.56.3.3', 'https://khr-itpc.egov.iq');
UPDATE auth.users SET raw_user_meta_data = REPLACE(raw_user_meta_data::text, 'http://10.56.3.3', 'https://khr-itpc.egov.iq')::jsonb WHERE raw_user_meta_data::text LIKE '%http://10.56.3.3%';
