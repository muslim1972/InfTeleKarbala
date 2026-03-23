const fs = require('fs');
const path = 'src/pages/AdminDashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace standard imports
code = code.replace(/import \{ supabase \} from "\.\.\/lib\/supabase";\r?\nimport \{ toast \} from "react-hot-toast";\r?\n/g, 
    'import { useEmployeeManager } from "../hooks/useEmployeeManager";\n');

fs.writeFileSync(path, code);
console.log('Fixed imports!');
