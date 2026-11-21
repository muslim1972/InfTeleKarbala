SELECT res->>'message' FROM kiosk_get_employees('KSK-0889B0C3B3') AS res;
SELECT id, name, activation_code, is_active FROM kiosk_devices LIMIT 3;
