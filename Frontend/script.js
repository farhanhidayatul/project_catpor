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
