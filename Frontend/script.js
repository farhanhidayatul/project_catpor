/* ==================================================
   1. GLOBAL VARIABLES & CHART INSTANCES
   ================================================== */
let cachedData = null;
let scatterChartInstance = null;
let kelasChartInstance = null;
let jkChartInstance = null;
let barChartInstance = null;
let tahunChartInstance = null; // Menambahkan instance untuk trend tahunan

if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

/* ==================================================
   2. NORMALIZATION HELPER (MENGATASI BEDA PENULISAN)
   ================================================== */
function normalizePuskesmasName(name) {
    if (!name) return "";
    let n = name.toString().toUpperCase().trim();
    // Menyelaraskan angka romawi ke angka biasa (I -> 1, II -> 2, III -> 3)
    n = n.replace(/\sI$/, " 1").replace(/\sII$/, " 2").replace(/\sIII$/, " 3");
    // Menghapus kata PUSKESMAS/PUKESMAS di depan agar sisa namanya saja yang dibandingkan
    n = n.replace(/^PUSKESMAS\s|^PUKESMAS\s/, "");
    return n;
}

/* ==================================================
   3. DATA FETCH & INITIALIZATION
   ================================================== */
async function fetchImunisasiData() {
    try {
        const response = await fetch('data_imunisasi_terbaru.json');
        cachedData = await response.json();
        populatePuskesmasFilter();
        handleFilterChange();
    } catch (error) {
        console.error("Gagal memuat data JSON:", error);
    }
}

/* ==================================================
   4. FILTER HANDLER (SINKRONISASI TOTAL)
   ================================================== */
