/* ==================================================
   1. GLOBAL VARIABLES & CHART INSTANCES
   ================================================== */
let cachedData = null;
let scatterChartInstance = null;
let usiaChartInstance = null;
let jkChartInstance = null;
let barChartInstance = null;

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

    const selectedPuskesmas = document.getElementById('puskesmasSelector').value;
    const normalizedSelected = normalizePuskesmasName(selectedPuskesmas);
    const biasSource = cachedData.program_imunisasi.bias;
    const uciSource = cachedData.program_imunisasi.uci;

    // Filter array dengan dukungan key Pukesmas/Puskesmas/puskesmas
    const filterArray = (arr) => (arr || []).filter(d => {
        if (selectedPuskesmas === 'all') return true;
        const rawName = d.Pukesmas || d.Puskesmas || d.puskesmas || "";
        return normalizePuskesmasName(rawName) === normalizedSelected;
    });

    // --- PROSES DATA BIAS ---
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

    // --- PROSES DATA UCI ---
    let filteredUci = {
        antigen: {
            rv: { t1: filterArray(uciSource.antigen?.rv?.["2017"]), t2: filterArray(uciSource.antigen?.rv?.["2024"]) },
            rotarix: { t1: filterArray(uciSource.antigen?.rotarix?.["2017"]), t2: filterArray(uciSource.antigen?.rotarix?.["2024"]) },
            pcv: { t1: filterArray(uciSource.antigen?.pcv?.["2017"]), t2: filterArray(uciSource.antigen?.pcv?.["2024"]) },
            je: { t1: filterArray(uciSource.antigen?.je?.["2017"]), t2: filterArray(uciSource.antigen?.je?.["2024"]) },
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

    // --- HITUNG FITUR PERSENTASE (%) CARD PINK ---
    const totalS_Gabungan = resBias.total_s + resUci.total_s;
    const totalSasaran_Gabungan = resBias.sasaran_bias + resUci.sasaran_uci;
    let totalPersen = 0;
    if (totalSasaran_Gabungan > 0) {
        totalPersen = (totalS_Gabungan / totalSasaran_Gabungan) * 100;
    }

    // Update UI Header & Card Pink
    updateText('total-semua-s', totalS_Gabungan);
    updateText('total-semua-t', resBias.total_t + resUci.total_t);
    updateText('total-semua-sasaran', totalSasaran_Gabungan);
    updateText('total-semua-persen', totalPersen.toFixed(1) + "%");

    // Refresh Grafik
    updateBarChart(selectedPuskesmas);
    updateScatterChart(selectedPuskesmas);
    updateUsiaChart(resBias);
    updateJKChart(resBias.jk.L + resUci.jk.L, resBias.jk.P + resUci.jk.P);
}

/* ==================================================
   5. DATA PROCESSORS (BIAS & UCI)
   ================================================== */
function processDataBIAS(bias) {
    const sumT = (arr, key) => (arr || []).reduce((a, b) => a + (Number(b[key]) || 0), 0);
    
    // Sasaran Per Kelas
    const s1 = sumT(bias.campak, "kls_1_mrd_br_jml") + sumT(bias.campak, "tdk_nk_kls_cmk");
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
    const u17 = sumT(uci.antigen.rv.t1, 'bayi_lhr_hdp_2017_jml');
    const u22 = sumT(uci.baduta.booster.t2, 'bayi_lhr_hdp_2022_jml');
    const u23 = sumT(uci.baduta.booster.t3, 'bayi_lhr_hdp_2023_jml');
    const u24 = sumT(uci.hb0_bcg.t1, 'bayi_lhr_hdp_2024_jml');
    const u25 = sumT(uci.hb0_bcg.t2, 'bayi_lhr_hdp_2025_jml');

    updateText('uci-2017', u17); updateText('uci-2022', u22); updateText('uci-2023', u23); updateText('uci-2024', u24); updateText('uci-2025', u25);

    const sumS = (obj, keys) => {
        let total = 0; if (!obj) return 0;
        Object.values(obj).forEach(arr => { if (Array.isArray(arr)) arr.forEach(d => { keys.forEach(k => total += (Number(d[k]) || 0)); }); });
        return total;
    };
    const sumT_Uci = (obj) => {
        let total = 0; if (!obj) return 0;
        Object.values(obj).forEach(arr => { if (Array.isArray(arr)) arr.forEach(d => { 
            total += (Number(d.mati_L)||0) + (Number(d.mati_P)||0) + (Number(d.pindah_L)||0) + (Number(d.menolak_L)||0); 
        }); });
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
        barChartInstance.data.labels = labels;
        barChartInstance.data.datasets[0].data = dataBias;
        barChartInstance.data.datasets[1].data = dataUci;
        barChartInstance.update();
    } else {
        barChartInstance = new Chart(barEl, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Capaian BIAS', data: dataBias, backgroundColor: '#0d47a1' },
                    { label: 'Capaian UCI', data: dataUci, backgroundColor: '#64b5f6' }
                ]
            },
            options: { responsive: true, plugins: { datalabels: { anchor: 'end', align: 'top', font: { size: 10, weight: 'bold' } } }, scales: { y: { beginAtZero: true } } }
        });
    }
}

