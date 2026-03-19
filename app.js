// --- 1. GLOBAL STATE & CONSTANTS ---
let ingresosDataGlobal = [];
let egresosDataGlobal = [];

let filteredIngresosData = [];
let filteredEgresosData = [];

let projects = [];

// Track if data is loaded to enable UI
let ingresosLoaded = false;
let egresosLoaded = false;

// Format Function
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(amount);
};

// --- 2. DOM ELEMENTS ---
// Navigation
const navLinks = document.querySelectorAll('.nav-menu a');
const views = document.querySelectorAll('.view-section');
const pageTitle = document.getElementById('pageTitle');
const dataStatus = document.getElementById('dataStatus');

const uploadIngresos = document.getElementById('uploadIngresos');
const uploadEgresos = document.getElementById('uploadEgresos');

// KPI Generales (Caja)
const kpiCajaActual = document.getElementById('kpiCajaActual'); // Now an input
const kpiTotalIngresosGeneral = document.getElementById('kpiTotalIngresosGeneral');
const kpiTotalEgresosGeneral = document.getElementById('kpiTotalEgresosGeneral');
const kpiBalanceNeto = document.getElementById('kpiBalanceNeto');

// Filters
const filterFondoIngresos = document.getElementById('filterFondoIngresos');
const filterLoteIngresos = document.getElementById('filterLoteIngresos');
const filterSubFondoEgresos = document.getElementById('filterSubFondoEgresos');

// KPI Ingresos
const kpiTotalIngresos = document.getElementById('kpiTotalIngresos');
const kpiAvgMonthlyIngresos = document.getElementById('kpiAvgMonthlyIngresos');
const kpiAvgYearlyIngresos = document.getElementById('kpiAvgYearlyIngresos');
const kpiAvgPerLotIngresos = document.getElementById('kpiAvgPerLotIngresos');
const kpiLotsPerMonth = document.getElementById('kpiLotsPerMonth');

// KPI Egresos
const kpiTotalEgresos = document.getElementById('kpiTotalEgresos');
const kpiAvgMonthlyEgresos = document.getElementById('kpiAvgMonthlyEgresos');
const kpiTotalCurrentYearEgresos = document.getElementById('kpiTotalCurrentYearEgresos');
const kpiTotalTransactions = document.getElementById('kpiTotalTransactions');

// Presupuesto Elements
const projAnnualIncome = document.getElementById('projAnnualIncome');
const annualBudgetEgresos = document.getElementById('annualBudgetEgresos');
const projDeuda = document.getElementById('projDeuda');
const lblAnnualProjIncome = document.getElementById('lblAnnualProjIncome');
const lblAnnualBudget = document.getElementById('lblAnnualBudget');
const lblDeuda = document.getElementById('lblDeuda');
const lblCajaPresupuesto = document.getElementById('lblCajaPresupuesto');
const lblAvailablePre = document.getElementById('lblAvailablePre');

const projectForm = document.getElementById('projectForm');
const projName = document.getElementById('projName');
const projCost = document.getElementById('projCost');
const projPriority = document.getElementById('projPriority');
const projectsList = document.getElementById('projectsList');
const totalProjectsCostEl = document.getElementById('totalProjectsCost');
const finalBalance = document.getElementById('finalBalance');

// Chart Instances
let chartInstances = {};
// Store pre-calculated averages for auto-filling
let historicalAvgYearlyIndex = 0;
let historicalAvgYearlyEgress = 0;

// --- PERSISTENCE ---
function loadPersistentData() {
    const savedCaja = localStorage.getItem('kpiCajaActual');
    if (savedCaja) kpiCajaActual.value = savedCaja;

    const savedIn = localStorage.getItem('projAnnualIncome');
    if (savedIn) projAnnualIncome.value = savedIn;

    const savedOut = localStorage.getItem('annualBudgetEgresos');
    if (savedOut) annualBudgetEgresos.value = savedOut;

    const savedDeuda = localStorage.getItem('projDeuda');
    if (savedDeuda) projDeuda.value = savedDeuda;

    const savedProj = localStorage.getItem('projects');
    if (savedProj) {
        try { projects = JSON.parse(savedProj); } catch(e) {}
    }
}

