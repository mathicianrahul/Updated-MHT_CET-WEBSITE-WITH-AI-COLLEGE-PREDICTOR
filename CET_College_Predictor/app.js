const API_BASE = "http://127.0.0.1:8000/api";
let metadata = { cities: [], universities: [], branches: [], categories: [], cap_rounds: [] };
let allResultsData = [];
let currentMetrics = {};
let activeCitiesOrder = [];
let activeBranchesOrder = [];
let selectedSortBy = "cutoff";

// Helper to format codes as integer strings without .0
function formatIntCode(val) {
    if (val === null || val === undefined || val === '') return '';
    let str = val.toString().trim();
    if (str.endsWith('.0')) {
        str = str.slice(0, -2);
    }
    if (str.includes('.')) {
        str = str.split('.')[0];
    }
    return str;
}

// Elements
const studentNameInput = document.getElementById("student-name");
const percentileNum = document.getElementById("percentile-num");
const percentileRange = document.getElementById("percentile-range");
const percentileTypeSelect = document.getElementById("percentile-type");
const percentileLabel = document.getElementById("percentile-label");
const categorySelect = document.getElementById("category");
const genderSelect = document.getElementById("gender");
const homeUniversitySelect = document.getElementById("home-university");
const capRoundSelect = document.getElementById("cap-round");
const isPwdCheckbox = document.getElementById("is-pwd");
const isDefenseCheckbox = document.getElementById("is-defense");

const citySearch = document.getElementById("city-search");
const cityCheckList = document.getElementById("city-checkbox-list");
const cityPriorityList = document.getElementById("city-priority-list");

const branchSearch = document.getElementById("branch-search");
const branchCheckList = document.getElementById("branch-checkbox-list");
const branchPriorityList = document.getElementById("branch-priority-list");

const predictorForm = document.getElementById("predictor-form");
const resultsPlaceholder = document.getElementById("results-placeholder");
const resultsLoader = document.getElementById("results-loader");
const resultsList = document.getElementById("results-list");

const btnExportCsv = document.getElementById("btn-export-csv");
const btnExportXlsx = document.getElementById("btn-export-xlsx");
const btnCopyAllCodes = document.getElementById("btn-copy-all-codes");
const btnPrintForm = document.getElementById("btn-print-form");
const toastEl = document.getElementById("toast");

const resultSearch = document.getElementById("result-search");
const perPageSelect = document.getElementById("per-page-select");

// View Mode State & Pagination State
let activeViewMode = "cards"; // Default to Cards Grid View per user request
let currentMetricFilter = null; // Quick filter from metric cards (dream, moderate, safe, autonomous, govt, private, university)
let currentPage = 1;
let pageSize = 50;

// New UI Elements
const viewBtnTable = document.getElementById("view-btn-table");
const viewBtnCards = document.getElementById("view-btn-cards");
const resultsContainer = document.getElementById("results-container");
const tableViewWrap = document.getElementById("table-view-wrap");
const tableBody = document.getElementById("table-body");
const paginationBar = document.getElementById("pagination-bar");
const paginationInfo = document.getElementById("pagination-info");
const pagePrevBtn = document.getElementById("page-prev");
const pageNextBtn = document.getElementById("page-next");
const pageNumbersContainer = document.getElementById("page-numbers-container");

// Modal Elements
const collegeModalOverlay = document.getElementById("college-modal-overlay");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalBtnClose = document.getElementById("modal-btn-close");
const modalBtnCopyCode = document.getElementById("modal-btn-copy-code");
const modalBtnCopyAlt = document.getElementById("modal-btn-copy-alt");

// Toast Notification
function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => {
        toastEl.classList.remove("show");
    }, 3000);
}

// Theme Toggle
const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    themeToggle.innerHTML = nextTheme === "light" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

// Percentile Slider Sync
percentileRange.addEventListener("input", (e) => {
    percentileNum.value = parseFloat(e.target.value).toFixed(4);
});
percentileNum.addEventListener("change", (e) => {
    if (e.target.value === "" || isNaN(parseFloat(e.target.value))) {
        percentileNum.value = "";
        percentileRange.value = "0";
        return;
    }
    let val = parseFloat(e.target.value);
    val = Math.max(0, Math.min(100, val));
    percentileNum.value = val.toFixed(4);
    percentileRange.value = val.toFixed(2);
});

// Segmented Exam Toggle Buttons (MHT-CET vs JEE Main) Sync
const examToggleBtns = document.querySelectorAll(".exam-toggle-btn");

function setExamType(examType, showNotification = true) {
    examToggleBtns.forEach(btn => {
        if (btn.dataset.exam === examType) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    if (percentileTypeSelect) {
        percentileTypeSelect.value = examType;
    }

    if (percentileNum) {
        percentileNum.placeholder = examType === "JEE-Main" 
            ? "Enter JEE Main Percentile (e.g. 88.50)" 
            : "Enter MHT-CET Percentile (e.g. 95.50)";
    }

    if (examType === "JEE-Main") {
        if (categorySelect.value !== "All India (AI / JEE)") {
            categorySelect.value = "All India (AI / JEE)";
            if (showNotification) showToast("Category automatically set to All India (AI / JEE)");
        }
    } else {
        if (categorySelect.value === "All India (AI / JEE)") {
            categorySelect.value = "";
        }
    }
}

examToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        setExamType(btn.dataset.exam, true);
    });
});

if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
        if (e.target.value === "All India (AI / JEE)") {
            setExamType("JEE-Main", false);
        } else {
            const currentExam = percentileTypeSelect ? percentileTypeSelect.value : "MHT-CET";
            if (currentExam === "JEE-Main") {
                setExamType("MHT-CET", false);
            }
        }
    });
}

// Load Metadata
async function fetchMetadata() {
    try {
        const response = await fetch(`${API_BASE}/metadata`);
        if (!response.ok) throw new Error("Metadata fetch failed");
        metadata = await response.json();
    } catch (e) {
        console.warn("Using fallback metadata", e);
        metadata = {
            cities: ["Pune", "Mumbai", "Navi Mumbai", "Thane", "Pimpri-Chinchwad", "Nashik", "Nagpur", "Aurangabad", "Kolhapur", "Solapur", "Sangli", "Jalgaon", "Amravati", "Dhule", "Shirpur", "Nanded", "Latur", "Satara", "Ratnagiri", "Ahmednagar", "Akola", "Buldhana", "Yavatmal", "Chandrapur"],
            universities: ["Savitribai Phule Pune University", "Mumbai University", "Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon", "Sant Gadge Baba Amravati University", "Rashtrasant Tukadoji Maharaj Nagpur University", "Dr. Babasaheb Ambedkar Marathwada University", "Shivaji University", "Punyashlok Ahilyadevi Holkar Solapur University", "Swami Ramanand Teerth Marathwada University, Nanded", "Gondwana University"],
            branches: ["Computer Engineering", "Artificial Intelligence And Machine Learning", "Artificial Intelligence And Data Science", "Information Technology", "Electronics And Telecommunication Engg", "Mechanical Engineering", "Civil Engineering", "Electrical Engineering"],
            categories: ["Open", "OBC", "SC", "ST", "VJ", "NT1", "NT2", "NT3", "SEBC", "EWS", "TFWS", "All India (AI / JEE)"],
            cap_rounds: ["CAP Round 1", "CAP Round 2", "CAP Round 3", "CAP Round 4", "All Rounds"]
        };
    }
    
    populateDropdowns();
    initCities();
    initBranches();
    initPrioritySort();
}

function populateDropdowns() {
    categorySelect.innerHTML = '<option value="" disabled selected>-- Select Your Category --</option>';
    metadata.categories.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        categorySelect.appendChild(opt);
    });

    homeUniversitySelect.innerHTML = '<option value="" disabled selected>-- Select Home University --</option>';
    metadata.universities.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u; opt.textContent = u;
        homeUniversitySelect.appendChild(opt);
    });

    if (capRoundSelect && metadata.cap_rounds && metadata.cap_rounds.length > 0) {
        const currentVal = capRoundSelect.value || "CAP Round 1";
        capRoundSelect.innerHTML = '';
        metadata.cap_rounds.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r; opt.textContent = r;
            if (r === currentVal) opt.selected = true;
            capRoundSelect.appendChild(opt);
        });
    }
}

