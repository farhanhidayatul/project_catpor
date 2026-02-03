// ==================================================
// 1. GLOBAL CACHE
// ==================================================
let cachedData = null;

// ==================================================
// 2. DATA FETCH & INITIALIZATION
// ==================================================
async function fetchImunisasiData() {
    try {
        const response = await fetch('data_imunisasi_terbaru.json');
        cachedData = await response.json();
        populatePuskesmasFilter();
        handleFilterChange();
    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

// ==================================================
// 3. FILTER HANDLER (PENJABARAN EKSPLISIT)
// ==================================================
function handleFilterChange() {
    if (!cachedData) return;

    const selectedPuskesmas = document.getElementById('puskesmasSelector').value;
    const biasSource = cachedData.program_imunisasi.bias;

    // Helper Filter Dasar
    const filterArray = (arr) => (arr || []).filter(d => {
        const pusk = d.Pukesmas || d.Puskesmas;
        return selectedPuskesmas === 'all' || pusk === selectedPuskesmas;
    });

    // --- PROSES FILTER SATU PER SATU ---
    let filteredBias = {
        campak: filterArray(biasSource.campak),
        dt:     filterArray(biasSource.dt),
        td:     filterArray(biasSource.td),
        // Jabarkan struktur HPV secara manual sesuai 3 kelas
        hpv: {
            kelas: {
                kelas_5: filterArray(biasSource.hpv?.kelas_5),
                kelas_6: filterArray(biasSource.hpv?.kelas_6),
                kelas_9: filterArray(biasSource.hpv?.kelas_9)
            }
        }
    };

    processDataBIAS(filteredBias);
}

// ==================================================
// 4. PROCESSOR BIAS (PENJABARAN FORMULA HPV)
// ==================================================
function processDataBIAS(bias) {
    
    // --- 1. HITUNG CAMPAK ---
    const campak_s = bias.campak.reduce((a, b) => a + (Number(b.imun_cmk_jml) || 0), 0);
    const campak_t = bias.campak.reduce((a, b) => a + (Number(b.ttl_abs_cmk) || 0), 0);

    // --- 2. HITUNG DT ---
    const dt_s = bias.dt.reduce((a, b) => a + (Number(b.dt_imun_jml) || 0), 0);
    const dt_t = bias.dt.reduce((a, b) => a + (Number(b.ttl_abs_dt) || 0), 0);

    // --- 3. HITUNG TD (Gabungan tabel DT kls 1 & tabel TD kls 2,5) ---
    const td_s = bias.dt.reduce((a, b) => a + (Number(b.imun_td_jml) || 0), 0) +
                 bias.td.reduce((a, b) => a + (Number(b.td_imun_jml_kls_2) || 0) + (Number(b.imun_td_jml_kls_5) || 0), 0);
    
    const td_t = bias.dt.reduce((a, b) => a + (Number(b.ttl_abs_td) || 0), 0) +
                 bias.td.reduce((a, b) => a + (Number(b.ttl_abs_td_kls_2) || 0) + (Number(b.ttl_abs_td_kls_5) || 0), 0);

    // --- 4. HITUNG HPV (JABARKAN PER KELAS) ---
    const k5 = bias.hpv.kelas.kelas_5;
    const k6 = bias.hpv.kelas.kelas_6;
    const k9 = bias.hpv.kelas.kelas_9;

    // Kalkulasi "Sudah" per kelas
    const hpv_s_k5 = k5.reduce((a, b) => a + (Number(b.hpv_ttl_kls_5) || 0), 0);
    const hpv_s_k6 = k6.reduce((a, b) => a + (Number(b.hpv_ttl_kls_6) || 0), 0);
    const hpv_s_k9 = k9.reduce((a, b) => a + (Number(b.hpv_ttl_kls_9) || 0), 0);

    // Kalkulasi "Tidak" per kelas
    const hpv_t_k5 = k5.reduce((a, b) => a + (Number(b.hpv_ttl_abs_kls_5) || 0), 0);
    const hpv_t_k6 = k6.reduce((a, b) => a + (Number(b.hpv_ttl_abs_kls_6) || 0), 0);
    const hpv_t_k9 = k9.reduce((a, b) => a + (Number(b.hpv_ttl_abs_kls_9) || 0), 0);

    // Akumulasi Total HPV
    const hpv_s = hpv_s_k5 + hpv_s_k6 + hpv_s_k9;
    const hpv_t = hpv_t_k5 + hpv_t_k6 + hpv_t_k9;

    // --- 5. UPDATE UI ---
    updateCard('campak', campak_s, campak_t);
    updateCard('dt',     dt_s,     dt_t);
    updateCard('td',     td_s,     td_t);
    updateCard('hpv',    hpv_s,    hpv_t);

    // Hitung Grand Total BIAS
    const total_s = campak_s + dt_s + td_s + hpv_s;
    const total_t = campak_t + dt_t + td_t + hpv_t;

    updateText('total-semua-s', total_s);
    updateText('total-semua-t', total_t);
}

// ==================================================
// 5. UI HELPERS
// ==================================================
function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = (Number(val) || 0).toLocaleString('id-ID');
}

function updateCard(prefix, s, t) {
    updateText(`total-${prefix}-s`, s);
    updateText(`total-${prefix}-t`, t);
}

function populatePuskesmasFilter() {
    const selector = document.getElementById('puskesmasSelector');
    if (!selector || !cachedData) return;
    const puskSet = new Set();
    const bias = cachedData.program_imunisasi.bias;

    // Ambil dari campak (Flat)
    if (Array.isArray(bias.campak)) bias.campak.forEach(d => puskSet.add(d.Pukesmas || d.Puskesmas));

    [...puskSet].filter(Boolean).sort().forEach(p => {
        selector.add(new Option(p, p));
    });
}

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