function savePersistentData() {
    localStorage.setItem('kpiCajaActual', kpiCajaActual.value);
    localStorage.setItem('projAnnualIncome', projAnnualIncome.value);
    localStorage.setItem('annualBudgetEgresos', annualBudgetEgresos.value);
    localStorage.setItem('projDeuda', projDeuda.value);
    localStorage.setItem('projects', JSON.stringify(projects));
}

// --- 3. INIT & NAVIGATION LÓGICA ---
document.addEventListener('DOMContentLoaded', () => {
    loadPersistentData();
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Setup Navigation
    setupNavigation();

    // Event Listeners Caja
    kpiCajaActual.addEventListener('input', () => {
        calculateBudget();
    });

    // Zoom Charts Listeners
    document.querySelectorAll('.chart-container').forEach(c => {
        c.addEventListener('dblclick', function() {
            this.classList.toggle('chart-zoomed');
            window.dispatchEvent(new Event('resize'));
        });
    });

    // Filters Listeners
    filterFondoIngresos.addEventListener('change', applyFiltersIngresos);
    filterLoteIngresos.addEventListener('change', applyFiltersIngresos);
    filterSubFondoEgresos.addEventListener('change', applyFiltersEgresos);

    // Budget Listeners
    projAnnualIncome.addEventListener('input', calculateBudget);
    annualBudgetEgresos.addEventListener('input', calculateBudget);
    projDeuda.addEventListener('input', calculateBudget);
    projectForm.addEventListener('submit', addProject);
    
    // Upload Listeners
    uploadIngresos.addEventListener('change', handleUploadIngresos);
    uploadEgresos.addEventListener('change', handleUploadEgresos);

    // Load Data
    loadRealData();
});

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active classes
            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            views.forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden');
            });

            // Set current active
            link.parentElement.classList.add('active');
            const targetId = link.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.classList.add('active');
                pageTitle.innerText = link.innerText;

                // Re-render comparative chart if caja tab
                if (targetId === 'view-caja') {
                    renderComparativeChart();
                }
            }
        });
    });
}

// --- 4. DATA FETCHING ---
function loadRealData() {
    // 0. Fetch Configs & Projects first
    Promise.all([
        fetch('data/config.csv').then(r => r.ok ? r.text() : ""),
        fetch('data/proyectos.csv').then(r => r.ok ? r.text() : "")
    ]).then(([configCsv, proyectosCsv]) => {
        // Parse config
        if (configCsv) {
            let configData = Papa.parse(configCsv, {header: true, skipEmptyLines: true}).data;
            let conf = {};
            configData.forEach(row => {
                if (row.Parametro) conf[row.Parametro] = parseInt(row.Valor) || 0;
            });
            if (conf.caja_inicial && !localStorage.getItem('kpiCajaActual')) kpiCajaActual.value = conf.caja_inicial;
            if (conf.deuda_gastos_comunes && !localStorage.getItem('projDeuda')) projDeuda.value = conf.deuda_gastos_comunes;
            // Also override the input value displays immediately if available
            if (conf.ingreso_anual_proyectado && !localStorage.getItem('projAnnualIncome')) projAnnualIncome.value = conf.ingreso_anual_proyectado;
            if (conf.egreso_anual_presupuestado && !localStorage.getItem('annualBudgetEgresos')) annualBudgetEgresos.value = conf.egreso_anual_presupuestado;
        }

        // Parse proyectos
        if (proyectosCsv && !localStorage.getItem('projects')) {
            let pData = Papa.parse(proyectosCsv, {header: true, skipEmptyLines: true}).data;
            let loadedProjects = pData.filter(p => p.name).map(p => ({
                id: parseInt(p.id) || Date.now() + Math.random(),
                name: p.name,
                cost: parseInt(p.cost) || 0,
                priority: parseInt(p.priority) || 1
            }));
            if (loadedProjects.length > 0) {
                projects = loadedProjects;
                renderProjects();
            }
        }

        // Trigger the main CSVs
        fetchIngresosYegresos();
    }).catch(err => {
        console.warn("Error fetching config, proceeding with defaults", err);
        fetchIngresosYegresos();
    });
}