// CITIES LOGIC
function initCities() {
    renderCityCheckboxes();
    renderCityPriorityChips();

    document.getElementById("city-select-all").addEventListener("click", () => {
        metadata.cities.forEach(c => { if (!activeCitiesOrder.includes(c)) activeCitiesOrder.push(c); });
        renderCityCheckboxes();
        renderCityPriorityChips();
    });

    document.getElementById("city-clear-all").addEventListener("click", () => {
        activeCitiesOrder = [];
        renderCityCheckboxes();
        renderCityPriorityChips();
    });

    citySearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        cityCheckList.querySelectorAll(".check-item").forEach(item => {
            const txt = item.dataset.val.toLowerCase();
            item.style.display = txt.includes(query) ? "flex" : "none";
        });
    });

    new Sortable(cityPriorityList, {
        animation: 150,
        handle: '.chip-drag-handle',
        onEnd: () => {
            const newOrder = [];
            cityPriorityList.querySelectorAll(".priority-chip").forEach(chip => {
                newOrder.push(chip.dataset.val);
            });
            activeCitiesOrder = newOrder;
            renderCityPriorityChips();
        }
    });
}

function renderCityCheckboxes() {
    cityCheckList.innerHTML = "";
    metadata.cities.forEach(city => {
        const isChecked = activeCitiesOrder.includes(city);
        const div = document.createElement("label");
        div.className = "check-item";
        div.dataset.val = city;
        div.innerHTML = `
            <input type="checkbox" value="${city}" ${isChecked ? 'checked' : ''}>
            <span class="custom-square"></span>
            <span>${city}</span>
        `;
        div.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) {
                if (!activeCitiesOrder.includes(city)) activeCitiesOrder.push(city);
            } else {
                activeCitiesOrder = activeCitiesOrder.filter(c => c !== city);
            }
            renderCityPriorityChips();
        });
        cityCheckList.appendChild(div);
    });
}

function renderCityPriorityChips() {
    cityPriorityList.innerHTML = "";
    activeCitiesOrder.forEach((city, idx) => {
        const chip = document.createElement("div");
        chip.className = "priority-chip";
        chip.dataset.val = city;
        chip.innerHTML = `
            <i class="fa-solid fa-grip-vertical chip-drag-handle"></i>
            <span class="chip-num">${idx + 1}</span>
            <span class="chip-label">${city}</span>
            <i class="fa-solid fa-xmark chip-remove"></i>
        `;
        chip.querySelector(".chip-remove").addEventListener("click", () => {
            activeCitiesOrder = activeCitiesOrder.filter(c => c !== city);
            renderCityCheckboxes();
            renderCityPriorityChips();
        });
        cityPriorityList.appendChild(chip);
    });
}

// BRANCHES LOGIC
function initBranches() {
    activeBranchesOrder = [];
    renderBranchCheckboxes();
    renderBranchPriorityChips();

    document.getElementById("branch-select-all").addEventListener("click", () => {
        metadata.branches.forEach(b => { if (!activeBranchesOrder.includes(b)) activeBranchesOrder.push(b); });
        renderBranchCheckboxes();
        renderBranchPriorityChips();
    });

    document.getElementById("branch-clear-all").addEventListener("click", () => {
        activeBranchesOrder = [];
        renderBranchCheckboxes();
        renderBranchPriorityChips();
    });

    let currentCategoryFilter = "all";

    function filterBranches() {
        const query = branchSearch.value.toLowerCase().trim();
        branchCheckList.querySelectorAll(".check-item").forEach(item => {
            const txt = item.dataset.val.toLowerCase();
            let matchesCategory = true;

            if (currentCategoryFilter === "computer") {
                matchesCategory = txt.includes("computer") || txt.includes("information") || txt.includes("artificial") || txt.includes("data") || txt.includes("cyber") || txt.includes("iot") || txt.includes("software") || txt.includes("5g");
            } else if (currentCategoryFilter === "entc") {
                matchesCategory = txt.includes("electrical") || txt.includes("electronics") || txt.includes("telecommunication") || txt.includes("communication") || txt.includes("vlsi") || txt.includes("instrumentation");
            } else if (currentCategoryFilter === "mechanical") {
                matchesCategory = txt.includes("mechanical") || txt.includes("civil") || txt.includes("automobile") || txt.includes("mechatronics") || txt.includes("structural") || txt.includes("robotics") || txt.includes("automation");
            } else if (currentCategoryFilter === "other") {
                matchesCategory = !txt.includes("computer") && !txt.includes("information") && !txt.includes("artificial") && !txt.includes("electrical") && !txt.includes("electronics") && !txt.includes("mechanical") && !txt.includes("civil");
            }

            let matchesSearch = true;
            if (query) {
                const keywords = query.split(/\s+/);
                matchesSearch = keywords.every(kw => txt.includes(kw));
            }

            item.style.display = (matchesCategory && matchesSearch) ? "flex" : "none";
        });
    }

    const pills = document.querySelectorAll("#branch-category-pills .branch-pill");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentCategoryFilter = pill.dataset.filter;
            filterBranches();
        });
    });

    branchSearch.addEventListener("input", filterBranches);

    new Sortable(branchPriorityList, {
        animation: 150,
        handle: '.chip-drag-handle',
        onEnd: () => {
            const newOrder = [];
            branchPriorityList.querySelectorAll(".priority-chip").forEach(chip => {
                newOrder.push(chip.dataset.val);
            });
            activeBranchesOrder = newOrder;
            renderBranchPriorityChips();
        }
    });
}

function renderBranchCheckboxes() {
    branchCheckList.innerHTML = "";
    metadata.branches.forEach(branch => {
        const isChecked = activeBranchesOrder.includes(branch);
        const div = document.createElement("label");
        div.className = "check-item";
        div.dataset.val = branch;
        div.innerHTML = `
            <input type="checkbox" value="${branch}" ${isChecked ? 'checked' : ''}>
            <span class="custom-square"></span>
            <span>${branch}</span>
        `;
        div.querySelector("input").addEventListener("change", (e) => {
            if (e.target.checked) {
                if (!activeBranchesOrder.includes(branch)) activeBranchesOrder.push(branch);
            } else {
                activeBranchesOrder = activeBranchesOrder.filter(b => b !== branch);
            }
            renderBranchPriorityChips();
        });
        branchCheckList.appendChild(div);
    });
}

function renderBranchPriorityChips() {
    branchPriorityList.innerHTML = "";
    activeBranchesOrder.forEach((branch, idx) => {
        const chip = document.createElement("div");
        chip.className = "priority-chip";
        chip.dataset.val = branch;
        chip.innerHTML = `
            <i class="fa-solid fa-grip-vertical chip-drag-handle"></i>
            <span class="chip-num">${idx + 1}</span>
            <span class="chip-label">${branch}</span>
            <i class="fa-solid fa-xmark chip-remove"></i>
        `;
        chip.querySelector(".chip-remove").addEventListener("click", () => {
            activeBranchesOrder = activeBranchesOrder.filter(b => b !== branch);
            renderBranchCheckboxes();
            renderBranchPriorityChips();
        });
        branchPriorityList.appendChild(chip);
    });
}

function calculateMetricsFromList(list) {
    let total = list.length;
    let govt = list.filter(r => r.institute_type === "Government" || (r.institute_type || '').toLowerCase().includes("government")).length;
    let priv = total - govt;
    let auto = list.filter(r => r.autonomy === "Autonomous").length;
    let univ = list.filter(r => (r.university || '').toLowerCase().includes("university") || (r.university || '').toLowerCase().includes("department")).length;
    let safe = list.filter(r => r.status === "Safe").length;
    let mod = list.filter(r => r.status === "Moderate").length;
    let dream = list.filter(r => r.status === "Dream" || r.status === "Ambitious").length;
    
    let cutoffs = list.map(r => r.closing_cutoff !== undefined ? r.closing_cutoff : (r.cutoff_percentile || 0));
    let avg = total > 0 ? cutoffs.reduce((a,b)=>a+b,0)/total : 0;
    let high = total > 0 ? Math.max(...cutoffs) : 0;
    let low = total > 0 ? Math.min(...cutoffs) : 0;

    return {
        colleges_found: total,
        government: govt,
        private: priv,
        autonomous: auto,
        university_depts: univ,
        safe_option: safe,
        moderate: mod,
        dream: dream,
        avg_cutoff: avg,
        highest_cutoff: high,
        lowest_cutoff: low
    };
}

