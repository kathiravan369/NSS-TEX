const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Add useBusiness import
const target1 = `import DateRangePicker from '../components/common/DateRangePicker';
import { dashboardService } from '../services/dashboardService';
import { formatINR } from '../utils/formatters';`;

const replacement1 = `import DateRangePicker from '../components/common/DateRangePicker';
import { dashboardService } from '../services/dashboardService';
import { formatINR } from '../utils/formatters';
import { useBusiness } from '../context/BusinessContext';`;

if (!content.includes(target1)) {
  console.error('target1 not found in Dashboard.jsx');
  process.exit(1);
}
content = content.replace(target1, replacement1);

// 2. Add useBusiness hook and selectedBusinessId dependency
const target2 = `export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);`;

const replacement2 = `export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedBusinessId, currentBusiness } = useBusiness();
  const [data, setData] = useState(null);`;

if (!content.includes(target2)) {
  console.error('target2 not found in Dashboard.jsx');
  process.exit(1);
}
content = content.replace(target2, replacement2);

// 3. Update useEffect dependency array
const target3 = `  useEffect(() => {
    loadData(trendYear, statsPeriod);
  }, [trendYear, statsPeriod]);`;

const replacement3 = `  useEffect(() => {
    loadData(trendYear, statsPeriod);
  }, [trendYear, statsPeriod, selectedBusinessId]);`;

if (!content.includes(target3)) {
  console.error('target3 not found in Dashboard.jsx');
  process.exit(1);
}
content = content.replace(target3, replacement3);

// 4. Update Header Title to display active business badge
const target4 = `      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Overview of your manufacturing expenses, production and salary details</p>
        </div>`;

const replacement4 = `      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 className="page-title">Dashboard</h2>
            {currentBusiness && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                backgroundColor: currentBusiness.badgeBg,
                color: currentBusiness.badgeColor,
                border: \`1px solid \${currentBusiness.badgeBorder}\`,
                fontWeight: 600
              }}>
                {currentBusiness.name}
              </span>
            )}
          </div>
          <p className="page-subtitle">Overview of {currentBusiness?.name || 'NSS-TEX'} manufacturing expenses, production and salary details</p>
        </div>`;

if (!content.includes(target4)) {
  console.error('target4 not found in Dashboard.jsx');
  process.exit(1);
}
content = content.replace(target4, replacement4);

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('Dashboard.jsx patched successfully!');
