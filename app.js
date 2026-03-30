// --- 1. GLOBAL STATE & CONSTANTS ---
let ingresosDataGlobal = [];
let egresosDataGlobal = [];

let filteredIngresosData = [];
let filteredEgresosData = [];

let projects = [];
let comentariosGlobal = [];

// Track if data is loaded to enable UI
let ingresosLoaded = false;
let egresosLoaded = false;
let debtorsDataGlobal = [];
let filteredDebtorsData = [];

// Format Function
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(amount);
};

// Helper for live input formatting
const formatWithSeparators = (val) => {
    if (!val && val !== 0) return "";
    let n = val.toString().replace(/\D/g, "");
    if (n === "") return "";
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Helper to get raw number from formatted string
const cleanNumber = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    // Remove currency symbols, spaces, dots, commas (except potential decimal)
    // For CLP we assume dots and spaces are separators.
    let str = val.toString().replace(/[^0-9,-]/g, "");
    // If it's empty after cleaning, return 0
    if (str === "") return 0;
    // Handle potential decimal with comma
    if (str.includes(',')) {
        str = str.split(',')[0];
    }
    return parseInt(str, 10) || 0;
};

// Helper for robust date parsing (Antigravity Patch)
const parseFlexibleDate = (dateString) => {
    if (!dateString) return null;
    const cleanDate = dateString.toString().trim().replace(/-/g, '/');
    const parts = cleanDate.split('/');
    if (parts.length !== 3) return null;

    let day, month, year;
    // Detect if format is YYYY/MM/DD
    if (parts[0].length === 4) {
        year = parts[0]; month = parts[1]; day = parts[2];
    } else {
        // Default to DD/MM/YYYY
        day = parts[0]; month = parts[1]; year = parts[2];
    }

    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    if (year.length === 2) year = '20' + year;

    const dateObj = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isNaN(dateObj.getTime())) return null;

    return {
        dateObj,
        monthKey: `${year}-${month}`,
        yearKey: year
    };
};

// --- TOAST NOTIFICATIONS ---
const showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 500);
    }, 4000);

    toast.onclick = () => toast.remove();
};