// PREDICT FORM SUBMIT
predictorForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!studentNameInput || !studentNameInput.value.trim()) {
        showToast("Please enter Student Full Name.");
        if (studentNameInput) studentNameInput.focus();
        return;
    }
    if (!percentileNum.value || isNaN(parseFloat(percentileNum.value))) {
        showToast("Please enter your MHT-CET PCM Percentile.");
        percentileNum.focus();
        return;
    }
    if (!categorySelect.value) {
        showToast("Please select your Category.");
        categorySelect.focus();
        return;
    }
    if (!genderSelect.value) {
        showToast("Please select your Gender.");
        genderSelect.focus();
        return;
    }
    if (!homeUniversitySelect.value) {
        showToast("Please select your Home University.");
        homeUniversitySelect.focus();
        return;
    }

    resultsPlaceholder.style.display = "none";
    resultsList.style.display = "none";
    resultsLoader.style.display = "flex";
    btnExportCsv.disabled = true;
    btnExportXlsx.disabled = true;
    if (btnCopyAllCodes) btnCopyAllCodes.disabled = true;
    if (btnPrintForm) btnPrintForm.disabled = true;

    const payload = {
        student_name: studentNameInput ? studentNameInput.value.trim() : "",
        percentile: parseFloat(percentileNum.value),
        category: categorySelect.value,
        gender: genderSelect.value,
        home_university: homeUniversitySelect.value,
        exam_type: percentileTypeSelect ? percentileTypeSelect.value : "MHT-CET",
        cap_round: capRoundSelect.value,
        preferred_cities: activeCitiesOrder,
        preferred_branches: activeBranchesOrder,
        is_pwd: isPwdCheckbox.checked,
        is_defense: isDefenseCheckbox.checked,
        sort_by: selectedSortBy
    };

    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("API Predict Error");
        const resData = await res.json();

        if (Array.isArray(resData)) {
            allResultsData = resData;
            currentMetrics = calculateMetricsFromList(resData);
        } else if (resData && resData.results) {
            allResultsData = resData.results;
            currentMetrics = resData.metrics || calculateMetricsFromList(resData.results);
        } else {
            allResultsData = [];
            currentMetrics = {};
        }

        resultsLoader.style.display = "none";

        if (allResultsData.length === 0) {
            if (resultsContainer) resultsContainer.style.display = "none";
            resultsPlaceholder.style.display = "flex";
            resultsPlaceholder.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ef4444; margin-bottom:1rem;"></i>
                <h3>No Option Choices Found</h3>
                <p>Try widening your PCM percentile range or checking more preferred cities/branches.</p>
            `;
            return;
        }

        currentPage = 1;
        updateMetricsUI();
        renderResultsView();
        btnExportCsv.disabled = false;
        btnExportXlsx.disabled = false;
        if (btnCopyAllCodes) btnCopyAllCodes.disabled = false;
        if (btnPrintForm) btnPrintForm.disabled = false;

        // On mobile devices, automatically close input drawer and scroll down to results
        if (window.closeMobileSidebar && window.innerWidth <= 1024) {
            window.closeMobileSidebar();
            const contentPanel = document.querySelector(".content-panel");
            if (contentPanel) {
                setTimeout(() => {
                    contentPanel.scrollIntoView({ behavior: "smooth" });
                }, 150);
            }
        }

    } catch (err) {
        console.error(err);
        resultsLoader.style.display = "none";
        if (resultsContainer) resultsContainer.style.display = "none";
        resultsPlaceholder.style.display = "flex";
        resultsPlaceholder.innerHTML = `
            <i class="fa-solid fa-circle-xmark" style="font-size:3rem; color:#ef4444; margin-bottom:1rem;"></i>
            <h3>Backend Server Error</h3>
            <p>Make sure FastAPI server is running on port 8000.</p>
        `;
    }
});

function updateMetricsUI() {
    const foundCount = currentMetrics.colleges_found || 0;
    document.getElementById("m-found").textContent = foundCount;
    const mobBadge = document.getElementById("mobile-results-badge");
    if (mobBadge) mobBadge.textContent = foundCount;

    document.getElementById("m-govt").textContent = currentMetrics.government || 0;
    document.getElementById("m-private").textContent = currentMetrics.private || 0;
    document.getElementById("m-auto").textContent = currentMetrics.autonomous || 0;
    document.getElementById("m-univ").textContent = currentMetrics.university_depts || 0;
    document.getElementById("m-safe").textContent = currentMetrics.safe_option || 0;
    document.getElementById("m-mod").textContent = currentMetrics.moderate || 0;
    document.getElementById("m-dream").textContent = currentMetrics.dream || 0;
    document.getElementById("m-avg").textContent = (currentMetrics.avg_cutoff || 0).toFixed(2) + "%";
    document.getElementById("m-high").textContent = (currentMetrics.highest_cutoff || 0).toFixed(2) + "%";
    document.getElementById("m-low").textContent = (currentMetrics.lowest_cutoff || 0).toFixed(2) + "%";

    setupMetricCardClickListeners();
}

function setupMetricCardClickListeners() {
    const grid = document.getElementById("metrics-grid");
    if (!grid) return;
    const cards = grid.querySelectorAll(".metric-card");
    cards.forEach(card => {
        if (card.dataset.hasListener) return;
        card.dataset.hasListener = "true";
        card.style.cursor = "pointer";

        card.addEventListener("click", () => {
            const labelEl = card.querySelector(".m-label");
            if (!labelEl) return;
            const text = labelEl.textContent.trim().toUpperCase();

            let filterKey = null;
            if (text.includes("SAFE")) filterKey = "safe";
            else if (text.includes("MODERATE")) filterKey = "moderate";
            else if (text.includes("DREAM")) filterKey = "dream";
            else if (text.includes("AUTONOMOUS")) filterKey = "autonomous";
            else if (text.includes("GOVERNMENT")) filterKey = "govt";
            else if (text.includes("PRIVATE")) filterKey = "private";
            else if (text.includes("UNIVERSITY")) filterKey = "university";
            else if (text.includes("COLLEGES FOUND")) filterKey = null;

            if (currentMetricFilter === filterKey) {
                currentMetricFilter = null;
            } else {
                currentMetricFilter = filterKey;
            }

            cards.forEach(c => c.classList.remove("active-stat-filter"));
            if (currentMetricFilter) {
                card.classList.add("active-stat-filter");
            }

            currentPage = 1;
            renderResultsView();
        });
    });
}

// Global View Switching & Rendering (Table View vs Cards View [Default])
function renderResultsView() {
    if (!resultsContainer) return;
    resultsPlaceholder.style.display = "none";
    resultsContainer.style.display = "flex";

    const query = resultSearch ? resultSearch.value.toLowerCase().trim() : "";
    pageSize = parseInt(perPageSelect ? perPageSelect.value : 50) || 50;

    let filtered = allResultsData.filter(item => {
        // Quick Stat Card Filter (Dream, Moderate, Safe, Autonomous, Govt, Private, University)
        if (currentMetricFilter) {
            if (currentMetricFilter === "safe" && item.status !== "Safe") return false;
            if (currentMetricFilter === "moderate" && item.status !== "Moderate") return false;
            if (currentMetricFilter === "dream" && item.status !== "Dream" && item.status !== "Ambitious") return false;
            if (currentMetricFilter === "autonomous" && item.autonomy !== "Autonomous") return false;
            if (currentMetricFilter === "govt" && item.institute_type !== "Government") return false;
            if (currentMetricFilter === "private" && item.institute_type !== "PRIVATE") return false;
            if (currentMetricFilter === "university" && !((item.university || '').toLowerCase().includes("university") || (item.university || '').toLowerCase().includes("department"))) return false;
        }

        if (!query) return true;
        const name = (item.college_name || '').toLowerCase();
        const code = formatIntCode(item.college_code);
        const branch = (item.branch_name || '').toLowerCase();
        const city = (item.city || '').toLowerCase();
        const bcode = formatIntCode(item.branch_code || item.choice_code);
        return name.includes(query) || code.includes(query) || branch.includes(query) || city.includes(query) || bcode.includes(query);
    });

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    const displayList = filtered.slice(startIndex, endIndex);

    // Update Pagination Info
    if (paginationInfo) {
        let filterNotice = currentMetricFilter ? ` [Filtered: ${currentMetricFilter.toUpperCase()}]` : '';
        paginationInfo.textContent = totalCount > 0 
            ? `Showing ${startIndex + 1}-${endIndex} of ${totalCount} colleges${filterNotice}`
            : `No colleges found for filter${filterNotice}`;
    }

    renderPaginationControls(totalPages);

    if (activeViewMode === "table") {
        if (tableViewWrap) tableViewWrap.style.display = "block";
        if (resultsList) resultsList.style.display = "none";
        renderTableView(displayList, startIndex);
    } else {
        if (tableViewWrap) tableViewWrap.style.display = "none";
        if (resultsList) resultsList.style.display = "flex";
        renderCardsView(displayList, startIndex);
    }
}

// Move College to specific preference position by typing preference number
function moveCollegePreference(col, newRankVal) {
    const oldIndex = allResultsData.indexOf(col);
    if (oldIndex === -1) return;
    const oldRank = oldIndex + 1;
    let targetRank = parseInt(newRankVal, 10);
    if (isNaN(targetRank) || targetRank === oldRank) return;

    if (targetRank < 1) targetRank = 1;
    if (targetRank > allResultsData.length) targetRank = allResultsData.length;

    const [movedItem] = allResultsData.splice(oldIndex, 1);
    allResultsData.splice(targetRank - 1, 0, movedItem);

    // Switch page to show the target position
    currentPage = Math.ceil(targetRank / pageSize);

    renderResultsView();
    showToast(`Moved "${col.college_name}" to Preference #${targetRank}`);
}

