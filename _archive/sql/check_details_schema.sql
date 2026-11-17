SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('thanks_details', 'committees_details', 'penalties_details', 'leaves_details');
SELECT schemaname, tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename IN ('thanks_details', 'committees_details', 'penalties_details', 'leaves_details');
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'thanks_details';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'committees_details';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'penalties_details';