function handleFilterChange() {
    if (!cachedData) return;

    // 1. Ambil nilai filter dari elemen UI
    const selectedPuskesmas = document.getElementById('puskesmasSelector').value;
    const selectedYear = document.getElementById('yearSelector')?.value || 'all'; 
    const selectedCat = document.getElementById('categorySelector')?.value || 'all';

    const normalizedSelected = normalizePuskesmasName(selectedPuskesmas);
    const biasSource = cachedData.program_imunisasi.bias;
    const uciSource = cachedData.program_imunisasi.uci;

    // 2. Helper Filter Universal (Mendukung filter Puskesmas & Tahun)
    const filterArray = (arr, yearContext = 'all') => (arr || []).filter(d => {
        const matchPusk = (selectedPuskesmas === 'all' || normalizePuskesmasName(d.Pukesmas || d.Puskesmas || d.puskesmas) === normalizedSelected);
        const matchYear = (selectedYear === 'all' || yearContext === 'all' || yearContext === selectedYear);
        return matchPusk && matchYear;
    });

    // 3. --- PROSES DATA BIAS ---
    const isBiasActive = (selectedCat === 'all' || selectedCat === 'bias');
    let filteredBias = {
        campak: isBiasActive ? filterArray(biasSource.campak) : [],
        dt:     isBiasActive ? filterArray(biasSource.dt) : [],
        td:     isBiasActive ? filterArray(biasSource.td) : [],
        hpv: {
            kelas: {
                kelas_5: isBiasActive ? filterArray(biasSource.hpv?.kelas_5) : [],
                kelas_6: isBiasActive ? filterArray(biasSource.hpv?.kelas_6) : [],
                kelas_9: isBiasActive ? filterArray(biasSource.hpv?.kelas_9) : []
            }
        }
    };

    // 4. --- PROSES DATA UCI ---
    const isUciActive = (selectedCat === 'all' || selectedCat === 'uci');
    let filteredUci = {
        antigen: {
            rv: { t1: isUciActive ? filterArray(uciSource.antigen?.rv?.["2017"], "2017") : [], t2: isUciActive ? filterArray(uciSource.antigen?.rv?.["2024"], "2024") : [] },
            rotarix: { t1: isUciActive ? filterArray(uciSource.antigen?.rotarix?.["2017"], "2017") : [], t2: isUciActive ? filterArray(uciSource.antigen?.rotarix?.["2024"], "2024") : [] },
            pcv: { t1: isUciActive ? filterArray(uciSource.antigen?.pcv?.["2017"], "2017") : [], t2: isUciActive ? filterArray(uciSource.antigen?.pcv?.["2024"], "2024") : [] },
            je: { t1: isUciActive ? filterArray(uciSource.antigen?.je?.["2017"], "2017") : [], t2: isUciActive ? filterArray(uciSource.antigen?.je?.["2024"], "2024") : [] },
            heksavalen: { t1: isUciActive ? filterArray(uciSource.antigen?.heksavalen?.["2017"], "2017") : [], t2: isUciActive ? filterArray(uciSource.antigen?.heksavalen?.["2024"], "2024") : [] }
        },
        baduta: {
            booster: { 
                t1: isUciActive ? filterArray(uciSource.baduta?.booster?.["2017"], "2017") : [], 
                t2: isUciActive ? filterArray(uciSource.baduta?.booster?.["2022"], "2022") : [], 
                t3: isUciActive ? filterArray(uciSource.baduta?.booster?.["2023"], "2023") : [] 
            }
        },
        hb0_bcg: { t1: isUciActive ? filterArray(uciSource.hb0_bcg?.["2024"], "2024") : [], t2: isUciActive ? filterArray(uciSource.hb0_bcg?.["2025"], "2025") : [] },
        tt: { t1: isUciActive ? filterArray(uciSource.tt?.["2024"], "2024") : [], t2: isUciActive ? filterArray(uciSource.tt?.["2025"], "2025") : [] }
    };

    // 5. Jalankan Processor Asli
    const resBias = processDataBIAS(filteredBias);
    const resUci = processDataUCI(filteredUci);

    // 6. --- PERBAIKAN LOGIKA TOTAL PERSENTASE (CARD PINK) ---
    const totalS_Gabungan = resBias.total_s + resUci.total_s; // Total Capaian (S)
    const totalSasaran_Gabungan = resBias.sasaran_bias + resUci.sasaran_uci; // Total Sasaran
    
    let totalPersen = 0;
    if (totalSasaran_Gabungan > 0) {
        // Rumus yang benar: (Capaian / Sasaran) * 100
        totalPersen = (totalSasaran_Gabungan / totalS_Gabungan) * 100;
    }

    // Update UI Header & Card Pink
    updateText('total-semua-s', totalS_Gabungan);
    updateText('total-semua-t', resBias.total_t + resUci.total_t);
    updateText('total-semua-sasaran', totalSasaran_Gabungan);
    updateText('total-semua-persen', totalPersen.toFixed(1) + "%");

    // 7. Refresh Grafik
    updateBarChart(selectedPuskesmas);
    updateScatterChart(selectedPuskesmas);
    updateKelasChart(resBias);
    updateJKChart(resBias.jk.L + resUci.jk.L, resBias.jk.P + resUci.jk.P);
    updateDistribusiTahunChart(selectedPuskesmas);
}

/* ==================================================
   5. DATA PROCESSORS (BIAS & UCI)
   ================================================== */