// Render Table View Matching User Screenshot Format:
// Rank | College Name | Branch | Choice Code | Cutoff % | Location | Type | Action
function renderTableView(displayList, startIndex) {
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const userPct = parseFloat(percentileNum ? percentileNum.value : 0) || 0;

    displayList.forEach((col, idx) => {
        const globalRankNum = allResultsData.indexOf(col) + 1;
        const rankNum = globalRankNum > 0 ? globalRankNum : (startIndex + idx + 1);
        const tr = document.createElement("tr");

        const statusStr = col.status || 'Moderate';
        const statusClass = statusStr.toLowerCase();
        const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
        const closingCutoff = closingVal.toFixed(4);

        const collegeCode = formatIntCode(col.college_code);
        const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
        const instType = col.institute_type || "Un-Aided";

        tr.innerHTML = `
            <td class="col-rank">
                <div class="table-pref-input-wrap" title="Type preference number to move college position">
                    <span class="table-pref-lbl">#</span>
                    <input type="number" class="table-pref-num-input" value="${rankNum}" min="1" max="${allResultsData.length}" data-old-rank="${rankNum}">
                    <div class="pref-btn-group">
                        <button type="button" class="pref-step-btn btn-pref-up" title="Move Up 1 Position" ${rankNum <= 1 ? 'disabled' : ''}><i class="fa-solid fa-caret-up"></i></button>
                        <button type="button" class="pref-step-btn btn-pref-down" title="Move Down 1 Position" ${rankNum >= allResultsData.length ? 'disabled' : ''}><i class="fa-solid fa-caret-down"></i></button>
                    </div>
                </div>
            </td>
            <td class="col-college">
                <a class="table-college-name-link" title="Click to view full college details">
                    ${col.college_name} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </td>
            <td class="col-branch">
                <span class="table-branch-text">${col.branch_name}</span>
            </td>
            <td class="col-code">
                <span class="table-code-badge">
                    <i class="fa-solid fa-barcode"></i> ${branchChoiceCode}
                </span>
            </td>
            <td class="col-cutoff">
                <span class="table-cutoff-pill ${statusClass}">${closingCutoff}%</span>
            </td>
            <td class="col-location">
                <span class="table-location-text">
                    <i class="fa-solid fa-location-dot"></i> ${col.city}
                </span>
            </td>
            <td class="col-type">
                <span class="table-type-badge">${instType}</span>
            </td>
        `;

        // Preference input listeners
        const prefInput = tr.querySelector(".table-pref-num-input");
        const btnUp = tr.querySelector(".btn-pref-up");
        const btnDown = tr.querySelector(".btn-pref-down");

        if (prefInput) {
            prefInput.addEventListener("click", (e) => {
                e.stopPropagation();
                prefInput.select();
            });
            prefInput.addEventListener("change", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, prefInput.value);
            });
            prefInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    prefInput.blur();
                }
            });
        }

        if (btnUp) {
            btnUp.addEventListener("click", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, rankNum - 1);
            });
        }

        if (btnDown) {
            btnDown.addEventListener("click", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, rankNum + 1);
            });
        }

        // Click listeners to open rich College Detail Modal
        const linkEl = tr.querySelector(".table-college-name-link");

        const openModalHandler = (e) => {
            if (e.target.closest(".table-pref-input-wrap")) return;
            e.stopPropagation();
            openCollegeModal(col, rankNum);
        };

        if (linkEl) linkEl.addEventListener("click", openModalHandler);

        // Clicking the whole table row also opens modal details
        tr.style.cursor = "pointer";
        tr.addEventListener("click", openModalHandler);

        tableBody.appendChild(tr);
    });
}

// Render Cards View
function renderCardsView(displayList, startIndex) {
    if (!resultsList) return;
    resultsList.innerHTML = "";
    const userPct = parseFloat(percentileNum ? percentileNum.value : 0) || 0;

    displayList.forEach((col, idx) => {
        const card = document.createElement("div");
        const globalRankNum = allResultsData.indexOf(col) + 1;
        const rankNum = globalRankNum > 0 ? globalRankNum : (startIndex + idx + 1);
        const statusStr = col.status || 'Moderate';
        const statusClass = statusStr.toLowerCase();
        card.className = `pref-card status-${statusClass}`;

        const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
        const openingVal = col.opening_cutoff !== undefined ? col.opening_cutoff : (closingVal + 1.85);

        const closingCutoff = closingVal.toFixed(4);
        const openingCutoff = openingVal.toFixed(4);
        const studentPct = userPct.toFixed(4);

        const pctVal = Math.min(100, Math.max(0, closingVal));
        const collegeCode = formatIntCode(col.college_code);
        const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
        
        const instType = col.institute_type || "Un-Aided";
        const autonomy = col.autonomy || "Non-Autonomous";
        const university = col.university || col.home_university || "University";
        const cutoffRank = col.cutoff_rank || col.Closing_Rank;
        const pdfPage = col.pdf_page_number || col.PDF_Page_Number;

        card.innerHTML = `
            <div class="card-header-bar">
                <div class="card-header-left">
                    <div class="pref-input-badge-wrap" title="Type preference number to move college position">
                        <span class="pref-badge-lbl">Pref #</span>
                        <input type="number" class="pref-badge-input" value="${rankNum}" min="1" max="${allResultsData.length}" data-old-rank="${rankNum}">
                        <div class="pref-btn-group">
                            <button type="button" class="pref-step-btn btn-pref-up" title="Move Up 1 Position" ${rankNum <= 1 ? 'disabled' : ''}><i class="fa-solid fa-caret-up"></i></button>
                            <button type="button" class="pref-step-btn btn-pref-down" title="Move Down 1 Position" ${rankNum >= allResultsData.length ? 'disabled' : ''}><i class="fa-solid fa-caret-down"></i></button>
                        </div>
                    </div>
                    <div class="college-title-block">
                        <h3 class="college-name table-college-name-link">${col.college_name}</h3>
                        <div class="college-sub-info">
                            <span>Code: <strong>${collegeCode}</strong></span>
                            <span class="city-location-tag"><i class="fa-solid fa-location-dot"></i> ${col.city}</span>
                        </div>
                    </div>
                </div>
                <div class="card-header-right">
                    <span class="chance-tag ${statusClass}">${statusStr.toUpperCase()}</span>
                </div>
            </div>

            <div class="branch-info-line">
                <i class="fa-solid fa-diagram-project cyan-icon"></i>
                <span class="branch-title">${col.branch_name}</span>
                <span class="choice-code-badge">
                    <i class="fa-solid fa-barcode"></i> Branch Code: <strong class="choice-code-num">${branchChoiceCode}</strong>
                    <button type="button" class="btn-copy-code" title="Copy Branch Code"><i class="fa-regular fa-copy"></i> Copy Code</button>
                </span>
            </div>

            <div class="cutoff-progress-section">
                <div class="cutoff-values-row">
                    <span class="cutoff-val-pill">Closing Cutoff: <strong>${closingCutoff}%</strong></span>
                    <span class="cutoff-val-pill">Opening Cutoff: <strong>${openingCutoff}%</strong></span>
                    <span class="cutoff-val-pill student-score-pill">Your Percentile: <strong>${studentPct}%</strong></span>
                </div>
                <div class="progress-track-wrapper">
                    <div class="progress-track">
                        <div class="progress-fill ${statusClass}" style="width: ${pctVal}%"></div>
                        <div class="progress-marker marker-opening" style="left: ${Math.min(100, Math.max(0, openingVal))}%" title="Opening Cutoff: ${openingCutoff}%"></div>
                        <div class="progress-pin pin-your-score" style="left: ${Math.min(100, Math.max(0, userPct))}%" title="Your Percentile: ${studentPct}%">
                            <span class="pin-head"></span>
                            <span class="pin-tooltip">You (${studentPct}%)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-footer-meta">
                <div class="meta-col">
                    <span class="meta-title">CATEGORY</span>
                    <span class="meta-val">${col.seat_category || 'OPEN'}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">CAP ROUND</span>
                    <span class="meta-val">${col.cap_round || 'CAP Round 1'}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">RANK CUTOFF</span>
                    <span class="meta-val">${cutoffRank ? Number(cutoffRank).toLocaleString() : 'N/A'}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">INSTITUTE TYPE</span>
                    <span class="meta-val">${instType}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">AUTONOMY</span>
                    <span class="meta-val">${autonomy}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">UNIVERSITY</span>
                    <span class="meta-val">${university}</span>
                </div>
                <div class="meta-col">
                    <span class="meta-title">OFFICIAL PDF PAGE</span>
                    <span class="meta-val">${pdfPage ? 'Page ' + pdfPage : 'N/A'}</span>
                </div>
            </div>
        `;

        // Preference input listeners
        const prefInput = card.querySelector(".pref-badge-input");
        const btnUp = card.querySelector(".btn-pref-up");
        const btnDown = card.querySelector(".btn-pref-down");

        if (prefInput) {
            prefInput.addEventListener("click", (e) => {
                e.stopPropagation();
                prefInput.select();
            });
            prefInput.addEventListener("change", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, prefInput.value);
            });
            prefInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    prefInput.blur();
                }
            });
        }

        if (btnUp) {
            btnUp.addEventListener("click", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, rankNum - 1);
            });
        }

        if (btnDown) {
            btnDown.addEventListener("click", (e) => {
                e.stopPropagation();
                moveCollegePreference(col, rankNum + 1);
            });
        }

        card.querySelector(".college-name").addEventListener("click", (e) => {
            if (e.target.closest(".pref-input-badge-wrap")) return;
            openCollegeModal(col, rankNum);
        });

        const copyBtn = card.querySelector(".btn-copy-code");
        copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(branchChoiceCode);
            showToast(`Branch Choice Code ${branchChoiceCode} copied!`);
            copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            copyBtn.style.background = "#10b981";
            copyBtn.style.borderColor = "#10b981";
            copyBtn.style.color = "#ffffff";
            setTimeout(() => {
                copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy Code`;
                copyBtn.style.background = "";
                copyBtn.style.borderColor = "";
                copyBtn.style.color = "";
            }, 2000);
        });

        resultsList.appendChild(card);
    });
}

// Render Pagination Controls (< 1 2 3 >)
function renderPaginationControls(totalPages) {
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = "";

    pagePrevBtn.disabled = currentPage <= 1;
    pageNextBtn.disabled = currentPage >= totalPages;

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `page-num-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener("click", () => {
            currentPage = i;
            renderResultsView();
            if (resultsContainer) {
                resultsContainer.scrollIntoView({ behavior: "smooth" });
            }
        });
        pageNumbersContainer.appendChild(btn);
    }
}

