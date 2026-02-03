// ==================================================
// GLOBAL CACHE
// ==================================================
let cachedData = null;

// ==================================================
// FETCH DATA
// ==================================================
async function fetchImunisasiData() {
    try {
        const response = await fetch('data_imunisasi_terbaru.json');
        if (!response.ok) throw new Error("Gagal mengambil file JSON");

        cachedData = await response.json();

        populatePuskesmasFilter();
        handleFilterChange();
    } catch (error) {
        console.error("Error memuat data:", error);
    }
}

// ==================================================
// FILTER HANDLER (BIAS ≠ UCI)
// ==================================================
function handleFilterChange() {
    if (!cachedData) return;

    const selectedPuskesmas = document.getElementById('puskesmasSelector').value;
    const selectedYear = document.getElementById('yearSelector').value;

    const biasSource = cachedData.program_imunisasi.bias;
    const uciSource  = cachedData.program_imunisasi.uci;

    // -----------------------------
    // FILTER BIAS (TANPA TAHUN)
    // -----------------------------
    const filterBias = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(d =>
            selectedPuskesmas === 'all' || d.Pukesmas === selectedPuskesmas
        );
    };

    let filteredBias = {};
    Object.keys(biasSource).forEach(key => {
        filteredBias[key] = filterBias(biasSource[key]);
    });

    // -----------------------------
    // FILTER UCI (DENGAN TAHUN)
    // -----------------------------
    const filterUci = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(d => {
            const byPuskesmas =
                selectedPuskesmas === 'all' || d.Pukesmas === selectedPuskesmas;

            const byYear =
                selectedYear === 'all' || String(d.tahun) === selectedYear;

            return byPuskesmas && byYear;
        });
    };

    let filteredUci = {
        antigen: filterUci(uciSource.antigen),
        hb0_BCG: filterUci(uciSource.hb0_BCG),
        tt: filterUci(uciSource.tt)
    };

    // ==================================================
    // PROCESS DATA
    // ==================================================
    const totalBIAS = processDataBIAS(filteredBias);
    const hasilUCI  = processDataUCI(filteredUci);

    renderUCItoUI(hasilUCI);

    // ==================================================
    // TOTAL SEMUA (BIAS + UCI)
    // ==================================================
    const totalSudahSemua =
        totalBIAS.total_s +
        hasilUCI.rv.s +
        hasilUCI.rotarix.s +
        hasilUCI.pcv.s +
        hasilUCI.je.s +
        hasilUCI.heksa.s;

    const totalTidakSemua =
        totalBIAS.total_t +
        hasilUCI.rv.t +
        hasilUCI.rotarix.t +
        hasilUCI.pcv.t +
        hasilUCI.je.t +
        hasilUCI.heksa.t;

    updateText('total-semua-s', totalSudahSemua);
    updateText('total-semua-t', totalTidakSemua);
}

// ==================================================
// PROCESS BIAS
// ==================================================
function processDataBIAS(bias) {
    const sum = (arr, key) =>
        (arr || []).reduce((a, b) => a + (Number(b[key]) || 0), 0);

    const sumTidak = (arr) =>
        (arr || []).reduce((a, b) =>
            a +
            (Number(b.tdk_imun_skt) || 0) +
            (Number(b.tdk_blk_agm) || 0) +
            (Number(b.tdk_blk_alsn_ln) || 0),
        0);

    const hasil = {
        campak: {
            s: sum(bias.campak, 'imun_cmk_jml'),
            t: sumTidak(bias.campak)
        },
        dt: {
            s: sum(bias.dt, 'dt_imun_jml'),
            t: sumTidak(bias.dt)
        },
        td: {
            s:
                sum(bias.td, 'td_imun_jml_kls_2') +
                sum(bias.td, 'imun_td_jml_kls_5'),
            t: sumTidak(bias.td)
        },
        hpv: {
            s: sum(bias.hpv, 'imun_hpv_jml'),
            t: sumTidak(bias.hpv)
        }
    };

    Object.keys(hasil).forEach(k =>
        updateCard(k, hasil[k].s, hasil[k].t)
    );

    return {
        total_s:
            hasil.campak.s +
            hasil.dt.s +
            hasil.td.s +
            hasil.hpv.s,
        total_t:
            hasil.campak.t +
            hasil.dt.t +
            hasil.td.t +
            hasil.hpv.t
    };
}

// ==================================================
// PROCESS UCI
// ==================================================
function processDataUCI(uci) {
    const antigen = uci.antigen || [];

    const sum = (key) =>
        antigen.reduce((a, b) => a + (Number(b[key]) || 0), 0);

    const sumTidak = () =>
        antigen.reduce((a, b) =>
            a +
            (Number(b.tdk_imun_skt) || 0) +
            (Number(b.tdk_blk_agm) || 0) +
            (Number(b.tdk_blk_alsn_ln) || 0),
        0);

    return {
        rv: {
            s: sum('rv_1_jml') + sum('rv_2_jml') + sum('rv_3_jml'),
            t: sumTidak()
        },
        rotarix: {
            s: sum('rotarix_1_jml') + sum('rotarix_2_jml'),
            t: sumTidak()
        },
        pcv: {
            s: sum('pcv_1_jml') + sum('pcv_2_jml') + sum('pcv_3_jml'),
            t: sumTidak()
        },
        je: {
            s: sum('je_jml'),
            t: sumTidak()
        },
        heksa: {
            s:
                sum('heksavalen_1_jml') +
                sum('heksavalen_2_jml') +
                sum('heksavalen_3_jml'),
            t: sumTidak()
        }
    };
}