function processDataBIAS(bias) {
    const sumT = (arr, key) => (arr || []).reduce((a, b) => a + (Number(b[key]) || 0), 0);
    
    // Sasaran Per Kelas
    const s1 = sumT(bias.campak, "kls_1_mrd_br_jml") + sumT(bias.campak, "tdk_nk_kls_cmk") + sumT(bias.dt, "tdk_nk_kls_dt");
    const s2 = sumT(bias.td, 'kls_2_mrd_br_jml') + sumT(bias.td, 'tdk_nk_kls_td_kls_2');
    const s5 = sumT(bias.td, 'kls_5_mrd_L') + sumT(bias.td, 'tdk_nk_kls_td_kls_5') + sumT(bias.hpv.kelas.kelas_5, 'ssrn_P_kls_5');
    const s6 = sumT(bias.hpv.kelas.kelas_6, 'ssrn_P_kls_6');
    const s9 = sumT(bias.hpv.kelas.kelas_9, 'ssrn_P_kls_9');

    updateText('bias-kelas-1', s1); updateText('bias-kelas-2', s2); 
    updateText('bias-kelas-5', s5); updateText('bias-kelas-6', s6); updateText('bias-kelas-9', s9);

    const c_s = sumT(bias.campak, 'imun_cmk_jml');
    const c_t = sumT(bias.campak, 'ttl_abs_cmk');
    const dt_s = sumT(bias.dt, 'dt_imun_jml');
    const dt_t = sumT(bias.dt, 'ttl_abs_dt');
    const td_s = sumT(bias.td, 'td_imun_jml_kls_2') + sumT(bias.td, 'imun_td_jml_kls_5');
    const td_t = sumT(bias.td, 'ttl_abs_td_kls_2') + sumT(bias.td, 'ttl_abs_td_kls_5');
    const hpv_s = sumT(bias.hpv.kelas.kelas_5, 'hpv_ttl_kls_5') + sumT(bias.hpv.kelas.kelas_6, 'hpv_ttl_kls_6') + sumT(bias.hpv.kelas.kelas_9, 'hpv_ttl_kls_9');
    const hpv_t = sumT(bias.hpv.kelas.kelas_5, 'hpv_ttl_abs_kls_5') + sumT(bias.hpv.kelas.kelas_6, 'hpv_ttl_abs_kls_6') + sumT(bias.hpv.kelas.kelas_9, 'hpv_ttl_abs_kls_9');

    updateCard('campak', c_s, c_t); updateCard('dt', dt_s, dt_t); updateCard('td', td_s, td_t); updateCard('hpv', hpv_s, hpv_t);

    return { 
        total_s: c_s + dt_s + td_s + hpv_s, 
        total_t: c_t + dt_t + td_t + hpv_t,
        sasaran_bias: s1 + s2 + s5 + s6 + s9, 
        detail_sasaran: [s1, s2, s5, s6, s9],
        jk: { 
            L: sumT(bias.campak, 'imun_cmk_L') + sumT(bias.dt, 'dt_imun_L') + sumT(bias.td, 'td_imun_L_kls_2'),
            P: sumT(bias.campak, 'imun_cmk_P') + sumT(bias.dt, 'dt_imun_P') + hpv_s 
        }
    };
}