// Open Interactive College Details Modal
function openCollegeModal(col, rankNum) {
    if (!collegeModalOverlay) return;

    const collegeCode = formatIntCode(col.college_code);
    const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
    const statusStr = col.status || 'Moderate';
    const statusClass = statusStr.toLowerCase();

    const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
    const openingVal = col.opening_cutoff !== undefined ? col.opening_cutoff : (closingVal + 1.85);

    const userPct = parseFloat(percentileNum ? percentileNum.value : 0) || 0;
    const closingCutoff = closingVal.toFixed(4);
    const openingCutoff = openingVal.toFixed(4);
    const studentPct = userPct.toFixed(4);

    const instType = col.institute_type || "Un-Aided";
    const autonomy = col.autonomy || "Non-Autonomous";
    const university = col.university || col.home_university || "University";
    const cutoffRank = col.cutoff_rank || col.Closing_Rank;
    const pdfPage = col.pdf_page_number || col.PDF_Page_Number;

    // Populate Modal Content
    document.getElementById("modal-rank-badge").textContent = `Rank #${rankNum}`;
    document.getElementById("modal-college-name").textContent = col.college_name;
    document.getElementById("modal-college-code").textContent = collegeCode;
    document.getElementById("modal-city").textContent = col.city;

    document.getElementById("modal-branch-name").textContent = col.branch_name;
    document.getElementById("modal-choice-code").textContent = branchChoiceCode;

    const chanceTag = document.getElementById("modal-chance-tag");
    chanceTag.textContent = statusStr.toUpperCase();
    chanceTag.className = `chance-tag ${statusClass}`;

    document.getElementById("modal-inst-type").textContent = instType;
    document.getElementById("modal-autonomy").textContent = autonomy;
    document.getElementById("modal-university").textContent = university;
    document.getElementById("modal-rank-cutoff").textContent = cutoffRank ? Number(cutoffRank).toLocaleString() : 'N/A';
    document.getElementById("modal-closing-cutoff").textContent = `${closingCutoff}%`;
    document.getElementById("modal-opening-cutoff").textContent = `${openingCutoff}%`;
    document.getElementById("modal-seat-category").textContent = col.seat_category || 'OPEN';
    document.getElementById("modal-pdf-page").textContent = pdfPage ? `Page ${pdfPage}` : 'N/A';

    // Gauge Bar Sync
    document.getElementById("modal-gauge-closing").textContent = `${closingCutoff}%`;
    document.getElementById("modal-gauge-student").textContent = `${studentPct}%`;
    
    const fillBar = document.getElementById("modal-progress-fill");
    if (fillBar) {
        fillBar.style.width = `${Math.min(100, Math.max(0, closingVal))}%`;
        fillBar.className = `progress-fill ${statusClass}`;
    }

    const pinMarker = document.getElementById("modal-progress-pin");
    if (pinMarker) {
        pinMarker.style.left = `${Math.min(100, Math.max(0, userPct))}%`;
    }

    const pinTooltip = document.getElementById("modal-pin-tooltip");
    if (pinTooltip) {
        pinTooltip.textContent = `You (${studentPct}%)`;
    }

    // Modal Copy Buttons Sync
    const copyHandler = () => {
        navigator.clipboard.writeText(branchChoiceCode);
        showToast(`Choice Code ${branchChoiceCode} copied!`);
    };

    if (modalBtnCopyCode) modalBtnCopyCode.onclick = copyHandler;
    if (modalBtnCopyAlt) modalBtnCopyAlt.onclick = copyHandler;

    // Show Modal
    collegeModalOverlay.style.display = "flex";
}

// Modal Close Listeners
if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
        if (collegeModalOverlay) collegeModalOverlay.style.display = "none";
    });
}
if (modalBtnClose) {
    modalBtnClose.addEventListener("click", () => {
        if (collegeModalOverlay) collegeModalOverlay.style.display = "none";
    });
}
if (collegeModalOverlay) {
    collegeModalOverlay.addEventListener("click", (e) => {
        if (e.target === collegeModalOverlay) {
            collegeModalOverlay.style.display = "none";
        }
    });
}

// View Mode Toggle Listeners
if (viewBtnTable) {
    viewBtnTable.addEventListener("click", () => {
        activeViewMode = "table";
        viewBtnTable.classList.add("active");
        if (viewBtnCards) viewBtnCards.classList.remove("active");
        renderResultsView();
    });
}

if (viewBtnCards) {
    viewBtnCards.addEventListener("click", () => {
        activeViewMode = "cards";
        viewBtnCards.classList.add("active");
        if (viewBtnTable) viewBtnTable.classList.remove("active");
        renderResultsView();
    });
}

// Pagination Button Listeners
if (pagePrevBtn) {
    pagePrevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderResultsView();
            if (resultsContainer) resultsContainer.scrollIntoView({ behavior: "smooth" });
        }
    });
}

if (pageNextBtn) {
    pageNextBtn.addEventListener("click", () => {
        currentPage++;
        renderResultsView();
        if (resultsContainer) resultsContainer.scrollIntoView({ behavior: "smooth" });
    });
}

