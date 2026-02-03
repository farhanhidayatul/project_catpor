// ==================================================
// 1. GLOBAL CACHE & CHART INSTANCE
// ==================================================
let cachedData = null;
let scatterChartInstance = null;

// Registrasi plugin secara manual untuk memastikan ChartDataLabels terdeteksi
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
} else {
    console.error("Peringatan: Plugin ChartDataLabels tidak ditemukan. Pastikan script CDN sudah terpasang di HTML.");
}

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
// 3. FILTER HANDLER (KONFIGURASI LENGKAP)
// ==================================================
function handleFilterChange() {
    if (!cachedData) return;

    const selectedPuskesmas = document.getElementById('puskesmasSelector').value;
    const biasSource = cachedData.program_imunisasi.bias;
    const uciSource = cachedData.program_imunisasi.uci;

    const filterArray = (arr) => (arr || []).filter(d => {
        const pusk = d.Pukesmas || d.Puskesmas || d.puskesmas;
        return selectedPuskesmas === 'all' || pusk === selectedPuskesmas;
    });

    let filteredBias = {
        campak: filterArray(biasSource.campak),
        dt:     filterArray(biasSource.dt),
        td:     filterArray(biasSource.td),
        hpv: {
            kelas: {
                kelas_5: filterArray(biasSource.hpv?.kelas_5),
                kelas_6: filterArray(biasSource.hpv?.kelas_6),
                kelas_9: filterArray(biasSource.hpv?.kelas_9)
            }
        }
    };

    let filteredUci = {
        antigen: {
            rv:         { t1: filterArray(uciSource.antigen?.rv?.["2017"]), t2: filterArray(uciSource.antigen?.rv?.["2024"]) },
            rotarix:    { t1: filterArray(uciSource.antigen?.rotarix?.["2017"]), t2: filterArray(uciSource.antigen?.rotarix?.["2024"]) },
            pcv:        { t1: filterArray(uciSource.antigen?.pcv?.["2017"]), t2: filterArray(uciSource.antigen?.pcv?.["2024"]) },
            je:         { t1: filterArray(uciSource.antigen?.je?.["2017"]), t2: filterArray(uciSource.antigen?.je?.["2024"]) },
            heksavalen: { t1: filterArray(uciSource.antigen?.heksavalen?.["2017"]), t2: filterArray(uciSource.antigen?.heksavalen?.["2024"]) }
        },
        baduta: {
            booster: {
                t1: filterArray(uciSource.baduta?.booster?.["2017"]),
                t2: filterArray(uciSource.baduta?.booster?.["2022"]),
                t3: filterArray(uciSource.baduta?.booster?.["2023"])
            }
        },
        hb0_bcg: { t1: filterArray(uciSource.hb0_bcg?.["2024"]), t2: filterArray(uciSource.hb0_bcg?.["2025"]) },
        tt: { t1: filterArray(uciSource.tt?.["2024"]), t2: filterArray(uciSource.tt?.["2025"]) }
    };

    const resBias = processDataBIAS(filteredBias);
    const resUci = processDataUCI(filteredUci);

    // --- UPDATE CARD STATISTIK ---
    const totalSemuaS = (resBias.total_s || 0) + (resUci.total_s || 0);
    const totalSemuaT = (resBias.total_t || 0) + (resUci.total_t || 0);
    updateText('total-semua-s', totalSemuaS);
    updateText('total-semua-t', totalSemuaT);

    const totalSasaran = (resBias.sasaran_bias || 0) + (resUci.sasaran_uci || 0);
    updateText('total-semua-sasaran', totalSasaran);

    let persentase = totalSasaran > 0 ? (totalSemuaS / totalSasaran) * 100 : 0;
    const elPersen = document.getElementById('total-semua-persen');
    if (elPersen) {
        elPersen.innerText = persentase.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // --- UPDATE SCATTER CHART ---
    updateScatterChart(selectedPuskesmas);
}

// ==================================================
// 4. PROCESSOR BIAS (TIDAK BERUBAH)
// ==================================================
function processDataBIAS(bias) {
    const sumTotal = (arr, key) => (arr || []).reduce((a, b) => a + (Number(b[key]) || 0), 0);
    
    const s1 = sumTotal(bias.campak, "kls_1_mrd_br_jml") + sumTotal(bias.campak, "tdk_nk_kls_cmk");
    const s2 = sumTotal(bias.td, 'kls_2_mrd_br_jml') + sumTotal(bias.td, 'tdk_nk_kls_td_kls_2');
    const s5 = sumTotal(bias.td, 'kls_5_mrd_L') + sumTotal(bias.td, 'tdk_nk_kls_td_kls_5') + sumTotal(bias.hpv.kelas.kelas_5, 'ssrn_P_kls_5');
    const s6 = sumTotal(bias.hpv.kelas.kelas_6, 'ssrn_P_kls_6');
    const s9 = sumTotal(bias.hpv.kelas.kelas_9, 'ssrn_P_kls_9');

    updateText('bias-kelas-1', s1);
    updateText('bias-kelas-2', s2);
    updateText('bias-kelas-5', s5);
    updateText('bias-kelas-6', s6);
    updateText('bias-kelas-9', s9);

    const campak_s = sumTotal(bias.campak, 'imun_cmk_jml');
    const campak_t = sumTotal(bias.campak, 'ttl_abs_cmk');
    const dt_s = sumTotal(bias.dt, 'dt_imun_jml');
    const dt_t = sumTotal(bias.dt, 'ttl_abs_dt');
    const td_s = sumTotal(bias.dt, 'imun_td_jml') + 
                 bias.td.reduce((a, b) => a + (Number(b.td_imun_jml_kls_2) || 0) + (Number(b.imun_td_jml_kls_5) || 0), 0);
    const td_t = sumTotal(bias.dt, 'ttl_abs_td') + 
                 bias.td.reduce((a, b) => a + (Number(b.ttl_abs_td_kls_2) || 0) + (Number(b.ttl_abs_td_kls_5) || 0), 0);

    const hpv_s = sumTotal(bias.hpv.kelas.kelas_5, 'hpv_ttl_kls_5') + sumTotal(bias.hpv.kelas.kelas_6, 'hpv_ttl_kls_6') + sumTotal(bias.hpv.kelas.kelas_9, 'hpv_ttl_kls_9');
    const hpv_t = sumTotal(bias.hpv.kelas.kelas_5, 'hpv_ttl_abs_kls_5') + sumTotal(bias.hpv.kelas.kelas_6, 'hpv_ttl_abs_kls_6') + sumTotal(bias.hpv.kelas.kelas_9, 'hpv_ttl_abs_kls_9');

    updateCard('campak', campak_s, campak_t);
    updateCard('dt', dt_s, dt_t);
    updateCard('td', td_s, td_t);
    updateCard('hpv', hpv_s, hpv_t);

    return { 
        total_s: campak_s + dt_s + td_s + hpv_s, 
        total_t: campak_t + dt_t + td_t + hpv_t,
        sasaran_bias: s1 + s2 + s5 + s6 + s9
    };
}

// ==================================================
// 5. PROCESSOR UCI (TIDAK BERUBAH)
// ==================================================
function processDataUCI(uci) {
    const sumS = (antigenObj, keys) => {
        let t = 0; if (!antigenObj) return 0;
        Object.values(antigenObj).forEach(arr => {
            if (Array.isArray(arr)) arr.forEach(d => { keys.forEach(k => t += (Number(d[k]) || 0)); });
        });
        return t;
    };

    const sumT = (antigenObj) => {
        let t = 0; if (!antigenObj) return 0;
        Object.values(antigenObj).forEach(arr => {
            if (Array.isArray(arr)) arr.forEach(d => {
                t += (Number(d.mati_L) || 0) + (Number(d.mati_P) || 0) + (Number(d.pindah_L) || 0) + (Number(d.pindah_P) || 0) + (Number(d.menolak_L) || 0) + (Number(d.menolak_P) || 0);
            });
        });
        return t;
    };

    const sumPopulasi = (arr, callName) => (arr || []).reduce((a, b) => a + (Number(b[callName]) || 0), 0);

    const u17 = sumPopulasi(uci.antigen.rv.t1, 'bayi_lhr_hdp_2017_jml');
    const u22 = sumPopulasi(uci.baduta.booster.t2, 'bayi_lhr_hdp_2022_jml');
    const u23 = sumPopulasi(uci.baduta.booster.t3, 'bayi_lhr_hdp_2023_jml');
    const u24 = sumPopulasi(uci.hb0_bcg.t1, 'bayi_lhr_hdp_2024_jml');
    const u25 = sumPopulasi(uci.hb0_bcg.t2, 'bayi_lhr_hdp_2025_jml');

    updateText('uci-2017', u17);
    updateText('uci-2022', u22);
    updateText('uci-2023', u23);
    updateText('uci-2024', u24);
    updateText('uci-2025', u25);

    const p4 = sumS(uci.baduta.booster, ['pentabio_4_jml']);
    const mr2 = sumS(uci.baduta.booster, ['mr_2_jml']);
    const lengkapBoosterRaw = sumS(uci.baduta.booster, ['lengkap_jml']);
    const lengkapBoosterFiltered = Math.max(0, lengkapBoosterRaw - p4 - mr2);

    const hb0_val = sumS(uci.hb0_bcg, ['hb0_jml']);
    const bcg_val = sumS(uci.hb0_bcg, ['bcg_jml']);
    const lengkapHB0Raw = sumS(uci.hb0_bcg, ['lengkap_jml']);
    const lengkapHB0Filtered = Math.max(0, lengkapHB0Raw - hb0_val - bcg_val);

    const hasil = {
        rv:      { s: sumS(uci.antigen.rv, ['rv_1_jml', 'rv_2_jml', 'rv_3_jml']), t: sumT(uci.antigen.rv) },
        rotarix: { s: sumS(uci.antigen.rotarix, ['rotarix_1_jml', 'rotarix_2_jml']), t: sumT(uci.antigen.rotarix) },
        pcv:     { s: sumS(uci.antigen.pcv, ['pcv_1_jml', 'pcv_2_jml', 'pcv_3_jml']), t: sumT(uci.antigen.pcv) },
        je:      { s: sumS(uci.antigen.je, ['je_1_jml']), t: sumT(uci.antigen.je) },
        heksa:   { s: sumS(uci.antigen.heksavalen, ['heksavalen_1_jml', 'heksavalen_2_jml', 'heksavalen_3_jml']), t: sumT(uci.antigen.heksavalen) },
        booster: { s: p4 + mr2 + lengkapBoosterFiltered, t: sumT(uci.baduta.booster) },
        hb0_bcg: { s: hb0_val + bcg_val + lengkapHB0Filtered, t: sumT(uci.hb0_bcg) },
        tt:      { s: sumS(uci.tt, ['total']), t: sumT(uci.tt) }
    };

    Object.keys(hasil).forEach(k => updateCard(k, hasil[k].s, hasil[k].t));

    return {
        total_s: Object.values(hasil).reduce((a, b) => a + b.s, 0),
        total_t: Object.values(hasil).reduce((a, b) => a + b.t, 0),
        sasaran_uci: u17 + u22 + u23 + u24 + u25
    };
}

// ==================================================
// 6. SCATTER CHART LOGIC (DENGAN LABEL VERTIKAL)
// ==================================================
function updateScatterChart(filterPusk) {
    const scatterEl = document.getElementById('scatterChart');
    if (!scatterEl || !cachedData) return;

    const bias = cachedData.program_imunisasi.bias;
    const uci = cachedData.program_imunisasi.uci;

    let allPusk = [...new Set(bias.campak.map(d => d.Pukesmas || d.Puskesmas || d.puskesmas))];
    if (filterPusk !== 'all') allPusk = allPusk.filter(p => p === filterPusk);

    const scatterData = allPusk.map(namaPusk => {
        const b_s = bias.campak.filter(d => (d.Pukesmas||d.Puskesmas||d.puskesmas) === namaPusk).reduce((a, b) => a + (Number(b.imun_cmk_jml) || 0), 0) +
                    bias.dt.filter(d => (d.Pukesmas||d.Puskesmas||d.puskesmas) === namaPusk).reduce((a, b) => a + (Number(b.dt_imun_jml) || 0), 0);
        
        const u_s = uci.baduta.booster["2023"].filter(d => (d.Pukesmas||d.Puskesmas||d.puskesmas) === namaPusk).reduce((a, b) => a + (Number(b.lengkap_jml) || 0), 0);

        return { x: b_s, y: u_s, label: namaPusk };
    });

    if (scatterChartInstance) {
        scatterChartInstance.data.datasets[0].data = scatterData;
        scatterChartInstance.update();
    } else {
        scatterChartInstance = new Chart(scatterEl, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Puskesmas',
                    data: scatterData,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'red',
                    pointRadius: 8
                }]
            },
            options: {
                responsive: true,
                // Tambahkan padding top yang cukup tinggi agar label vertikal tidak terpotong
                layout: { padding: { top: 80, right: 30 } },
                plugins: {
                    title: { display: true, text: 'Perbandingan BIAS vs UCI Per Puskesmas', font: { size: 16 } },
                    datalabels: {
                        display: true,
                        // Penyesuaian Posisi Vertikal
                        align: 'end',      // Muncul di ujung luar titik
                        anchor: 'end',     // Jangkar di luar titik
                        rotation: -90,     // Membuat teks vertikal (90 derajat berlawanan jarum jam)
                        offset: 10,        // Jarak dari titik ke teks
                        formatter: function(value) {
                            return value.label; 
                        },
                        font: { weight: 'bold', size: 10 },
                        color: '#444',
                        clip: false        // Pastikan tidak terpotong tepi canvas
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw.label}: (BIAS: ${ctx.raw.x}, UCI: ${ctx.raw.y})`
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Total BIAS' }, beginAtZero: true },
                    y: { title: { display: true, text: 'Total UCI' }, beginAtZero: true }
                }
            }
        });
    }
}

// ==================================================
// 7. UI HELPERS (TIDAK BERUBAH)
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
    if (Array.isArray(bias.campak)) {
        bias.campak.forEach(d => puskSet.add(d.Pukesmas || d.Puskesmas || d.puskesmas));
    }
    [...puskSet].filter(Boolean).sort().forEach(p => selector.add(new Option(p, p)));
}

document.addEventListener('DOMContentLoaded', fetchImunisasiData);

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