function fetchIngresosYegresos() {
    // 1. Fetch Ingresos
    fetch('data/ingresos.csv')
        .then(response => {
            if (!response.ok) throw new Error("No ingresos.csv");
            return response.text();
        })
        .then(csvString => {
            Papa.parse(csvString, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processIngresos(results.data);
                    populateIngresosFilters();
                    ingresosLoaded = true;
                    checkAllDataLoaded();
                }
            });
        })
        .catch(err => console.warn("Usando carga manual para Ingresos"));

    // 2. Fetch Egresos
    fetch('data/egresos.csv')
        .then(response => {
            if (!response.ok) throw new Error("No egresos.csv");
            return response.text();
        })
        .then(csvString => {
            const lines = csvString.split('\n');
            const cleanedCsv = lines.length > 4 ? lines.slice(4).join('\n') : csvString;
            Papa.parse(cleanedCsv, {
                header: true,
                skipEmptyLines: true,
                delimiter: ";",
                complete: function(results) {
                    processEgresos(results.data);
                    populateEgresosFilters();
                    egresosLoaded = true;
                    checkAllDataLoaded();
                }
            });
        })
        .catch(err => console.warn("Usando carga manual para Egresos"));
}

function handleUploadIngresos(event) {
    const file = event.target.files[0];
    if (!file) return;
    dataStatus.innerText = "Procesando Ingresos locales...";
    dataStatus.style.color = "var(--warning)";
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            processIngresos(results.data);
            populateIngresosFilters();
            ingresosLoaded = true;
            checkAllDataLoaded(true);
        }
    });
}

function handleUploadEgresos(event) {
    const file = event.target.files[0];
    if (!file) return;
    dataStatus.innerText = "Procesando Egresos locales...";
    dataStatus.style.color = "var(--warning)";

    // Read file via FileReader to strip metadatas
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        const cleanedCsv = lines.length > 4 ? lines.slice(4).join('\n') : text;
        
        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            delimiter: ";",
            complete: function(results) {
                processEgresos(results.data);
                populateEgresosFilters();
                egresosLoaded = true;
                checkAllDataLoaded(true);
            }
        });
    };
    reader.readAsText(file, 'ISO-8859-1'); // Egresos often ISO-8859-1 exported from Windows
}


function checkAllDataLoaded(loadedManually = false) {
    if (ingresosLoaded || egresosLoaded) {
        dataStatus.innerText = loadedManually ? "CSVs Locales Cargados" : "Conectado a Datos Reales";
        dataStatus.style.color = "var(--success)";
        
        applyFiltersIngresos(false);
        applyFiltersEgresos(false);
    }
}

// --- 5. DATA PROCESSING ---
function processIngresos(data) {
    ingresosDataGlobal = data.filter(row => {
        return row['Nulo'] !== 'Si' && row['Monto'] && row['Fecha Ingreso'];
    }).map(row => {
        const amountStr = row['Monto'].replace(/\./g, '');
        const amount = parseInt(amountStr, 10);
        
        const dateParts = row['Fecha Ingreso'].split('/');
        let dateObj = null;
        let monthKey = '';
        let yearKey = '';
        
        if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
            monthKey = `${year}-${month}`;
            yearKey = year;
        }

        // Identify the exact header containing "Fondo" string for Ingresos (usually "Fondos")
        const fondoHeader = Object.keys(row).find(k => k.toLowerCase().includes('fondo')) || 'Fondos';

        return {
            amount: isNaN(amount) ? 0 : amount,
            date: dateObj,
            monthKey,
            yearKey,
            fondoCol: (row[fondoHeader] || 'Otros').trim(),
            lote: row['Unidad'] || 'Desconocido',
            raw: row
        };
    }).filter(item => item.amount > 0 && item.monthKey);
    
    // Initially un-filtered
    filteredIngresosData = [...ingresosDataGlobal];
}

