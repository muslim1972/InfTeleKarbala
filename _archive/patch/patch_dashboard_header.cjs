const fs = require('fs');
let content = fs.readFileSync('src/components/admin/dashboard/DashboardHeader.tsx', 'utf8');
content = content.replace('import { Search, Loader2, Trash2, X } from "lucide-react";\r\nimport { createPortal } from "react-dom";', 'import { Search, Loader2, Trash2 } from "lucide-react";');
content = content.replace('handleSearch,\r\n    suggestions,\r\n    setShowSuggestions,\r\n    showSuggestions,', 'handleSearch: _handleSearch,\r\n    suggestions: _suggestions,\r\n    setShowSuggestions,\r\n    showSuggestions: _showSuggestions,');
fs.writeFileSync('src/components/admin/dashboard/DashboardHeader.tsx', content, 'utf8');
console.log('SUCCESS');