const toggleLoader = (show) => {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.classList.toggle('active', show);
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

// Debtors Elements
const kpiTotalDeudaGgcc = document.getElementById('kpiTotalDeudaGgcc');
const kpiCountDeudores = document.getElementById('kpiCountDeudores');
const kpiPromedioDeuda = document.getElementById('kpiPromedioDeuda');
const debtorSearch = document.getElementById('debtorSearch');
const debtorsTableBody = document.getElementById('debtorsTableBody');

// Chart Instances
let chartInstances = {};
// Store pre-calculated averages for auto-filling
let historicalAvgYearlyIndex = 0;
let historicalAvgYearlyEgress = 0;

// --- ADMIN MODE ---
let isAdmin = sessionStorage.getItem('isAdmin') === 'true';

window.enterAdminMode = function () {
    if (isAdmin) {
        if (confirm('¿Deseas cerrar la sesión de Administrador?')) {
            sessionStorage.removeItem('isAdmin');
            location.reload();
        }
    } else {
        const pass = prompt('Ingresa la contraseña de administración:');
        if (pass === 'admin2026') {
            sessionStorage.setItem('isAdmin', 'true');
            location.reload();
        } else if (pass !== null) {
            alert('Contraseña incorrecta');
        }
    }
};

// --- PERSISTENCE ---
function loadPersistentData() {
    const savedCaja = localStorage.getItem('kpiCajaActual');
    if (savedCaja) kpiCajaActual.value = formatWithSeparators(savedCaja);

    const savedIn = localStorage.getItem('projAnnualIncome');
    if (savedIn) projAnnualIncome.value = formatWithSeparators(savedIn);

    const savedOut = localStorage.getItem('annualBudgetEgresos');
    if (savedOut) annualBudgetEgresos.value = formatWithSeparators(savedOut);

    const savedDeuda = localStorage.getItem('projDeuda');
    if (savedDeuda) projDeuda.value = formatWithSeparators(savedDeuda);

    const savedProj = localStorage.getItem('projects');
    if (savedProj) {
        try { projects = JSON.parse(savedProj); } catch (e) { }
    }
    const savedComentarios = localStorage.getItem('mitrinhue_comentarios');
    if (savedComentarios) comentariosGlobal = JSON.parse(savedComentarios);
}

function savePersistentData() {
    localStorage.setItem('kpiCajaActual', kpiCajaActual.value);
    localStorage.setItem('projAnnualIncome', projAnnualIncome.value);
    localStorage.setItem('annualBudgetEgresos', annualBudgetEgresos.value);
    localStorage.setItem('projDeuda', projDeuda.value);
    localStorage.setItem('projects', JSON.stringify(projects));
    localStorage.setItem('mitrinhue_comentarios', JSON.stringify(comentariosGlobal));
}

window.exportStateToCsv = function () {
    // 1. Export Projects (Antigravity Patch: CSV Quote Escaping)
    let projCsv = "id,priority,name,cost\n";
    projects.forEach(p => {
        const safeName = (p.name || "").toString().replace(/"/g, '""');
        projCsv += `${p.id},${p.priority},"${safeName}",${p.cost}\n`;
    });

    // 2. Export Config
    let configCsv = "Parametro,Valor,Descripcion\n";
    configCsv += `caja_inicial,${cleanNumber(kpiCajaActual.value)},Saldo base en caja\n`;
    configCsv += `ingreso_anual_proyectado,${cleanNumber(projAnnualIncome.value)},Ingreso proyectado 2026\n`;
    configCsv += `egreso_anual_presupuestado,${cleanNumber(annualBudgetEgresos.value)},Presupuesto egresos 2026\n`;
    configCsv += `deuda_gastos_comunes,${cleanNumber(projDeuda.value)},Deuda estimada a recuperar\n`;

    const blobProj = new Blob([projCsv], { type: 'text/csv' });
    const blobConf = new Blob([configCsv], { type: 'text/csv' });

    const urlProj = URL.createObjectURL(blobProj);
    const urlConf = URL.createObjectURL(blobConf);

    const aProj = document.createElement('a');
    aProj.href = urlProj;
    aProj.download = 'proyectos.csv';
    aProj.click();

    const aConf = document.createElement('a');
    aConf.href = urlConf;
    aConf.download = 'config.csv';
    aConf.click();

    // BLOQUE EXPORTACIÓN COMENTARIOS
    let strComentarios = "\uFEFFFecha,Nombre,Lote,Tipo,Mensaje\n";
    comentariosGlobal.forEach(c => {
        const sNombre = c.nombre ? `"${String(c.nombre).replace(/"/g, '""')}"` : '""';
        const sLote = c.lote ? `"${String(c.lote).replace(/"/g, '""')}"` : '""';
        const sTipo = c.tipo ? `"${String(c.tipo).replace(/"/g, '""')}"` : '""';
        const sMensaje = c.mensaje ? `"${String(c.mensaje).replace(/"/g, '""')}"` : '""';
        strComentarios += `${c.fecha || ""},${sNombre},${sLote},${sTipo},${sMensaje}\n`;
    });
    const blobCom = new Blob([strComentarios], { type: 'text/csv;charset=utf-8;' });
    const linkCom = document.createElement("a");
    const urlCom = URL.createObjectURL(blobCom);
    linkCom.setAttribute("href", urlCom);
    linkCom.setAttribute("download", "comentarios.csv");
    document.body.appendChild(linkCom);
    linkCom.click();
    document.body.removeChild(linkCom);

    showToast('Estado descargado. Por favor, suba los archivos a /data para hacer los cambios permanentes.', 'success');
};

// --- 3. INIT & NAVIGATION LÓGICA ---
document.addEventListener('DOMContentLoaded', () => {
    loadPersistentData();
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Setup Navigation
    setupNavigation();

    // Event Listeners Caja
    // Event Listeners Financial Inputs Formatting
    [kpiCajaActual, projAnnualIncome, annualBudgetEgresos, projDeuda, projCost].forEach(el => {
        if (!el) return;
        el.addEventListener('input', (e) => {
            const cursor = e.target.selectionStart;
            const oldLen = e.target.value.length;
            e.target.value = formatWithSeparators(e.target.value);
            const newLen = e.target.value.length;

            // Adjust cursor position if separators were added
            if (e.target.type === 'text') {
                e.target.setSelectionRange(cursor + (newLen - oldLen), cursor + (newLen - oldLen));
            }

            if (el === projAnnualIncome) el.dataset.dirty = "true";
            calculateBudget();
        });
    });

    // Zoom Charts Listeners
    document.querySelectorAll('.chart-container').forEach(c => {
        c.addEventListener('dblclick', function () {
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

    // Apply Admin / Read-only Locks
    if (!isAdmin) {
        document.querySelectorAll('.upload-section').forEach(el => el.style.display = 'none');
        kpiCajaActual.readOnly = true;
        // Subtle styling for readonly to ensure visibility
        kpiCajaActual.style.borderBottom = '1px solid rgba(63, 185, 80, 0.2)';
        kpiCajaActual.style.cursor = 'default';

        projAnnualIncome.readOnly = true;
        projAnnualIncome.style.border = 'none';

        annualBudgetEgresos.readOnly = true;
        annualBudgetEgresos.style.border = 'none';

        projDeuda.readOnly = true;
        projDeuda.style.border = 'none';

        projectForm.style.display = 'none';

        const restoreBtn = document.querySelector('button[onclick="localStorage.clear(); location.reload();"]');
        if (restoreBtn) restoreBtn.style.display = 'none';
    } else {
        // Show Export button for admins
        const exportContainer = document.getElementById('adminExportContainer');
        if (exportContainer) exportContainer.style.display = 'block';
    }

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
                // Re-render debtors if debt tab
                if (targetId === 'view-deuda') {
                    renderDebtorsDashboard();
                }
            }
        });
    });

    if (debtorSearch) {
        debtorSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            filteredDebtorsData = debtorsDataGlobal.filter(d =>
                d.Unidad.toLowerCase().includes(query)
            );
            renderDebtorsTable();
        });
    }
}