function processEgresos(data) {
    egresosDataGlobal = data.map(row => {
        const montoKey = Object.keys(row).find(k => k && k.includes('Monto'));
        const dateKey = Object.keys(row).find(k => k && k.includes('Fecha'));
        // Search specific Sub Fondos column based on user request "SubFondo"
        const subFondoKey = Object.keys(row).find(k => k && k.toLowerCase().includes('sub')) || Object.keys(row).find(k => k && k.includes('Fondo'));
        
        const nuloKey = Object.keys(row).find(k => k && k.includes('Nulo'));
        return { row, montoKey, dateKey, subFondoKey, nuloKey };
    }).filter(mapped => {
        let nulo = mapped.nuloKey ? (mapped.row[mapped.nuloKey] || '').trim() : '';
        return nulo !== 'Si' && mapped.montoKey && mapped.row[mapped.montoKey];
    }).map(mapped => {
        const { row, montoKey, dateKey, subFondoKey } = mapped;
        const amountStr = row[montoKey] ? row[montoKey].replace(/\./g, '') : '0';
        const amount = parseInt(amountStr, 10);
        
        let dateParts = [];
        if (row[dateKey]) dateParts = row[dateKey].trim().split('/');
        
        let dateObj = null;
        let monthKey = '';
        let yearKey = '';
        
        if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
            monthKey = `${year}-${month}`;
            yearKey = year;
        }

        // SubFondos grouped mapping
        let assignedSubFondo = 'Sin Definir';
        if (subFondoKey && row[subFondoKey]) {
            assignedSubFondo = row[subFondoKey].replace(/íú/g, '').replace(/\uFFFD/g, 'ó').trim();
        }

        return {
            amount: isNaN(amount) ? 0 : amount,
            date: dateObj,
            monthKey,
            yearKey,
            subFondo: assignedSubFondo,
            raw: row
        };
    }).filter(item => item.amount > 0 && item.monthKey);

    filteredEgresosData = [...egresosDataGlobal];
}

// --- 5.1 FILTERS LOGIC ---
function populateIngresosFilters() {
    const uniqueFondos = [...new Set(ingresosDataGlobal.map(i => i.fondoCol))].sort();
    const uniqueLotes = [...new Set(ingresosDataGlobal.map(i => i.lote))].sort((a,b) => a.localeCompare(b, 'es', {numeric: true}));
    
    // Clear keeping 'ALL'
    filterFondoIngresos.innerHTML = '<option value="ALL">Mostrar Todos (Sin Filtro)</option>';
    filterLoteIngresos.innerHTML = '<option value="ALL">Mostrar Todos (Sin Filtro)</option>';
    
    uniqueFondos.forEach(fondo => {
        if (!fondo) return;
        const opt = document.createElement('option');
        opt.value = fondo;
        opt.innerText = fondo;
        filterFondoIngresos.appendChild(opt);
    });

    uniqueLotes.forEach(lote => {
        if (!lote) return;
        const opt = document.createElement('option');
        opt.value = lote;
        opt.innerText = lote;
        filterLoteIngresos.appendChild(opt);
    });
}

function populateEgresosFilters() {
    const uniqueSubFondos = [...new Set(egresosDataGlobal.map(e => e.subFondo))].sort();
    
    filterSubFondoEgresos.innerHTML = '<option value="ALL">Mostrar Todos (Sin Filtro)</option>';
    
    uniqueSubFondos.forEach(sf => {
        if (!sf) return;
        const opt = document.createElement('option');
        opt.value = sf;
        opt.innerText = sf;
        filterSubFondoEgresos.appendChild(opt);
    });
}

function applyFiltersIngresos(triggerUpdate = true) {
    const fval = filterFondoIngresos.value;
    const lval = filterLoteIngresos.value;

    filteredIngresosData = ingresosDataGlobal.filter(i => {
        const matchFondo = (fval === 'ALL' || i.fondoCol === fval);
        const matchLote = (lval === 'ALL' || i.lote === lval);
        return matchFondo && matchLote;
    });

    updateIngresosDashboard();
    updateGeneralDashboard();
}

function applyFiltersEgresos(triggerUpdate = true) {
    const sfval = filterSubFondoEgresos.value;
    if (sfval === 'ALL') {
        filteredEgresosData = [...egresosDataGlobal];
    } else {
        filteredEgresosData = egresosDataGlobal.filter(e => e.subFondo === sfval);
    }
    updateEgresosDashboard();
    updateGeneralDashboard();
}

// --- 6. DASHBOARDS UPDATE ---
let totalIngresosHist = 0;
let totalEgresosHist = 0;
let montlyIngresosAggr = {};
let montlyEgresosAggr = {};