function processDataUCI(uci) {
    const sumT = (arr, key) => (arr || []).reduce((a, b) => a + (Number(b[key]) || 0), 0);
    
    // Sasaran Bayi Lahir
    const u17 = sumT(uci.antigen.rv.t1, 'bayi_lhr_hdp_2017_jml') + 
                sumT(uci.antigen.rotarix.t1, 'bayi_lhr_hdp_2017_jml') + 
                sumT(uci.antigen.pcv.t1, 'bayi_lhr_hdp_2017_jml') + 
                sumT(uci.antigen.je.t1, 'bayi_lhr_hdp_2017_jml') +
                sumT(uci.antigen.heksavalen.t1, 'bayi_lhr_hdp_2017_jml') + 
                sumT(uci.baduta.booster.t1, 'bayi_lhr_hdp_2017_jml');

    const u22 = sumT(uci.baduta.booster.t2, 'bayi_lhr_hdp_2022_jml');
    const u23 = sumT(uci.baduta.booster.t3, 'bayi_lhr_hdp_2023_jml');
    const u24 = sumT(uci.hb0_bcg.t1, 'bayi_lhr_hdp_2024_jml') +
                sumT(uci.antigen.rv.t2, 'bayi_lhr_hdp_2024_jml') + 
                sumT(uci.antigen.rotarix.t2, 'bayi_lhr_hdp_2024_jml') + 
                sumT(uci.antigen.pcv.t2, 'bayi_lhr_hdp_2024_jml') + 
                sumT(uci.antigen.je.t2, 'bayi_lhr_hdp_2024_jml') +
                sumT(uci.antigen.heksavalen.t2, 'bayi_lhr_hdp_2024_jml') +
                sumT(uci.tt.t1, 'caten_2024');
    const u25 = sumT(uci.hb0_bcg.t2, 'bayi_lhr_hdp_2025_jml') +
                sumT(uci.tt.t2, 'caten_2025');

    updateText('uci-2017', u17); updateText('uci-2022', u22); updateText('uci-2023', u23); updateText('uci-2024', u24); updateText('uci-2025', u25);

    const sumS = (obj, keys) => {
        let total = 0; if (!obj) return 0;
        Object.values(obj).forEach(arr => { if (Array.isArray(arr)) arr.forEach(d => { keys.forEach(k => total += (Number(d[k]) || 0)); }); });
        return total;
    };
    const sumT_Uci = (obj) => {
        let total = 0; 
        if (!obj) return 0;

        Object.values(obj).forEach(arr => { 
            if (Array.isArray(arr)) {
                arr.forEach(d => { 
                    // Logika Fallback: Cek format '_-_' dulu, jika tidak ada pakai format standar
                    const mati = (Number(d['mati_-_L']) || Number(d['mati_-']) || 0) + 
                                (Number(d['mati_-_P']) || Number(d['bumil_mati_-']) || 0);
                                
                    const pindah = (Number(d['pindah_-_L']) || Number(d['bumil_pindah_-']) || 0) +
                                (Number(d['pindah_-_P']) || Number(d['pindah_-']) || 0);
                    
                    const menolak = (Number(d['menolak_-_L']) || Number(d['bumil_menolak']) || Number(d['menolak_L']) || 0) + 
                                    (Number(d['menolak_-_P']) || Number(d['menolak_p']) || Number(d['menolak_P']) || 0);

                    total += (mati + pindah + menolak);
                }); 
            }
        });
        return total;
    };

    const hasil = {
        rv:      { s: sumS(uci.antigen.rv, ['rv_1_jml','rv_2_jml','rv_3_jml']), t: sumT_Uci(uci.antigen.rv) },
        rotarix: { s: sumS(uci.antigen.rotarix, ['rotarix_1_jml','rotarix_2_jml']), t: sumT_Uci(uci.antigen.rotarix) },
        pcv:     { s: sumS(uci.antigen.pcv, ['pcv_1_jml','pcv_2_jml','pcv_3_jml']), t: sumT_Uci(uci.antigen.pcv) },
        je:      { s: sumS(uci.antigen.je, ['je_1_jml']), t: sumT_Uci(uci.antigen.je) },
        heksa:   { s: sumS(uci.antigen.heksavalen, ['heksavalen_1_jml','heksavalen_2_jml','heksavalen_3_jml']), t: sumT_Uci(uci.antigen.heksavalen) },
        booster: { s: sumS(uci.baduta.booster, ['lengkap_jml']), t: sumT_Uci(uci.baduta.booster) },
        hb0_bcg: { s: sumS(uci.hb0_bcg, ['lengkap_jml']), t: sumT_Uci(uci.hb0_bcg) },
        tt:      { s: sumS(uci.tt, ['total']), t: sumT_Uci(uci.tt) }
    };

    Object.keys(hasil).forEach(k => updateCard(k, hasil[k].s, hasil[k].t));

    return { 
        total_s: Object.values(hasil).reduce((a,b)=>a+b.s,0), 
        total_t: Object.values(hasil).reduce((a,b)=>a+b.t,0), 
        sasaran_uci: u17+u22+u23+u24+u25, 
        jk: { L: 0, P: 0 } 
    };
}

/* ==================================================
   6. CHART GENERATORS (BAR CHART GANDA BIAS & UCI)
   ================================================== */