if (perPageSelect) {
    perPageSelect.addEventListener("change", () => {
        currentPage = 1;
        renderResultsView();
    });
}

if (resultSearch) {
    resultSearch.addEventListener("input", () => {
        currentPage = 1;
        renderResultsView();
    });
}

let resultsListSortable = null;

function initResultsFeedSortable() {
    if (resultsList && typeof Sortable !== "undefined") {
        if (resultsListSortable) {
            try { resultsListSortable.destroy(); } catch (e) {}
        }
        resultsListSortable = new Sortable(resultsList, {
            animation: 150,
            handle: '.card-drag-handle',
            ghostClass: 'card-sortable-ghost',
            chosenClass: 'card-sortable-chosen',
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
                    const movedItem = allResultsData.splice(oldIndex, 1)[0];
                    allResultsData.splice(newIndex, 0, movedItem);
                    renderResultsFeed();
                }
            }
        });
    }
}

// Copy All Choice Codes
if (btnCopyAllCodes) {
    btnCopyAllCodes.addEventListener("click", () => {
        if (allResultsData.length === 0) return;
        const codesList = allResultsData.map(col => formatIntCode(col.branch_code || col.choice_code || (col.college_code + "000"))).join("\n");
        navigator.clipboard.writeText(codesList);
        showToast(`Copied ${allResultsData.length} Branch Choice Codes in preference sequence!`);
    });
}

// Print Official CAP Option Form
if (btnPrintForm) {
    btnPrintForm.addEventListener("click", () => {
        if (allResultsData.length === 0) return;

        const studentName = studentNameInput ? (studentNameInput.value.trim() || "N/A") : "N/A";
        const candidatePct = percentileNum.value;
        const candidateCat = categorySelect.value || "N/A";
        const candidateGender = genderSelect.value || "N/A";
        const candidateUni = homeUniversitySelect.value || "N/A";
        const capRound = capRoundSelect.value || "CAP Round 1";
        const generatedDate = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const printWin = window.open("", "_blank");
        
        let tableRowsHtml = "";
        allResultsData.forEach((col, idx) => {
            const collegeCode = formatIntCode(col.college_code);
            const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
            const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
            tableRowsHtml += `
                <tr>
                    <td class="text-center pref-num">${idx + 1}</td>
                    <td class="text-center"><span class="choice-code">${branchChoiceCode}</span></td>
                    <td class="text-center font-mono">${collegeCode}</td>
                    <td><span class="college-name">${col.college_name}</span>, <span class="city-tag">${col.city}</span></td>
                    <td class="branch-name">${col.branch_name}</td>
                    <td class="text-center">${col.seat_category || 'OPEN'}</td>
                    <td class="text-center">${col.institute_type || 'Un-Aided'}<br><small style="color:#64748b;">(${col.autonomy || 'Non-Auto'})</small></td>
                    <td class="text-center cutoff-val">${closingVal.toFixed(4)}%</td>
                </tr>
            `;
        });

        const printHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>MHT-CET CAP Option Form - ${studentName}</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 12mm 12mm 18mm 12mm;
                    }

                    * { box-sizing: border-box; }
                    
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        background: #ffffff;
                        color: #0f172a;
                        margin: 0;
                        padding: 0;
                        font-size: 8.5pt;
                        line-height: 1.4;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .report-wrapper {
                        padding: 10px;
                    }

                    /* Header */
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2.5px solid #4f46e5;
                        padding-bottom: 12px;
                        margin-bottom: 14px;
                    }

                    .header-left {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }

                    .brand-logo {
                        width: 44px;
                        height: 44px;
                        background: linear-gradient(135deg, #1e1b4b, #4f46e5);
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                    }

                    .title-block h1 {
                        margin: 0;
                        font-size: 11.5pt;
                        font-weight: 800;
                        color: #1e1b4b;
                        text-transform: uppercase;
                        letter-spacing: -0.01em;
                    }

                    .title-block h2 {
                        margin: 2px 0 0 0;
                        font-size: 8.5pt;
                        font-weight: 700;
                        color: #4f46e5;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }

                    .header-badges {
                        text-align: right;
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                    }

                    .badge-cap {
                        background: #4f46e5;
                        color: #ffffff;
                        font-size: 7.5pt;
                        font-weight: 800;
                        padding: 3px 8px;
                        border-radius: 4px;
                        text-transform: uppercase;
                    }

                    .badge-ay {
                        background: #f1f5f9;
                        color: #475569;
                        font-size: 7.5pt;
                        font-weight: 700;
                        padding: 2px 6px;
                        border-radius: 4px;
                        border: 1px solid #cbd5e1;
                    }

                    /* Student Profile Card */
                    .student-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 10px 14px;
                        margin-bottom: 14px;
                    }

                    .card-heading {
                        font-size: 8pt;
                        font-weight: 800;
                        color: #4f46e5;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 8px;
                        border-bottom: 1px dashed #cbd5e1;
                        padding-bottom: 4px;
                    }

                    .student-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 8px 12px;
                    }

                    .info-cell {
                        display: flex;
                        flex-direction: column;
                    }

                    .info-cell .lbl {
                        font-size: 6.8pt;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                    }

                    .info-cell .val {
                        font-size: 8.5pt;
                        font-weight: 700;
                        color: #0f172a;
                    }

                    .info-cell .val.highlight-name {
                        color: #1e1b4b;
                        font-size: 9.5pt;
                    }

                    .info-cell .val.highlight-pct {
                        color: #4f46e5;
                        font-size: 9.5pt;
                    }

                    /* Table */
                    .table-section-title {
                        font-size: 8.5pt;
                        font-weight: 800;
                        color: #0f172a;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .table-count-badge {
                        background: #e0e7ff;
                        color: #3730a3;
                        font-size: 7.5pt;
                        font-weight: 700;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 8pt;
                        margin-bottom: 35px;
                    }

                    thead {
                        display: table-header-group;
                    }

                    tr {
                        page-break-inside: avoid;
                    }

                    th {
                        background: #1e1b4b;
                        color: #ffffff;
                        font-weight: 700;
                        font-size: 7.2pt;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                        padding: 7px 6px;
                        border: 1px solid #1e1b4b;
                        text-align: left;
                    }

                    td {
                        padding: 6px;
                        border: 1px solid #cbd5e1;
                        color: #334155;
                        vertical-align: middle;
                    }

                    tbody tr:nth-child(even) {
                        background-color: #f8fafc;
                    }

                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    
                    .pref-num {
                        font-weight: 800;
                        color: #4f46e5;
                        font-size: 8.5pt;
                    }

                    .choice-code {
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: 800;
                        font-size: 8.5pt;
                        color: #0f172a;
                        background: #f1f5f9;
                        padding: 2px 5px;
                        border-radius: 4px;
                        border: 1px solid #e2e8f0;
                    }

                    .font-mono {
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: 700;
                    }

                    .college-name {
                        font-weight: 700;
                        color: #0f172a;
                    }

                    .city-tag {
                        color: #64748b;
                    }

                    .branch-name {
                        font-weight: 600;
                        color: #1e293b;
                    }

                    .cutoff-val {
                        font-weight: 800;
                        color: #047857;
                    }

                    /* Footer on every page */
                    .footer-bar {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: #ffffff;
                        border-top: 1.5px solid #cbd5e1;
                        padding: 6px 10px 4px 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 7.5pt;
                        color: #475569;
                    }

                    .footer-left {
                        font-weight: 500;
                    }

                    .footer-left strong {
                        color: #4f46e5;
                        font-weight: 700;
                    }

                    .footer-right a {
                        color: #4f46e5;
                        text-decoration: underline;
                        font-weight: 700;
                        cursor: pointer;
                    }

                    .footer-right a:hover {
                        color: #3730a3;
                    }

                    .watermark-overlay {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-35deg);
                        font-size: 22pt;
                        font-weight: 800;
                        color: rgba(79, 70, 229, 0.06);
                        white-space: nowrap;
                        pointer-events: none;
                        z-index: 9999;
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        user-select: none;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    @media print {
                        body { padding: 0; }
                        .watermark-overlay {
                            display: block;
                            position: fixed;
                            top: 48%;
                            left: 50%;
                        }
                        .footer-bar {
                            position: fixed;
                            bottom: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="watermark-overlay">aimlrahulcounselling</div>
                <div class="report-wrapper">
                    <!-- Header -->
                    <div class="report-header">
                        <div class="header-left">
                            <div class="brand-logo">
                                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                                    <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
                                </svg>
                            </div>
                            <div class="title-block">
                                <h1>State Common Entrance Test Cell, Maharashtra State</h1>
                                <h2>Official MHT-CET CAP Option Form Preference Report</h2>
                            </div>
                        </div>
                        <div class="header-badges">
                            <span class="badge-cap">${capRound}</span>
                            <span class="badge-ay">Academic Year 2026-27</span>
                        </div>
                    </div>

                    <!-- Student Details -->
                    <div class="student-card">
                        <div class="card-heading">Candidate Profile & Admission Details</div>
                        <div class="student-grid">
                            <div class="info-cell">
                                <span class="lbl">Student Full Name</span>
                                <span class="val highlight-name">${studentName}</span>
                            </div>
                            <div class="info-cell">
                                <span class="lbl">MHT-CET PCM Percentile</span>
                                <span class="val highlight-pct">${candidatePct}%</span>
                            </div>
                            <div class="info-cell">
                                <span class="lbl">Category</span>
                                <span class="val">${candidateCat}</span>
                            </div>
                            <div class="info-cell">
                                <span class="lbl">Gender</span>
                                <span class="val">${candidateGender}</span>
                            </div>
                            <div class="info-cell">
                                <span class="lbl">CAP Round</span>
                                <span class="val">${capRound}</span>
                            </div>
                            <div class="info-cell" style="grid-column: span 2;">
                                <span class="lbl">Home University</span>
                                <span class="val">${candidateUni}</span>
                            </div>
                            <div class="info-cell">
                                <span class="lbl">Report Generated Date</span>
                                <span class="val">${generatedDate}</span>
                            </div>
                        </div>
                    </div>

                    <!-- College List Table Header -->
                    <div class="table-section-title">
                        <span>CAP Option Form Preference Sequence</span>
                        <span class="table-count-badge">Total Preference Choices: ${allResultsData.length}</span>
                    </div>

                    <!-- Table -->
                    <table>
                        <thead>
                            <tr>
                                <th class="text-center">Pref #</th>
                                <th class="text-center">Branch Choice Code (9 Digits)</th>
                                <th class="text-center">College Code</th>
                                <th>College Name & Location</th>
                                <th>Course / Branch Name</th>
                                <th class="text-center">Seat Category</th>
                                <th class="text-center">Institute Type & Autonomy</th>
                                <th class="text-center">Cutoff %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Footer on Every Page -->
                <div class="footer-bar">
                    <div class="footer-left">
                        Generated using <strong>Rahul Girase's AI MHT-CET College Predictor & CAP Counselling Platform</strong>
                    </div>
                    <div class="footer-right">
                        Website: <a href="https://aimlrahulcounselling.netlify.app/" target="_blank" rel="noopener noreferrer">https://aimlrahulcounselling.netlify.app</a>
                    </div>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWin.document.write(printHtml);
        printWin.document.close();
    });
}

