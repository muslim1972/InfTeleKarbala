const fs = require('fs');
const path = 'D:\\\\InfTeleKarbala\\\\src\\\\pages\\\\AdminDashboard.tsx';
let code = fs.readFileSync(path, 'utf-8');

const lines = code.split('\n');

const startIdx = lines.findIndex(l => l.includes('const [loading, setLoading] = useState(false);'));
const endIdx = lines.findIndex(l => l.includes('// Updated Header Component'));

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find start or end index');
    process.exit(1);
}

const pre = lines.slice(0, startIdx).join('\n');
const post = lines.slice(endIdx).join('\n');

const replacement = `
    const detailsRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    const {
        loading, setLoading, formData, setFormData, searchJobNumber, setSearchJobNumber,
        suggestions, setSuggestions, showSuggestions, setShowSuggestions, searchExpanded, setSearchExpanded,
        selectedEmployee, setSelectedEmployee, financialData, setFinancialData,
        adminData, setAdminData, yearlyData, setYearlyData,
        activeFiveYearLeave, setActiveFiveYearLeave, showFiveYearLeaveModal, setShowFiveYearLeaveModal,
        showFiveYearLeaveHistoryModal, setShowFiveYearLeaveHistoryModal, newFiveYearLeave, setNewFiveYearLeave,
        selectedAdminYear, setSelectedAdminYear, adminRecords, setAdminRecords,
        fieldPermissions, fetchFieldPermissions, financialFields,
        loadEmployeeData, handleSearch, handleUpdateEmployee, handleSaveEmployee, handleDeleteEmployee,
        handleCreateFiveYearLeave, handleNewFiveYearLeaveChange, handleFiveYearLeaveChange,
        fetchAdminRecords, handleSaveRecord, handleDeleteRecord, handleFinancialChange, isFieldReadOnly
    } = useEmployeeManager(currentUser, setActiveTab, detailsRef);

    const [showDataPatcher, setShowDataPatcher] = useState(false);
    const [showSmartUpdater, setShowSmartUpdater] = useState(false);
    
    const [expandedSections, setExpandedSections] = useState({
        main_info: false, basic: false, allowances: false, deductions: false, admin_summary: false,
        yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
        sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
    });

    const [openRecordSection, setOpenRecordSection] = useState<string | null>(null);

    const [showFieldPermissionsModal, setShowFieldPermissionsModal] = useState(false);
    const [showRequestsPermissionsModal, setShowRequestsPermissionsModal] = useState(false);
    const [showFixBalanceModal, setShowFixBalanceModal] = useState(false);
    const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);

    useEffect(() => {
        const handleNotificationNavigation = (e: any) => {
            setActiveTab('admin_requests');
            if (e.detail?.requestId) setHighlightRequestId(e.detail.requestId);
            if (e.detail?.employeeId) loadEmployeeData({ id: e.detail.employeeId });
        };
        window.addEventListener('navigate_to_hr_requests', handleNotificationNavigation);
        return () => window.removeEventListener('navigate_to_hr_requests', handleNotificationNavigation);
    }, []);

    const handleToggleRecordSection = (section: string) => {
        setOpenRecordSection(prev => {
            const newState = prev === section ? null : section;
            if (newState) {
                setTimeout(() => {
                    const element = document.getElementById(\`record-section-\${section}\`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 250;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const isCurrentlyOpen = prev[sectionId as keyof typeof prev];
            const newState = {
                main_info: false, basic: false, allowances: false, deductions: false, admin_summary: false,
                yearly_records: false, news_bar: false, polls: false, directives: false, conferences: false,
                sup_permissions: false, sup_custom_audit: false, sup_full_audit: false
            };
            if (!isCurrentlyOpen) {
                newState[sectionId as keyof typeof newState] = true;
                setTimeout(() => {
                    const element = document.getElementById(\`section-\${sectionId}\`);
                    if (element) {
                        const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - 125;
                        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    const handleSelectSuggestion = async (user: any) => {
        setShowSuggestions(false);
        await loadEmployeeData(user);
    };

    useEffect(() => {
        if (activeTab === 'admin_records' && selectedEmployee) fetchAdminRecords();
    }, [activeTab, selectedEmployee, selectedAdminYear]);
`;

fs.writeFileSync(path, pre + '\n' + replacement + '\n' + post);

let code2 = fs.readFileSync(path, 'utf-8');
if (!code2.includes('useEmployeeManager')) {
    const importRegex = /(import [^;]+;\n)+/m;
    const match = code2.match(importRegex);
    if (match) {
        fs.writeFileSync(path, code2.replace(match[0], match[0] + "import { useEmployeeManager } from '../hooks/useEmployeeManager';\n"));
    }
}
console.log('AdminDashboard.tsx updated successfully');