function updateIngresosDashboard() {
    totalIngresosHist = 0;
    const yearlyData = {};
    const loteData = {};
    const monthlyUniqueLots = {};
    montlyIngresosAggr = {};

    filteredIngresosData.forEach(item => {
        totalIngresosHist += item.amount;
        if (!montlyIngresosAggr[item.monthKey]) montlyIngresosAggr[item.monthKey] = 0;
        montlyIngresosAggr[item.monthKey] += item.amount;
        
        if (!yearlyData[item.yearKey]) yearlyData[item.yearKey] = 0;
        yearlyData[item.yearKey] += item.amount;
        
        if (!item.lote.toLowerCase().includes('areas comunes')) {
            if (!loteData[item.lote]) loteData[item.lote] = 0;
            loteData[item.lote] += item.amount;
        }

        if (!monthlyUniqueLots[item.monthKey]) monthlyUniqueLots[item.monthKey] = new Set();
        if (!item.lote.toLowerCase().includes('areas comunes')) {
            monthlyUniqueLots[item.monthKey].add(item.lote);
        }
    });

    const numMonths = Object.keys(montlyIngresosAggr).length;
    const numYears = Object.keys(yearlyData).length;
    const numLotes = Object.keys(loteData).length;

    historicalAvgYearlyIndex = numYears ? Math.round(totalIngresosHist / numYears) : 0;
    
    kpiTotalIngresos.innerText = formatCurrency(totalIngresosHist);
    kpiAvgMonthlyIngresos.innerText = formatCurrency(numMonths ? totalIngresosHist / numMonths : 0);
    kpiAvgYearlyIngresos.innerText = formatCurrency(historicalAvgYearlyIndex);
    
    const totalLotesAmount = Object.values(loteData).reduce((a, b) => a + b, 0);
    kpiAvgPerLotIngresos.innerText = formatCurrency(numLotes ? totalLotesAmount / numLotes : 0);
    
    const avgLots = numMonths ? Object.values(monthlyUniqueLots).reduce((a, set) => a + set.size, 0) / numMonths : 0;
    kpiLotsPerMonth.innerText = Math.round(avgLots);

    // Auto-fill budget if not modified manually yet
    if (!projAnnualIncome.dataset.dirty) {
        projAnnualIncome.value = historicalAvgYearlyIndex;
        calculateBudget();
    }

    // Charts
    renderLineChart('monthlyChartIngresos', montlyIngresosAggr, 'Ingresos (CLP)', '#58a6ff');
    renderBarChart('yearlyChartIngresos', yearlyData, 'Ingresos Anuales', '#3fb950');
    renderTopLotesChart(loteData);
}

function updateEgresosDashboard() {
    totalEgresosHist = 0;
    let totalRealSpend2026 = 0;
    const subFondoData = {};
    const yearlyDataEgr = {};
    montlyEgresosAggr = {};

    filteredEgresosData.forEach(item => {
        totalEgresosHist += item.amount;
        
        if (!montlyEgresosAggr[item.monthKey]) montlyEgresosAggr[item.monthKey] = 0;
        montlyEgresosAggr[item.monthKey] += item.amount;

        if (!yearlyDataEgr[item.yearKey]) yearlyDataEgr[item.yearKey] = 0;
        yearlyDataEgr[item.yearKey] += item.amount;
        
        if (!subFondoData[item.subFondo]) subFondoData[item.subFondo] = 0;
        subFondoData[item.subFondo] += item.amount;
        
        if (item.yearKey === '2026') {
            totalRealSpend2026 += item.amount;
        }
    });

    const numMonths = Object.keys(montlyEgresosAggr).length;
    const numYearsEgr = Object.keys(yearlyDataEgr).length;

    historicalAvgYearlyEgress = numYearsEgr ? Math.round(totalEgresosHist / numYearsEgr) : 0;

    kpiTotalEgresos.innerText = formatCurrency(totalEgresosHist);
    kpiAvgMonthlyEgresos.innerText = formatCurrency(numMonths ? totalEgresosHist / numMonths : 0);
    kpiTotalCurrentYearEgresos.innerText = formatCurrency(totalRealSpend2026);
    kpiTotalTransactions.innerText = filteredEgresosData.length;

    // Auto-fill budget egress
    if (!annualBudgetEgresos.dataset.dirty) {
        // if user filters, it's cool. but let's base it on average.
        annualBudgetEgresos.value = historicalAvgYearlyEgress;
        calculateBudget();
    }

    // Charts
    renderLineChart('monthlyChartEgresos', montlyEgresosAggr, 'Egresos (CLP)', '#f85149');
    renderFondoChart(subFondoData);
}