// --- 4. DATA FETCHING ---
function loadRealData() {
    toggleLoader(true);
    // 0. Fetch Configs & Projects first
    Promise.all([
        fetch('data/config.csv').then(r => r.ok ? r.text() : ""),
        fetch('data/proyectos.csv').then(r => r.ok ? r.text() : ""),
        fetch('data/deuda.csv').then(r => r.ok ? r.text() : "")
    ]).then(([configCsv, proyectosCsv, deudaCsv]) => {
        // Parse config
        if (configCsv) {
            let configData = Papa.parse(configCsv, { header: true, skipEmptyLines: true }).data;
            let conf = {};
            configData.forEach(row => {
                if (row.Parametro) conf[row.Parametro] = row.Valor;
            });

            // Priority: Local Storage (if user is currently editing) > Server CSV
            if (conf.caja_inicial && !localStorage.getItem('kpiCajaActual')) {
                kpiCajaActual.value = formatWithSeparators(conf.caja_inicial);
            }
            if (conf.deuda_gastos_comunes && !localStorage.getItem('projDeuda')) {
                projDeuda.value = formatWithSeparators(conf.deuda_gastos_comunes);
            }
            if (conf.ingreso_anual_proyectado && !localStorage.getItem('projAnnualIncome')) {
                projAnnualIncome.value = formatWithSeparators(conf.ingreso_anual_proyectado);
            }
            if (conf.egreso_anual_presupuestado && !localStorage.getItem('annualBudgetEgresos')) {
                annualBudgetEgresos.value = formatWithSeparators(conf.egreso_anual_presupuestado);
            }
        }

        // Parse proyectos (Antigravity Patch: Race Condition & Sync Fix)
        if (proyectosCsv) {
            let pData = Papa.parse(proyectosCsv, { header: true, skipEmptyLines: true }).data;
            let serverProjects = pData.filter(p => p.name).map(p => ({
                id: cleanNumber(p.id) || Date.now() + Math.random(),
                name: p.name.toString().trim(),
                cost: cleanNumber(p.cost),
                priority: cleanNumber(p.priority) || 1
            }));

            const localProjStr = localStorage.getItem('projects');
            const serverProjStr = JSON.stringify(serverProjects);

            if (!localProjStr) {
                projects = serverProjects;
                renderProjects();
            } else {
                if (localProjStr !== serverProjStr) {
                    if (isAdmin) {
                        projects = JSON.parse(localProjStr);
                        renderProjects();
                        showToast('⚠️ Tienes cambios en proyectos sin exportar al servidor. Revisa el estado de sincronización.', 'warning');
                    } else {
                        projects = serverProjects;
                        renderProjects();
                    }
                } else {
                    projects = serverProjects;
                    renderProjects();
                }
            }
        }

        // Parse deuda
        if (deudaCsv) {
            Papa.parse(deudaCsv, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    processDeuda(results.data);
                },
                error: function (err) {
                    console.error("Error parsing deuda.csv:", err);
                }
            });
        }

        // Trigger the main CSVs
        fetchIngresosYegresos();
    }).catch(err => {
        console.warn("Error fetching config, proceeding with defaults", err);
        fetchIngresosYegresos();
    }).finally(() => {
        // We don't hide loader here yet, because fetchIngresosYegresos is async
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
                complete: function (results) {
                    processIngresos(results.data);
                    populateIngresosFilters();
                    ingresosLoaded = true;
                    checkAllDataLoaded();
                },
                error: function (err) {
                    console.error("Error parsing ingresos.csv:", err);
                    showToast("Error al procesar ingresos.csv del servidor", "error");
                    toggleLoader(false);
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
                complete: function (results) {
                    processEgresos(results.data);
                    populateEgresosFilters();
                    egresosLoaded = true;
                    checkAllDataLoaded();
                },
                error: function (err) {
                    console.error("Error parsing egresos.csv:", err);
                    showToast("Error al procesar egresos.csv del servidor", "error");
                    toggleLoader(false);
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
        complete: function (results) {
            processIngresos(results.data);
            populateIngresosFilters();
            ingresosLoaded = true;
            checkAllDataLoaded(true);
        },
        error: function (err) {
            console.error("Error parsing uploaded ingresos:", err);
            showToast("Error al procesar el archivo de Ingresos subido", "error");
            dataStatus.innerText = "Error al procesar el archivo de Ingresos";
            dataStatus.style.color = "var(--danger)";
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
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split('\n');
        const cleanedCsv = lines.length > 4 ? lines.slice(4).join('\n') : text;

        Papa.parse(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            delimiter: ";",
            complete: function (results) {
                processEgresos(results.data);
                populateEgresosFilters();
                egresosLoaded = true;
                checkAllDataLoaded(true);
            },
            error: function (err) {
                console.error("Error parsing uploaded egresos:", err);
                showToast("Error al procesar el archivo de Egresos subido", "error");
                dataStatus.innerText = "Error al procesar el archivo de Egresos";
                dataStatus.style.color = "var(--danger)";
            }
        });
    };
    reader.readAsText(file, 'ISO-8859-1'); // Egresos often ISO-8859-1 exported from Windows
}


function checkAllDataLoaded(loadedManually = false) {
    if (ingresosLoaded && egresosLoaded) {
        toggleLoader(false);
        dataStatus.innerText = loadedManually ? "CSVs Locales Cargados" : "Conectado a Datos Reales";
        dataStatus.style.color = "var(--success)";

        if (loadedManually) showToast("Datos cargados correctamente", "success");

        applyFiltersIngresos(false);
        applyFiltersEgresos(false);
    }
}

// --- 5. DATA PROCESSING ---
function processIngresos(data) {
    if (!data || !Array.isArray(data)) {
        console.error("No valid data for Ingresos");
        return;
    }
    ingresosDataGlobal = data.filter(row => {
        try {
            return row && row['Nulo'] !== 'Si' && row['Monto'] && row['Fecha Ingreso'];
        } catch (e) { return false; }
    }).map(row => {
        try {
            const amount = cleanNumber(row['Monto']);

            // Antigravity Patch: Flexible Date Parsing
            const parsedDate = parseFlexibleDate(row['Fecha Ingreso']);
            let dateObj = null, monthKey = '', yearKey = '';

            if (parsedDate) {
                dateObj = parsedDate.dateObj;
                monthKey = parsedDate.monthKey;
                yearKey = parsedDate.yearKey;
            }

            // Identify the exact header containing "Fondo" string for Ingresos (usually "Fondos")
            const fondoHeader = Object.keys(row).find(k => k && k.toLowerCase().includes('fondo')) || 'Fondos';

            return {
                amount: isNaN(amount) ? 0 : amount,
                date: dateObj,
                monthKey,
                yearKey,
                fondoCol: (row[fondoHeader] || 'Otros').toString().trim(),
                lote: (row['Unidad'] || 'Desconocido').toString().trim(),
                raw: row
            };
        } catch (e) {
            console.warn("Error processing row in Ingresos:", e, row);
            return null;
        }
    }).filter(item => item && item.amount > 0 && item.monthKey);

    // Initially un-filtered
    filteredIngresosData = [...ingresosDataGlobal];
}

function processEgresos(data) {
    if (!data || !Array.isArray(data)) {
        console.error("No valid data for Egresos");
        return;
    }
    egresosDataGlobal = data.map(row => {
        try {
            const montoKey = Object.keys(row).find(k => k && k.includes('Monto'));
            const dateKey = Object.keys(row).find(k => k && k.includes('Fecha'));
            // Search specific Sub Fondos column based on user request "SubFondo"
            const subFondoKey = Object.keys(row).find(k => k && k.toLowerCase().includes('sub')) || Object.keys(row).find(k => k && k.includes('Fondo'));

            const nuloKey = Object.keys(row).find(k => k && k.includes('Nulo'));
            return { row, montoKey, dateKey, subFondoKey, nuloKey };
        } catch (e) { return null; }
    }).filter(mapped => {
        if (!mapped) return false;
        let nulo = mapped.nuloKey ? (mapped.row[mapped.nuloKey] || '').toString().trim() : '';
        return nulo !== 'Si' && mapped.montoKey && mapped.row[mapped.montoKey];
    }).map(mapped => {
        try {
            const { row, montoKey, dateKey, subFondoKey } = mapped;
            const amount = cleanNumber(row[montoKey]);

            // Antigravity Patch: Flexible Date Parsing
            const parsedDate = parseFlexibleDate(row[dateKey]);
            let dateObj = null, monthKey = '', yearKey = '';

            if (parsedDate) {
                dateObj = parsedDate.dateObj;
                monthKey = parsedDate.monthKey;
                yearKey = parsedDate.yearKey;
            }

            // SubFondos grouped mapping
            let assignedSubFondo = 'Sin Definir';
            if (subFondoKey && row[subFondoKey]) {
                assignedSubFondo = row[subFondoKey].toString().replace(/íú/g, '').replace(/\uFFFD/g, 'ó').trim();
            }

            return {
                amount: isNaN(amount) ? 0 : amount,
                date: dateObj,
                monthKey,
                yearKey,
                subFondo: assignedSubFondo,
                raw: row
            };
        } catch (e) {
            console.warn("Error processing row in Egresos:", e);
            return null;
        }
    }).filter(item => item && item.amount > 0 && item.monthKey);

    filteredEgresosData = [...egresosDataGlobal];
}

// --- 5.1 FILTERS LOGIC ---
function populateIngresosFilters() {
    const uniqueFondos = [...new Set(ingresosDataGlobal.map(i => i.fondoCol))].sort();
    const uniqueLotes = [...new Set(ingresosDataGlobal.map(i => i.lote))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

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
    const baseCaja = cleanNumber(kpiCajaActual.value);

    const pIn = cleanNumber(projAnnualIncome.value);
    const pOut = cleanNumber(annualBudgetEgresos.value);
    const pDeuda = cleanNumber(projDeuda.value);

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
    const cost = cleanNumber(projCost.value);

    if (name && cost > 0) {
        projects.push({ id: Date.now(), name, cost, priority });
        projName.value = '';
        projCost.value = '';
        savePersistentData(); // CRITICAL FIX: Ensure projects are saved
        renderProjects();
    }
}

function updateProject(id, field, value) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;

    if (field === 'priority' || field === 'cost') {
        value = cleanNumber(value);
    }
    proj[field] = value;
    savePersistentData(); // CRITICAL FIX: Ensure projects are saved
    renderProjects();
}
window.updateProject = updateProject;

function removeProject(id) {
    if (!confirm('¿Eliminar este proyecto?')) return;
    projects = projects.filter(p => p.id !== id);
    savePersistentData(); // CRITICAL FIX: Ensure projects are saved
    renderProjects();
}
window.removeProject = removeProject; // Expose global

function renderProjects() {
    projectsList.innerHTML = '';
    let totalCost = 0;

    // Sort projects to be sequential (Primary: Priority ASC, Secondary: ID ASC)
    projects.sort((a, b) => a.priority - b.priority || a.id - b.id);

    let currentBalance = subtotalDisponible;

    projects.forEach((p, index) => {
        totalCost += p.cost;
        currentBalance -= p.cost;

        const isNegative = currentBalance < 0;
        const balanceColor = isNegative ? 'color-danger-text' : 'color-success';

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';

        const disableAttr = isAdmin ? '' : 'disabled';

        tr.innerHTML = `
            <td style="padding: 0.5rem 0;">
                <input type="number" value="${p.priority}" onchange="updateProject(${p.id}, 'priority', this.value)" style="width: 50px; background: transparent; border: ${isAdmin ? '1px solid var(--glass-border)' : 'none'}; color: var(--text-primary); border-radius: 4px; padding: 0.2rem; text-align: center; outline: none;" ${disableAttr}>
            </td>
            <td style="padding: 0.5rem 0;">
                <input type="text" value="${p.name}" onchange="updateProject(${p.id}, 'name', this.value)" style="width: 100%; min-width: 120px; background: transparent; border: 1px dashed transparent; color: var(--text-primary); border-radius: 4px; padding: 0.2rem; outline: none;" onfocus="this.style.border='1px dashed var(--glass-border)'" onblur="this.style.border='1px dashed transparent'" ${disableAttr}>
            </td>
            <td style="padding: 0.5rem 0;">
                <input type="text" value="${formatWithSeparators(p.cost)}" oninput="this.value = formatWithSeparators(this.value)" onchange="updateProject(${p.id}, 'cost', this.value)" style="width: 110px; background: transparent; border: 1px dashed transparent; color: var(--danger); font-weight: 600; border-radius: 4px; padding: 0.2rem; outline: none;" onfocus="this.style.border='1px dashed var(--glass-border)'" onblur="this.style.border='1px dashed transparent'" ${disableAttr}>
            </td>
            <td class="${balanceColor}" style="padding: 0.5rem 0; font-weight: 700;">
                ${formatCurrency(currentBalance)}
            </td>
            ${isAdmin ? `
            <td style="text-align: right; padding: 0.5rem 0;">
                <button title="Quitar" class="btn-primary" style="background: rgba(248, 81, 73, 0.2); color: var(--danger); outline: 1px solid var(--danger); padding: 0.3rem 0.6rem; font-size: 0.8rem; cursor: pointer;" onclick="removeProject(${p.id})">✖</button>
            </td>` : ''}
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

// --- DEBTORS DASHBOARD LOGIC ---
function processDeuda(data) {
    if (!data || !Array.isArray(data)) {
        console.error("No valid data for Deuda");
        return;
    }
    // Filter out potential total row or empty rows
    debtorsDataGlobal = data.filter(row => {
        try {
            return row && row.Unidad && row.Unidad.toString().trim() !== "" && row["Deuda Total Incluye Intereses"];
        } catch (e) { return false; }
    }).map(row => {
        try {
            const rowCopy = { ...row };
            rowCopy.deudaNum = cleanNumber(row["Deuda Total Incluye Intereses"]);
            rowCopy.mesesNum = parseFloat(row["Meses deuda"]) || 0;
            return rowCopy;
        } catch (e) {
            console.warn("Error processing row in Deuda:", e);
            return null;
        }
    }).filter(row => row !== null);

    // Sort by debt descending globally for both table and chart logic
    debtorsDataGlobal.sort((a, b) => b.deudaNum - a.deudaNum);

    filteredDebtorsData = [...debtorsDataGlobal];
    renderDebtorsDashboard();
}

function renderDebtorsDashboard() {
    if (!debtorsDataGlobal.length) return;

    // 1. KPIs
    const totalDeuda = debtorsDataGlobal.reduce((sum, row) => sum + row.deudaNum, 0);
    const countDeudores = debtorsDataGlobal.filter(row => row.deudaNum > 0).length;
    const promedio = countDeudores > 0 ? totalDeuda / countDeudores : 0;

    if (kpiTotalDeudaGgcc) kpiTotalDeudaGgcc.innerText = formatCurrency(totalDeuda);
    if (kpiCountDeudores) kpiCountDeudores.innerText = countDeudores;
    if (kpiPromedioDeuda) kpiPromedioDeuda.innerText = formatCurrency(promedio);

    // 2. Chart: Top 10
    const top10 = [...debtorsDataGlobal]
        .sort((a, b) => b.deudaNum - a.deudaNum)
        .slice(0, 10);

    renderDebtorsChart(top10);
    renderOverdueDistributionChart();
    renderDebtorsTable();
}

function renderDebtorsChart(data) {
    const ctx = document.getElementById('debtorsChart');
    if (!ctx) return;

    if (chartInstances['debtorsChart']) chartInstances['debtorsChart'].destroy();

    chartInstances['debtorsChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.Unidad + " (" + formatCurrency(d.deudaNum) + ")"),
            datasets: [{
                label: 'Deuda Total ($)',
                data: data.map(d => d.deudaNum),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { left: 20 }
            },
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#8b949e',
                        font: { size: 11 },
                        maxTicksLimit: 6,
                        callback: function (value) {
                            if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
                            return '$' + value;
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: {
                        color: '#e6edf3',
                        font: { size: 10 },
                        autoSkip: false
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function renderOverdueDistributionChart() {
    const ctx = document.getElementById('overdueDistributionChart');
    if (!ctx) return;

    const ranges = {
        '1-3 Meses': 0,
        '3-6 Meses': 0,
        '6-12 Meses': 0,
        '+1 Año': 0
    };

    debtorsDataGlobal.forEach(d => {
        if (d.mesesNum > 12) ranges['+1 Año']++;
        else if (d.mesesNum > 6) ranges['6-12 Meses']++;
        else if (d.mesesNum > 3) ranges['3-6 Meses']++;
        else if (d.mesesNum > 0) ranges['1-3 Meses']++;
    });

    if (chartInstances['overdueDistributionChart']) chartInstances['overdueDistributionChart'].destroy();

    chartInstances['overdueDistributionChart'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                data: Object.values(ranges),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(255, 159, 64, 0.6)',
                    'rgba(255, 99, 132, 0.6)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#888', boxWidth: 12 } }
            }
        }
    });
}

function renderDebtorsTable() {
    if (!debtorsTableBody) return;
    debtorsTableBody.innerHTML = "";

    filteredDebtorsData.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        tr.innerHTML = `
            <td style="padding: 0.8rem; font-size: 0.9rem;">${row.Unidad}</td>
            <td style="padding: 0.8rem; font-size: 0.85rem; opacity: 0.8;">${row["Último ingreso"] === 'No registra' ? 'N/A' : row["Último ingreso"]}</td>
            <td style="padding: 0.8rem; text-align: center; font-weight: 600; color: ${row.mesesNum > 12 ? 'var(--danger)' : 'var(--warning)'}">${row.mesesNum.toFixed(1)}</td>
            <td style="padding: 0.8rem; text-align: right; font-weight: 600;">${formatCurrency(row.deudaNum)}</td>
        `;
        debtorsTableBody.appendChild(tr);
    });
}

// --- MÓDULO AISLADO: COMENTARIOS DE PROPIETARIOS ---

// Captura de Formulario
document.addEventListener("DOMContentLoaded", () => {
    const formComentario = document.getElementById("form-comentario");
    if (formComentario) {
        formComentario.addEventListener("submit", addComentario);
    }
    
    // Renderizar comentarios (y re-renderizar cuando cambie la vista)
    renderComentarios();
});

function addComentario(e) {
    e.preventDefault();
    
    // Capturar valores
    const nombre = document.getElementById('comentario-nombre').value.trim();
    const lote = document.getElementById('comentario-lote').value.trim();
    const tipo = document.getElementById('comentario-tipo').value;
    const mensaje = document.getElementById('comentario-mensaje').value.trim();
    
    // Generar fecha actual
    const fecha = new Date().toISOString().split('T')[0];

    // Crear objeto
    const nuevoComentario = {
        id: Date.now().toString(),
        fecha,
        nombre,
        lote,
        tipo,
        mensaje
    };

    // Actualizar Estado
    comentariosGlobal.push(nuevoComentario);
    
    // Persistir y Renderizar
    if (typeof savePersistentData === "function") savePersistentData();
    renderComentarios();
    
    // Limpiar Formulario
    document.getElementById("form-comentario").reset();
    
    // Notificación
    if (typeof showToast === "function") showToast("Comentario guardado correctamente", "success");
}

function renderComentarios() {
    const tbody = document.getElementById('tabla-comentarios-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (comentariosGlobal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; opacity: 0.7;">No hay comentarios registrados</td></tr>`;
        return;
    }

    // Renderizar ordenando por los más recientes primero
    const comentariosOrdenados = [...comentariosGlobal].sort((a, b) => b.id - a.id);

    comentariosOrdenados.forEach(c => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        
        let badgeColor = "var(--secondary)";
        if (c.tipo === "Reclamo") badgeColor = "var(--danger)";
        if (c.tipo === "Sugerencia") badgeColor = "var(--info)";
        
        tr.innerHTML = `
            <td style="padding: 0.8rem; font-size: 0.85rem; opacity: 0.8;">${c.fecha}</td>
            <td style="padding: 0.8rem; font-size: 0.9rem;">${c.nombre}</td>
            <td style="padding: 0.8rem; font-size: 0.9rem;"><strong>${c.lote}</strong></td>
            <td style="padding: 0.8rem; font-size: 0.9rem;"><span style="background: ${badgeColor}; color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">${c.tipo}</span></td>
            <td style="max-width: 300px; white-space: normal; padding: 0.8rem; font-size: 0.85rem; line-height: 1.4;">${c.mensaje}</td>
        `;
        tbody.appendChild(tr);
    });
}