function updateScatterChart(filterPusk) {
    const scatterEl = document.getElementById('scatterChart'); if (!scatterEl) return;
    let labels = [...new Set(cachedData.program_imunisasi.bias.campak.map(d => d.Pukesmas || d.Puskesmas))];
    if (filterPusk !== 'all') labels = labels.filter(p => normalizePuskesmasName(p) === normalizePuskesmasName(filterPusk));
    const data = labels.map(n => ({
        x: cachedData.program_imunisasi.bias.campak.filter(d=>normalizePuskesmasName(d.Pukesmas||d.Puskesmas)===normalizePuskesmasName(n)).reduce((a,b)=>a+(Number(b.imun_cmk_jml)||0),0),
        y: cachedData.program_imunisasi.uci.baduta.booster["2023"].filter(d=>normalizePuskesmasName(d.Pukesmas||d.Puskesmas)===normalizePuskesmasName(n)).reduce((a,b)=>a+(Number(b.lengkap_jml)||0),0),
        label: n
    }));
    if (scatterChartInstance) { scatterChartInstance.data.datasets[0].data = data; scatterChartInstance.update(); } 
    else { scatterChartInstance = new Chart(scatterEl, { type: 'scatter', data: { datasets: [{ label: 'Puskesmas', data: data, backgroundColor: 'red' }] }, options: { layout: { padding: 80 }, plugins: { datalabels: { rotation: -90, align: 'end', anchor: 'end', formatter: (v)=>v.label } } } }); }
}

function updateJKChart(l, p) {
    const jkEl = document.getElementById('jkChart'); if (!jkEl) return;
    if (jkChartInstance) { jkChartInstance.data.datasets[0].data = [p, l]; jkChartInstance.update(); } 
    else { jkChartInstance = new Chart(jkEl, { type: 'doughnut', data: { labels: ['Perempuan', 'Laki-laki'], datasets: [{ data: [p, l], backgroundColor: ['#ec407a', '#42a5f5'] }] } }); }
}

function updateUsiaChart(resBias) {
    const usiaEl = document.getElementById('usiaChart'); if (!usiaEl) return;
    if (usiaChartInstance) { usiaChartInstance.data.datasets[0].data = resBias.detail_sasaran; usiaChartInstance.update(); } 
    else { usiaChartInstance = new Chart(usiaEl, { type: 'doughnut', data: { labels: ['Kls 1', 'Kls 2', 'Kls 5', 'Kls 6', 'Kls 9'], datasets: [{ data: resBias.detail_sasaran, backgroundColor: ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350'] }] } }); }
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