function updateBarChart(filterPusk) {
    const barEl = document.getElementById('barChart');
    if (!barEl || !cachedData) return;

    let labels = [...new Set(cachedData.program_imunisasi.bias.campak.map(d => d.Pukesmas || d.Puskesmas))].filter(Boolean);
    if (filterPusk !== 'all') labels = labels.filter(p => normalizePuskesmasName(p) === normalizePuskesmasName(filterPusk));

    const dataBias = labels.map(name => {
        const norm = normalizePuskesmasName(name);
        const campak = cachedData.program_imunisasi.bias.campak.filter(d => normalizePuskesmasName(d.Pukesmas||d.Puskesmas) === norm).reduce((a,b)=>a+(Number(b.imun_cmk_jml)||0),0);
        const dt = cachedData.program_imunisasi.bias.dt.filter(d => normalizePuskesmasName(d.Pukesmas||d.Puskesmas) === norm).reduce((a,b)=>a+(Number(b.dt_imun_jml)||0),0);
        return campak + dt;
    });

    const dataUci = labels.map(name => {
        const norm = normalizePuskesmasName(name);
        return cachedData.program_imunisasi.uci.baduta.booster["2023"].filter(d => normalizePuskesmasName(d.Pukesmas||d.Puskesmas) === norm).reduce((a,b)=>a+(Number(b.lengkap_jml)||0),0);
    });

    if (barChartInstance) {
        // 1. Update Data
        barChartInstance.data.labels = labels;
        barChartInstance.data.datasets[0].data = dataBias;
        barChartInstance.data.datasets[1].data = dataUci;
        
        // 2. PAKSA Update Ukuran Font Sumbu X (Gunakan cara ini)
        if (barChartInstance.options.scales.x) {
            barChartInstance.options.scales.x.ticks.font = {
                size: 8, // Ganti ke ukuran yang sangat kecil untuk tes (misal 8)
                weight: 'normal'
            };
        }
        
        barChartInstance.update();
    } else {
        // Inisialisasi Pertama
        barChartInstance = new Chart(barEl, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Capaian BIAS', data: dataBias, backgroundColor: '#0d47a1' },
                    { label: 'Capaian UCI', data: dataUci, backgroundColor: '#64b5f6' }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            font: { 
                                size: 8, // Ukuran kecil di sini
                                family: 'Arial' 
                            }
                        }
                    },
                    y: { beginAtZero: true } 
                },
                plugins: {
                    datalabels: {
                        // 'anchor: end' berarti titik acuan ada di ujung batang
                        anchor: 'end', 
                        // 'align: top' berarti posisi teks ada di atas titik acuan tersebut
                        align: 'top', 
                        // 'offset' memberikan jarak sedikit (pixel) agar tidak menempel garis batang
                        offset: 2, 
                        font: { 
                            size: 6, 
                        },
                        formatter: (value) => value > 0 ? value : '' // Opsional: sembunyikan jika nol
                    }
                }
            }
        });
    }
}

function updateScatterChart(filterPusk) {
    const scatterEl = document.getElementById('scatterChart'); 
    if (!scatterEl) return;

    // Ambil tahun dari UI. Jika 'all', kita default ke 2024 agar tidak overload
    const yearUI = document.getElementById('yearSelector')?.value;
    const selectedYear = (yearUI === 'all' || !yearUI) ? "2024" : yearUI;
    
    const uciSource = cachedData.program_imunisasi.uci;
    const normPusk = normalizePuskesmasName(filterPusk);

    // 1. Ambil list Puskesmas
    let labels = [...new Set(cachedData.program_imunisasi.bias.campak.map(d => d.Pukesmas || d.Puskesmas))];
    if (filterPusk !== 'all') labels = labels.filter(p => normalizePuskesmasName(p) === normPusk);

    const data = labels.map(n => {
        const normN = normalizePuskesmasName(n);

        // SUMBU X: Imunisasi Campak (BIAS)
        const valX = cachedData.program_imunisasi.bias.campak
            .filter(d => normalizePuskesmasName(d.Pukesmas || d.Puskesmas) === normN)
            .reduce((a, b) => a + (Number(b.imun_cmk_jml) || 0), 0);

        // SUMBU Y: Total Capaian UCI (Harus Akumulatif agar tembus 1000)
        let valY = 0;
        
        // A. Scan Semua Antigen
        if (uciSource.antigen) {
            Object.values(uciSource.antigen).forEach(antigenGroup => {
                const yearData = antigenGroup[selectedYear] || [];
                yearData.filter(d => normalizePuskesmasName(d.Pukesmas || d.Puskesmas) === normN)
                        .forEach(d => {
                            Object.keys(d).forEach(key => {
                                // Ambil semua key capaian (rv_1_jml, pcv_1_jml, dll)
                                if (key.includes('_jml') && !key.includes('bayi_lhr')) {
                                    valY += (Number(d[key]) || 0);
                                }
                            });
                        });
            });
        }

        // B. Scan Baduta
        (uciSource.baduta?.booster?.[selectedYear] || [])
            .filter(d => normalizePuskesmasName(d.Pukesmas || d.Puskesmas) === normN)
            .forEach(d => valY += (Number(d.lengkap_jml) || 0));

        // C. Scan HB0_BCG
        (uciSource.hb0_bcg?.[selectedYear] || [])
            .filter(d => normalizePuskesmasName(d.Pukesmas || d.Puskesmas) === normN)
            .forEach(d => valY += (Number(d.lengkap_jml) || 0));

        return { x: valX, y: valY, label: n };
    });

    if (scatterChartInstance) { 
        scatterChartInstance.data.datasets[0].data = data; 
        scatterChartInstance.update(); 
    } else { 
        scatterChartInstance = new Chart(scatterEl, { 
            type: 'scatter', 
            data: { 
                datasets: [{ 
                    label: 'Puskesmas', 
                    data: data, 
                    backgroundColor: 'rgba(255, 61, 0, 0.7)',
                    borderColor: '#bf360c',
                    borderWidth: 1,
                    pointRadius: 7
                }] 
            }, 
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                // Kecilkan padding agar grafik lebih luas
                layout: { 
                    padding: { 
                        top: 30, 
                        right: 50, // Dikurangi dari 120 agar tidak terlalu kosong di kanan
                        bottom: 10, 
                        left: 10 
                    } 
                }, 
                scales: {
                    x: {
                        title: { display: true, text: 'Capaian BIAS (Campak)', font: { weight: 'bold' } },
                        beginAtZero: true,
                        // Hapus suggestedMax agar skala otomatis menyesuaikan data (Auto-fit)
                    },
                    y: {
                        title: { display: true, text: 'Total Capaian UCI', font: { weight: 'bold' } },
                        beginAtZero: true,
                        // Hapus suggestedMax
                    }
                },
                plugins: { 
                    legend: { display: false },
                    datalabels: { 
                        // Gunakan 'offset' untuk menjauhkan teks dari titik tanpa perlu padding besar
                        offset: 8,
                        rotation: -45, 
                        align: 'end', 
                        anchor: 'end', 
                        formatter: (v) => v.label,
                        font: { size: 9 },
                        // Matikan clip agar label yang di pinggir tetap terlihat
                        clip: false 
                    } 
                } 
            } 
        }); 
    }
}

