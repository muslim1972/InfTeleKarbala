import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const script = `
CREATE OR REPLACE FUNCTION get_own_profile()
RETURNS SETOF profiles AS $$
BEGIN
    RETURN QUERY SELECT * FROM profiles WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

fs.writeFileSync('update_rpc.sql', script);