// Mobile Sidebar Drawer Navigation
function setupMobileNav() {
    const sidebarPanel = document.getElementById("sidebar-panel");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const sidebarClose = document.getElementById("mobile-sidebar-close");
    const btnInputs = document.getElementById("mobile-btn-inputs");
    const btnResults = document.getElementById("mobile-btn-results");
    const contentPanel = document.querySelector(".content-panel");

    if (!sidebarPanel || !btnInputs || !btnResults) return;

    function openSidebar() {
        if (window.innerWidth <= 1024) {
            sidebarPanel.classList.add("mobile-open");
            if (sidebarOverlay) sidebarOverlay.classList.add("active");
            if (btnInputs) btnInputs.classList.add("active");
            if (btnResults) btnResults.classList.remove("active");
        }
    }

    function closeSidebar() {
        if (sidebarPanel) sidebarPanel.classList.remove("mobile-open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("active");
        if (btnInputs) btnInputs.classList.remove("active");
        if (btnResults) btnResults.classList.add("active");
    }

    window.openMobileSidebar = openSidebar;
    window.closeMobileSidebar = closeSidebar;

    // Automatically open Student Inputs ONLY on Mobile viewports
    if (window.innerWidth <= 1024) {
        setTimeout(() => {
            openSidebar();
        }, 100);
    } else {
        closeSidebar();
    }
}

// Arrange Priority Tabs & Drag-to-Sort Logic
function getSortPriorityOrder() {
    const container = document.getElementById("sort-priority-list");
    if (!container) return ["cutoff", "city", "branch"];
    const tabs = container.querySelectorAll(".sort-tab");
    const order = [];
    tabs.forEach(t => {
        if (t.dataset.sort) order.push(t.dataset.sort);
    });
    return order.length ? order : ["cutoff", "city", "branch"];
}

function applyPrioritySortOrder(shouldSubmitIfEmpty = true) {
    const container = document.getElementById("sort-priority-list");
    if (!container) return;
    const tabs = container.querySelectorAll(".sort-tab");
    tabs.forEach((tab, index) => {
        if (index === 0) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    const order = getSortPriorityOrder();
    selectedSortBy = order.join(",");

    if (allResultsData && allResultsData.length > 0) {
        sortResultsData(order);
        renderResultsView();
    }
}

function sortResultsData(orderArray) {
    if (!allResultsData || allResultsData.length === 0) return;
    const cityPriority = {};
    activeCitiesOrder.forEach((c, idx) => { cityPriority[c] = idx; });

    function getCityIdx(item) {
        return cityPriority[item.city] !== undefined ? cityPriority[item.city] : 999;
    }

    function getBranchIdx(item) {
        const bName = (item.branch_name || '').toLowerCase();
        for (let i = 0; i < activeBranchesOrder.length; i++) {
            if (bName.includes(activeBranchesOrder[i].toLowerCase())) return i;
        }
        return 999;
    }

    allResultsData.sort((a, b) => {
        for (const criteria of orderArray) {
            if (criteria === "cutoff") {
                const valA = a.closing_cutoff !== undefined ? a.closing_cutoff : (a.cutoff_percentile || 0);
                const valB = b.closing_cutoff !== undefined ? b.closing_cutoff : (b.cutoff_percentile || 0);
                if (valB !== valA) return valB - valA;
            } else if (criteria === "city") {
                const idxA = getCityIdx(a);
                const idxB = getCityIdx(b);
                if (idxA !== idxB) return idxA - idxB;
            } else if (criteria === "branch") {
                const idxA = getBranchIdx(a);
                const idxB = getBranchIdx(b);
                if (idxA !== idxB) return idxA - idxB;
            }
        }
        return 0;
    });
}

function bindSortTabEvents() {
    const container = document.getElementById("sort-priority-list");
    if (!container) return;
    container.querySelectorAll(".sort-tab").forEach(tab => {
        tab.onclick = () => {
            container.insertBefore(tab, container.firstChild);
            applyPrioritySortOrder(true);
        };
    });
}

function initPrioritySort() {
    const container = document.getElementById("sort-priority-list");
    if (container && typeof Sortable !== "undefined") {
        new Sortable(container, {
            animation: 150,
            ghostClass: "sortable-ghost",
            chosenClass: "sortable-chosen",
            onEnd: () => {
                applyPrioritySortOrder(false);
            }
        });
    }

    if (resultsList && typeof Sortable !== "undefined") {
        new Sortable(resultsList, {
            animation: 150,
            handle: '.pref-badge-wrap',
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
                    const movedItem = allResultsData.splice(oldIndex, 1)[0];
                    allResultsData.splice(newIndex, 0, movedItem);
                    renderResultsView();
                }
            }
        });
    }

    bindSortTabEvents();
}

const btnResetSort = document.getElementById("btn-reset-sort");
if (btnResetSort) {
    btnResetSort.addEventListener("click", () => {
        const container = document.getElementById("sort-priority-list");
        if (container) {
            container.innerHTML = `
                <button type="button" class="sort-tab active" data-sort="cutoff"><i class="fa-solid fa-grip-vertical chip-drag-handle"></i> % Cutoff %</button>
                <button type="button" class="sort-tab" data-sort="city"><i class="fa-solid fa-grip-vertical chip-drag-handle"></i> <i class="fa-solid fa-location-dot"></i> City Priority</button>
                <button type="button" class="sort-tab" data-sort="branch"><i class="fa-solid fa-grip-vertical chip-drag-handle"></i> <i class="fa-solid fa-diagram-project"></i> Branch Priority</button>
            `;
            bindSortTabEvents();
            applyPrioritySortOrder(true);
        }
    });
}

// CSV Export (Powered by SheetJS XLSX library)
btnExportCsv.addEventListener("click", () => {
    if (allResultsData.length === 0 || typeof XLSX === "undefined") return;

    const dataForCsv = allResultsData.map((col, idx) => {
        const collegeCode = formatIntCode(col.college_code);
        const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
        const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
        const openingVal = col.opening_cutoff !== undefined ? col.opening_cutoff : (closingVal + 1.85);
        return {
            "Preference No": idx + 1,
            "Branch Choice Code (9 Digits)": branchChoiceCode,
            "College Code": collegeCode,
            "College Name": col.college_name || '',
            "City": col.city || '',
            "Branch Name": col.branch_name || '',
            "Seat Category": col.seat_category || 'OPEN',
            "Institute Type": col.institute_type || 'Un-Aided',
            "Autonomy": col.autonomy || 'Non-Autonomous',
            "University": col.university || col.home_university || '',
            "Opening Cutoff %": openingVal.toFixed(4),
            "Closing Cutoff %": closingVal.toFixed(4),
            "Closing Rank": col.cutoff_rank || col.Closing_Rank || "N/A",
            "Admission Chance": col.status || 'Moderate'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForCsv);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "Official_CAP_Option_Form_Preference_Sequence.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// XLSX Export (Integer Format for Choice Code & College Code)
btnExportXlsx.addEventListener("click", () => {
    if (allResultsData.length === 0 || typeof XLSX === "undefined") return;

    const dataForExcel = allResultsData.map((col, idx) => {
        const collegeCode = formatIntCode(col.college_code);
        const branchChoiceCode = formatIntCode(col.branch_code || col.choice_code || (collegeCode + "000"));
        const closingVal = col.closing_cutoff !== undefined ? col.closing_cutoff : (col.cutoff_percentile || 0);
        const openingVal = col.opening_cutoff !== undefined ? col.opening_cutoff : (closingVal + 1.85);
        return {
            "Preference No": idx + 1,
            "Branch Choice Code (9 Digits)": branchChoiceCode,
            "College Code": collegeCode,
            "College Name": col.college_name,
            "City": col.city,
            "Branch Name": col.branch_name,
            "Seat Category": col.seat_category || 'OPEN',
            "Institute Type": col.institute_type || 'Un-Aided',
            "Autonomy": col.autonomy || 'Non-Autonomous',
            "University": col.university || col.home_university,
            "Opening Cutoff %": openingVal.toFixed(4),
            "Closing Cutoff %": closingVal.toFixed(4),
            "Closing Rank": col.cutoff_rank || col.Closing_Rank || "N/A",
            "Admission Chance": col.status || 'Moderate'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CAP Preference List");
    XLSX.writeFile(workbook, "Official_CAP_Option_Form_Preference_Sequence.xlsx");
});

function setupMobileNav() {
    const btnInputs = document.getElementById("mobile-btn-inputs");
    const btnResults = document.getElementById("mobile-btn-results");
    const sidebarPanel = document.getElementById("sidebar-panel");
    const sidebarOverlay = document.getElementById("sidebar-overlay");
    const sidebarClose = document.getElementById("mobile-sidebar-close");
    const contentPanel = document.querySelector(".content-panel");

    if (!btnInputs || !sidebarPanel) return;

    function openSidebar() {
        sidebarPanel.classList.add("mobile-open");
        if (sidebarOverlay) sidebarOverlay.classList.add("active");
        if (btnInputs) btnInputs.classList.add("active");
        if (btnResults) btnResults.classList.remove("active");
    }

    function closeSidebar() {
        sidebarPanel.classList.remove("mobile-open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("active");
        if (btnInputs) btnInputs.classList.remove("active");
        if (btnResults) btnResults.classList.add("active");
    }

    window.openMobileSidebar = openSidebar;
    window.closeMobileSidebar = closeSidebar;

    // Automatically open Student Inputs on Mobile/Android initial load
    if (window.innerWidth <= 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => {
            openSidebar();
        }, 100);
    }

    btnInputs.addEventListener("click", () => {
        if (sidebarPanel.classList.contains("mobile-open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    btnResults.addEventListener("click", () => {
        closeSidebar();
        if (contentPanel) {
            contentPanel.scrollIntoView({ behavior: 'smooth' });
        }
    });

    if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
}

function setupCursorGlow() {
    const glow = document.getElementById("cursor-glow");
    if (!glow) return;

    let mouseX = -500;
    let mouseY = -500;
    let currentX = -500;
    let currentY = -500;
    let animFrame = null;

    function renderGlow() {
        currentX += (mouseX - currentX) * 0.12;
        currentY += (mouseY - currentY) * 0.12;

        glow.style.left = `${currentX}px`;
        glow.style.top = `${currentY}px`;

        if (Math.abs(mouseX - currentX) > 0.1 || Math.abs(mouseY - currentY) > 0.1) {
            animFrame = requestAnimationFrame(renderGlow);
        } else {
            animFrame = null;
        }
    }

    function updatePointer(x, y) {
        mouseX = x;
        mouseY = y;
        glow.style.opacity = "1";
        if (!animFrame) {
            animFrame = requestAnimationFrame(renderGlow);
        }
    }

    window.addEventListener("mousemove", (e) => {
        updatePointer(e.clientX, e.clientY);
    });

    window.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches[0]) {
            updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches[0]) {
            updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    document.addEventListener("mouseleave", () => {
        glow.style.opacity = "0";
    });

    window.addEventListener("touchend", () => {
        glow.style.opacity = "0";
    });
}

function initAntigravityCanvas() {
    const canvas = document.getElementById("antigravity-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let particleCount = 70;
    let connectDistance = 115;
    let mouseRepelDistance = 175;

    const mouse = {
        x: -1000,
        y: -1000,
        targetX: -1000,
        targetY: -1000,
        active: false
    };

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Adaptive scaling based on device size
        if (width <= 640) {
            particleCount = 35;
            connectDistance = 85;
            mouseRepelDistance = 125;
        } else if (width <= 1024) {
            particleCount = 50;
            connectDistance = 100;
            mouseRepelDistance = 150;
        } else {
            particleCount = 75;
            connectDistance = 120;
            mouseRepelDistance = 180;
        }
    }

    function createParticles() {
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.7,
                vy: (Math.random() - 0.5) * 0.7,
                radius: Math.random() * 2 + 1.2,
                baseAlpha: Math.random() * 0.4 + 0.25,
                color: i % 3 === 0 ? "109, 106, 248" : (i % 3 === 1 ? "56, 189, 248" : "124, 115, 255")
            });
        }
    }

    function update() {
        mouse.x += (mouse.targetX - mouse.x) * 0.14;
        mouse.y += (mouse.targetY - mouse.y) * 0.14;

        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;

            if (mouse.active) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (dist < mouseRepelDistance && dist > 0) {
                    const force = (mouseRepelDistance - dist) / mouseRepelDistance;
                    const angle = Math.atan2(dy, dx);
                    p.x += Math.cos(angle) * force * 3.8;
                    p.y += Math.sin(angle) * force * 3.8;
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.hypot(dx, dy);

                if (dist < connectDistance) {
                    const alpha = (1 - dist / connectDistance) * 0.2;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(109, 106, 248, ${alpha})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }

        if (mouse.active) {
            for (let p of particles) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (dist < mouseRepelDistance) {
                    const alpha = (1 - dist / mouseRepelDistance) * 0.35;
                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = `rgba(124, 115, 255, ${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }

        for (let p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color}, ${p.baseAlpha})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color}, ${p.baseAlpha * 0.2})`;
            ctx.fill();
        }
    }

    function animate() {
        update();
        draw();
        requestAnimationFrame(animate);
    }

    let resizeTimer;
    function handleResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            createParticles();
        }, 100);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    function handlePointerMove(x, y) {
        mouse.targetX = x;
        mouse.targetY = y;
        mouse.active = true;
    }

    window.addEventListener("mousemove", (e) => {
        handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches[0]) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches[0]) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    document.addEventListener("mouseleave", () => {
        mouse.active = false;
    });

    window.addEventListener("touchend", () => {
        mouse.active = false;
    });

    resize();
    createParticles();
    animate();
}

window.addEventListener("DOMContentLoaded", () => {
    fetchMetadata();
    setupMobileNav();
    setupCursorGlow();
    initAntigravityCanvas();
});