// Track diryt state so we dont overwrite user input
projAnnualIncome.addEventListener('input', () => projAnnualIncome.dataset.dirty = true);
annualBudgetEgresos.addEventListener('input', () => annualBudgetEgresos.dataset.dirty = true);

function updateGeneralDashboard() {
    const balance = totalIngresosHist - totalEgresosHist;
    
    kpiTotalIngresosGeneral.innerText = formatCurrency(totalIngresosHist);
    kpiTotalEgresosGeneral.innerText = formatCurrency(totalEgresosHist);
    kpiBalanceNeto.innerText = formatCurrency(balance);

    if (balance < 0) kpiBalanceNeto.className = "color-danger-text";
    else kpiBalanceNeto.className = "color-success";

    renderComparativeChart();
    calculateBudget(); // ensure total is carried forward
}

// --- 7. CHARTS ---
// (Reusing same charting logic for brevity)
function renderLineChart(canvasId, data, label, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map(k => data[k]);
    
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: label,
                data: values,
                borderColor: color,
                backgroundColor: color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#58a6ff', 'rgba(88,166,255,0.2)').replace('#f85149', 'rgba(248,81,73,0.2)'),
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8b949e' } },
                x: { grid: { display: false }, ticks: { color: '#8b949e', maxTicksLimit: 12, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

function renderBarChart(canvasId, data, label, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const sortedKeys = Object.keys(data).sort();
    const values = sortedKeys.map(k => data[k]);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: color,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8b949e' } },
                x: { grid: { display: false }, ticks: { color: '#8b949e', maxTicksLimit: 12, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

function renderTopLotesChart(data) {
    const ctx = document.getElementById('topLotesChart').getContext('2d');
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(i => i[0].replace('Manzana', 'Mz').replace('Lote', 'Lt'));
    const values = sorted.map(i => i[1]);

    if (chartInstances['topLotesChart']) chartInstances['topLotesChart'].destroy();

    chartInstances['topLotesChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Top Aportes (CLP)',
                data: values,
                backgroundColor: '#a371f7',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8b949e' } },
                y: { grid: { display: false }, ticks: { color: '#8b949e' } }
            }
        }
    });
}

function renderFondoChart(data) {
    const ctx = document.getElementById('fondoChart').getContext('2d');
    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = ['#f85149', '#d29922', '#3fb950', '#a371f7', '#58a6ff', '#e6edf3', '#bc8cff', '#00bcd4', '#ff9800'];

    if (chartInstances['fondoChart']) chartInstances['fondoChart'].destroy();

    chartInstances['fondoChart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#e6edf3' } } },
            cutout: '70%'
        }
    });
}