// ==================================================
// RENDER
// ==================================================
function renderUCItoUI(data) {
    Object.keys(data).forEach(k =>
        updateCard(k, data[k].s, data[k].t)
    );
}

// ==================================================
// UI HELPERS
// ==================================================
function updateText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = (Number(value) || 0).toLocaleString('id-ID');
}

function updateCard(prefix, s, t) {
    updateText(`total-${prefix}-s`, s);
    updateText(`total-${prefix}-t`, t);
}

// ==================================================
// DROPDOWN
// ==================================================
function populatePuskesmasFilter() {
    const selector = document.getElementById('puskesmasSelector');
    if (!selector || !cachedData) return;

    const daftar = [
        ...new Set(
            cachedData.program_imunisasi.bias.campak.map(d => d.Pukesmas)
        )
    ];

    daftar.sort().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        selector.appendChild(opt);
    });
}

// ==================================================
document.addEventListener('DOMContentLoaded', fetchImunisasiData);



function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');
}

/* ================= PAGE NAVIGATION ================= */
function changePage(pageId, el) {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });

    const target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
    }

    document.querySelectorAll('.sidebar li').forEach(li => {
        li.classList.remove('active');
    });

    if (el) el.classList.add('active');
}

/* ================= CHART INITIALIZATION ================= */
document.addEventListener("DOMContentLoaded", function () {

    /* ================= SCATTER CHART ================= */
    const scatterEl = document.getElementById('scatterChart');
    if (scatterEl) {
        new Chart(scatterEl, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Puskesmas',
                    data: [
                        { x: 1, y: 20 },
                        { x: 2, y: 35 },
                        { x: 3, y: 50 },
                        { x: 4, y: 65 }
                    ],
                    backgroundColor: 'red'
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    /* ================= DISTRIBUSI USIA ================= */
    const usiaEl = document.getElementById('usiaChart');
    if (usiaEl) {
        new Chart(usiaEl, {
            type: 'doughnut',
            data: {
                labels: ['0-14', '15-24', '25-44', '45-64', '65+'],
                datasets: [{
                    data: [27, 21, 17, 18, 17],
                    backgroundColor: [
                        '#42a5f5',
                        '#66bb6a',
                        '#ffa726',
                        '#ab47bc',
                        '#ef5350'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    /* ================= JENIS KELAMIN ================= */
    const jkEl = document.getElementById('jkChart');
    if (jkEl) {
        new Chart(jkEl, {
            type: 'doughnut',
            data: {
                labels: ['Perempuan', 'Laki-laki'],
                datasets: [{
                    data: [57.8, 42.2],
                    backgroundColor: ['#ec407a', '#42a5f5']
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    /* ================= BAR PUSKESMAS ================= */
    const barEl = document.getElementById('barChart');
    if (barEl) {
        new Chart(barEl, {
            type: 'bar',
            data: {
                labels: ['Cangkringan', 'Berbah', 'Mlati', 'Gamping', 'Tempel'],
                datasets: [{
                    label: 'Jumlah Kasus',
                    data: [138, 174, 500, 239, 211],
                    backgroundColor: '#64b5f6'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    /* ================= TREND KERACUNAN ================= */
    const trendEl = document.getElementById('trendChart');
    if (trendEl) {
        new Chart(trendEl, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu'],
                datasets: [
                    {
                        label: 'MBG',
                        data: [11, 50, 144, 116, 396, 986, 545, 270],
                        backgroundColor: '#42a5f5'
                    },
                    {
                        label: 'Non MBG',
                        data: [0, 170, 189, 116, 111, 157, 39, 42],
                        backgroundColor: '#ef5350'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    /* ================= DISTRIBUSI PUSKESMAS PAGE ================= */
    const faktor = document.getElementById('envFaktorRisikoChart');
    if (faktor) {
        new Chart(faktor, {
            type: 'bar',
            data: {
                labels: ['APD', 'Air', 'Higiene'],
                datasets: [{
                    label: 'Jumlah',
                    data: [120, 80, 60],
                    backgroundColor: '#90caf9'
                }]
            }
        });
    }

    const pelatihan = document.getElementById('envPelatihanChart');
    if (pelatihan) {
        new Chart(pelatihan, {
            type: 'pie',
            data: {
                labels: ['Sudah', 'Belum'],
                datasets: [{
                    data: [70, 30],
                    backgroundColor: ['#66bb6a', '#ef5350']
                }]
            }
        });
    }

    const spesimen = document.getElementById('envSpesimenChart');
    if (spesimen) {
        new Chart(spesimen, {
            type: 'doughnut',
            data: {
                labels: ['Layak', 'Tidak Layak'],
                datasets: [{
                    data: [65, 35],
                    backgroundColor: ['#42a5f5', '#ff7043']
                }]
            }
        });
    }

    const lab = document.getElementById('envLabChart');
    if (lab) {
        new Chart(lab, {
            type: 'bar',
            data: {
                labels: ['E.coli', 'Salmonella', 'Coliform'],
                datasets: [{
                    label: 'Jumlah Sampel',
                    data: [40, 25, 15],
                    backgroundColor: '#ab47bc'
                }]
            }
        });
    }

});
