SET ROLE authenticated;
SET request.jwt.claim.sub = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d';
SELECT current_user, auth.uid(), get_my_governorate();
SELECT id, app_name, governorate, left(content, 50) FROM admin_tips WHERE app_name = 'InfTeleKarbala' AND governorate = 'karbala';