function renderComparativeChart() {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    
    // Merge keys
    const allKeys = new Set([...Object.keys(montlyIngresosAggr), ...Object.keys(montlyEgresosAggr)]);
    const sortedKeys = Array.from(allKeys).sort();

    const inValues = sortedKeys.map(k => montlyIngresosAggr[k] || 0);
    const outValues = sortedKeys.map(k => montlyEgresosAggr[k] || 0);

    if (chartInstances['balanceChart']) chartInstances['balanceChart'].destroy();

    chartInstances['balanceChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedKeys,
            datasets: [
                {
                    label: 'Ingresos',
                    data: inValues,
                    backgroundColor: '#58a6ff',
                    borderRadius: 4
                },
                {
                    label: 'Egresos',
                    data: outValues,
                    backgroundColor: '#f85149',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: '#e6edf3' } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#8b949e' } },
                x: { grid: { display: false }, ticks: { color: '#8b949e', maxTicksLimit: 12, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

// --- 8. BUDGET PLANNER ---
let subtotalDisponible = 0;

function calculateBudget() {
    // Check manual caja base
    const baseCaja = parseInt(kpiCajaActual.value) || 0;

    const pIn = parseInt(projAnnualIncome.value) || 0;
    const pOut = parseInt(annualBudgetEgresos.value) || 0;
    const pDeuda = parseInt(projDeuda.value) || 0;

    subtotalDisponible = baseCaja + pIn + pDeuda - pOut;

    lblCajaPresupuesto.innerText = formatCurrency(baseCaja);
    lblAnnualProjIncome.innerText = formatCurrency(pIn);
    lblAnnualBudget.innerText = formatCurrency(pOut);
    lblDeuda.innerText = formatCurrency(pDeuda);
    lblAvailablePre.innerText = formatCurrency(subtotalDisponible);
    
    savePersistentData();
    renderProjects();
}

function addProject(e) {
    e.preventDefault();
    const priority = parseInt(projPriority.value) || 1;
    const name = projName.value.trim();
    const cost = parseInt(projCost.value);

    if (name && !isNaN(cost) && cost > 0) {
        projects.push({ id: Date.now(), name, cost, priority });
        projName.value = '';
        projCost.value = '';
        renderProjects();
    }
}

function updateProject(id, field, value) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    
    if (field === 'priority' || field === 'cost') {
        value = parseInt(value) || 0;
    }
    proj[field] = value;
    renderProjects();
}
window.updateProject = updateProject;

function removeProject(id) {
    projects = projects.filter(p => p.id !== id);
    renderProjects();
}
window.removeProject = removeProject; // Expose global

function renderProjects() {
    projectsList.innerHTML = '';
    let totalCost = 0;
    
    // Sort projects to be sequential (Primary: Priority ASC, Secondary: ID ASC)
    projects.sort((a,b) => a.priority - b.priority || a.id - b.id);

    let currentBalance = subtotalDisponible;

    projects.forEach((p, index) => {
        totalCost += p.cost;
        currentBalance -= p.cost;
        
        const isNegative = currentBalance < 0;
        const balanceColor = isNegative ? 'color-danger-text' : 'color-success';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        
        tr.innerHTML = `
            <td style="padding: 0.5rem 0;">
                <input type="number" value="${p.priority}" onchange="updateProject(${p.id}, 'priority', this.value)" style="width: 50px; background: transparent; border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; padding: 0.2rem; text-align: center; outline: none;">
            </td>
            <td style="padding: 0.5rem 0;">
                <input type="text" value="${p.name}" onchange="updateProject(${p.id}, 'name', this.value)" style="width: 100%; min-width: 120px; background: transparent; border: 1px dashed transparent; color: var(--text-primary); border-radius: 4px; padding: 0.2rem; outline: none;" onfocus="this.style.border='1px dashed var(--glass-border)'" onblur="this.style.border='1px dashed transparent'">
            </td>
            <td style="padding: 0.5rem 0;">
                <input type="number" value="${p.cost}" onchange="updateProject(${p.id}, 'cost', this.value)" style="width: 110px; background: transparent; border: 1px dashed transparent; color: var(--danger); font-weight: 600; border-radius: 4px; padding: 0.2rem; outline: none;" onfocus="this.style.border='1px dashed var(--glass-border)'" onblur="this.style.border='1px dashed transparent'">
            </td>
            <td class="${balanceColor}" style="padding: 0.5rem 0; font-weight: 700;">
                ${formatCurrency(currentBalance)}
            </td>
            <td style="text-align: right; padding: 0.5rem 0;">
                <button title="Quitar" class="btn-primary" style="background: rgba(248, 81, 73, 0.2); color: var(--danger); outline: 1px solid var(--danger); padding: 0.3rem 0.6rem; font-size: 0.8rem; cursor: pointer;" onclick="removeProject(${p.id})">✖</button>
            </td>
        `;
        projectsList.appendChild(tr);
    });

    totalProjectsCostEl.innerText = formatCurrency(totalCost);
    
    const balance = subtotalDisponible - totalCost;
    finalBalance.innerText = formatCurrency(balance);
    
    if (balance < 0) {
        finalBalance.className = 'color-danger-text';
    } else if (balance > 0) {
        finalBalance.className = 'color-success';
    } else {
        finalBalance.className = 'color-warning';
    }
    
    savePersistentData();
}
