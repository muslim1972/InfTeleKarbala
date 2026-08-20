UPDATE messages SET image_url = REPLACE(image_url, 'http://10.56.3.3', 'https://khr-itpc.egov.iq') WHERE image_url LIKE '%http://10.56.3.3%';
UPDATE messages SET audio_url = REPLACE(audio_url, 'http://10.56.3.3', 'https://khr-itpc.egov.iq') WHERE audio_url LIKE '%http://10.56.3.3%';