function updateJKChart(l, p) {
    const jkEl = document.getElementById('jkChart'); if (!jkEl) return;
    if (jkChartInstance) { jkChartInstance.data.datasets[0].data = [p, l]; jkChartInstance.update(); } 
    else { jkChartInstance = new Chart(jkEl, { type: 'doughnut', data: { labels: ['Perempuan', 'Laki-laki'], datasets: [{ data: [p, l], backgroundColor: ['#ec407a', '#42a5f5'] }] } }); }
}

function updateKelasChart(resBias) {
    const usiaEl = document.getElementById('kelasChart'); if (!usiaEl) return;
    if (kelasChartInstance) { kelasChartInstance.data.datasets[0].data = resBias.detail_sasaran; kelasChartInstance.update(); } 
    else { kelasChartInstance = new Chart(usiaEl, { type: 'doughnut', data: { labels: ['Kelas 1', 'Kelas 2', 'Kelas 5', 'Kelas 6', 'Kelas 9'], datasets: [{ data: resBias.detail_sasaran, backgroundColor: ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350'] }] } }); }
}

/* ==================================================
   FUNGSI: UPDATE DISTRIBUSI PUSKESMAS PER TAHUN (CODE 1)
   Logika: Menampilkan tren 'lengkap_jml' berdasarkan sumbu X (Tahun)
   ================================================== */
/* ==================================================
   FUNGSI: UPDATE DISTRIBUSI PER TAHUN (SELURUH UCI)
   ================================================== */
function updateDistribusiTahunChart(selectedPusk) {
    const trendEl = document.getElementById('trendChart');
    // Tambahkan pengambilan nilai selectedYear dari UI
    const selectedYear = document.getElementById('yearSelector')?.value || 'all'; 
    
    if (!trendEl || !cachedData) return;

    const allYears = ["2017", "2022", "2023", "2024", "2025"];
    const normPusk = normalizePuskesmasName(selectedPusk);
    const uciSource = cachedData.program_imunisasi.uci;

    // LOGIKA FILTER TAHUN: 
    // Jika 'all', tampilkan semua. Jika tahun spesifik, tampilkan tahun itu saja.
    const listTahunTampil = (selectedYear === 'all') ? allYears : [selectedYear];

    const getCapaianAllUCI = (year) => {
        let totalYear = 0;

        // 1. Scan Antigen dengan Key Spesifik (Agar data RV & Rotarix tidak tercampur)
        const mappingKeys = {
            rv: ['rv_1_jml', 'rv_2_jml', 'rv_3_jml'],
            rotarix: ['rotarix_1_jml', 'rotarix_2_jml'],
            pcv: ['pcv_1_jml', 'pcv_2_jml', 'pcv_3_jml'],
            je: ['je_1_jml'],
            heksavalen: ['heksavalen_1_jml', 'heksavalen_2_jml', 'heksavalen_3_jml']
        };

        if (uciSource.antigen) {
            Object.entries(mappingKeys).forEach(([category, keys]) => {
                const dataArray = uciSource.antigen[category]?.[year] || [];
                dataArray.forEach(d => {
                    const matchPusk = (selectedPusk === 'all' || normalizePuskesmasName(d.Pukesmas || d.Puskesmas || d.puskesmas) === normPusk);
                    if (matchPusk) {
                        keys.forEach(k => { totalYear += (Number(d[k]) || 0); });
                    }
                });
            });
        }

        // 2. Scan Baduta
        const badutaArray = uciSource.baduta?.booster?.[year] || [];
        badutaArray.forEach(d => {
            if (selectedPusk === 'all' || normalizePuskesmasName(d.Pukesmas || d.Puskesmas || d.puskesmas) === normPusk) {
                totalYear += (Number(d.lengkap_jml) || 0);
            }
        });

        // 3. Scan HB0_BCG
        const hbArray = uciSource.hb0_bcg?.[year] || [];
        hbArray.forEach(d => {
            if (selectedPusk === 'all' || normalizePuskesmasName(d.Pukesmas || d.Puskesmas || d.puskesmas) === normPusk) {
                totalYear += (Number(d.lengkap_jml) || 0);
            }
        });

        // 4. Scan TT
        const ttArray = uciSource.tt?.[year] || [];
        ttArray.forEach(d => {
            if (selectedPusk === 'all' || normalizePuskesmasName(d.Pukesmas || d.Puskesmas || d.puskesmas) === normPusk) {
                totalYear += (Number(d.total) || 0);
            }
        });

        return totalYear;
    };

    // Data di-map berdasarkan listTahunTampil (hasil filter tahun)
    const dataPerTahun = listTahunTampil.map(year => getCapaianAllUCI(year));

    // Update atau Buat Chart
    if (tahunChartInstance) {
        tahunChartInstance.data.labels = listTahunTampil;
        tahunChartInstance.data.datasets[0].data = dataPerTahun;
        // Opsional: Ubah warna jika hanya satu tahun agar lebih menarik
        tahunChartInstance.data.datasets[0].backgroundColor = listTahunTampil.length === 1 ? '#ff7043' : '#42a5f5';
        tahunChartInstance.update();
    } else {
        tahunChartInstance = new Chart(trendEl, {
            type: 'bar',
            data: {
                labels: listTahunTampil,
                datasets: [{
                    label: 'Total Seluruh Capaian UCI',
                    data: dataPerTahun,
                    backgroundColor: '#42a5f5',
                    borderColor: '#1e88e5',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

/* ==================================================
   7. UI HELPERS & FILTER POPULATION
   ================================================== */
function updateText(id, val) { const el = document.getElementById(id); if (el) el.innerText = (id.includes('persen') ? val : (Number(val) || 0).toLocaleString('id-ID')); }
function updateCard(prefix, s, t) { updateText(`total-${prefix}-s`, s); updateText(`total-${prefix}-t`, t); }

function populatePuskesmasFilter() {
    const selector = document.getElementById('puskesmasSelector'); if (!selector) return;
    const puskSet = new Set(); 
    cachedData.program_imunisasi.bias.campak.forEach(d => puskSet.add(d.Pukesmas || d.Puskesmas));
    [...puskSet].filter(Boolean).sort().forEach(p => selector.add(new Option(p, p)));
}

document.addEventListener('DOMContentLoaded', fetchImunisasiData);

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