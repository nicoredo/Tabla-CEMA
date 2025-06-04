
// 1. Inyectar content.js al abrir el popup
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  console.log("🔍 Inyectando content.js...");
  if (window.jspdf && window.jspdf.jsPDF) {
  window.jspdf = { jsPDF: window.jspdf.jsPDF };
}
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    files: ['content.js']
  }, () => {
    console.log("✅ content.js inyectado, enviando popupListo...");
    chrome.tabs.sendMessage(tabs[0].id, { tipo: 'popupListo' });
  });
});

// 2. Recibir datos del paciente
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 popup recibió mensaje:", request);
  if (request.tipo === 'datosPaciente') {
    const { nombreCompleto, dni, medicamentos } = request.payload;

    console.log("🧾 Nombre:", nombreCompleto, "DNI:", dni);
    console.log("💊 Medicamentos recibidos:", medicamentos);

    document.getElementById('nombrePaciente').innerText = nombreCompleto;
    document.getElementById('dniPaciente').innerText = dni;
    // Limpiar tabla antes de agregar nuevas filas
    document.getElementById('tbodyMedicacion').innerHTML = '';

    medicamentos.forEach(nombreDosis => {
  const match = nombreDosis.match(/^(.*?)\s+(\d+.*)$/);
  const nombre = match ? match[1] : nombreDosis;
  const dosis = match ? match[2] : '';
  agregarFila(nombre, dosis);
});
  }
});

// 3. Función para agregar fila
function agregarFila(nombre = '', dosis = '') {
  const tbody = document.getElementById('tbodyMedicacion');
  const fila = document.createElement('tr');
  fila.innerHTML = `
    <td><input type="text" list="listaMedicamentos" value="${nombre}"></td>
    <td><input type="text" value="${dosis}" placeholder="Ej: 10mg"></td>
    <td><input type="text"></td>
    <td><input type="text"></td>
    <td><input type="text"></td>
    <td><input type="text"></td>
    <td><button class="remove-btn">X</button></td>
  `;
  tbody.appendChild(fila);

  // Agregar comportamiento al botón "X"
  const botonEliminar = fila.querySelector('.remove-btn');
  botonEliminar.addEventListener('click', () => fila.remove());
}

// 4. Para botones desde HTML
function agregarFilaManual() {
  agregarFila('');
}

function limpiarTabla() {
  const tbody = document.getElementById('tbodyMedicacion');
  if (tbody) {
    tbody.innerHTML = '';
    console.log("🧼 Tabla de medicación limpiada.");
  } else {
    console.error("❌ No se encontró tbodyMedicacion.");
  }
}

// 5. Exponer funciones globalmente
window.agregarFila = agregarFila;
window.agregarFilaManual = agregarFilaManual;
window.limpiarTabla = limpiarTabla;

// 6. Listeners seguros para botones (sin onclick)
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAgregar')?.addEventListener('click', agregarFilaManual);
  document.getElementById('btnLimpiar')?.addEventListener('click', limpiarTabla);
  document.getElementById('btnImprimir')?.addEventListener('click', () => {
    console.log("🖨 Ejecutando window.print()");
    window.print();
  });
  document.getElementById('btnCerrar')?.addEventListener('click', () => window.close());

  const btnMinimizar = document.getElementById('btnMinimizar');
  if (btnMinimizar) {
    btnMinimizar.addEventListener('click', () => {
      const tabla = document.getElementById('tablaMedicacion');
      const controles = document.querySelectorAll('.btn, textarea, h3');
      controles.forEach(el => {
        el.style.display = (el.style.display === 'none' ? '' : 'none');
      });
      tabla.style.display = (tabla.style.display === 'none' ? '' : 'none');
    });
  }

  // Cargar lista medicamentos
  fetch(chrome.runtime.getURL('terminologia_medica.json'))
    .then(res => res.json())
    .then(data => {
      const nombres = Object.keys(data.medicacion);
      const datalist = document.getElementById('listaMedicamentos');
      nombres.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        datalist.appendChild(option);
      });
    })
    .catch(err => console.error("Error cargando terminologia_medica:", err));
});

      // Generar PDF

document.getElementById("btnPDF").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const logo = new Image();
    logo.src = "./logo.png"; // Debe estar en la misma carpeta

    logo.onload = () => {
        // 1. Logo centrado arriba
        doc.addImage(logo, "PNG", 80, 10, 50, 20);

        // 2. Nombre y DNI del paciente
        const nombre = document.getElementById("nombrePaciente").textContent.trim();
        const dni = document.getElementById("dniPaciente").textContent.trim();
        doc.setFontSize(14);
        doc.text(`Paciente: ${nombre} - DNI: ${dni}`, 105, 40, { align: "center" });

        // 3. Extraer tabla HTML de forma robusta
        const table = document.getElementById("tablaMedicacion");
        const data = [];

        const filas = table.querySelectorAll("tbody tr");
        filas.forEach(fila => {
            const celdas = fila.querySelectorAll("td");
            const nombre = celdas[0]?.querySelector("input")?.value.trim() || "";
            const dosis = celdas[1]?.querySelector("input")?.value.trim() || "";
            const horarios = Array.from(celdas)
                .slice(2, -1) // desde columna 2 hasta la penúltima
                .map(td => td.querySelector("input")?.value.trim() || "");
            data.push([`${nombre} ${dosis}`, ...horarios]);
        });

        doc.autoTable({
            startY: 50,
            head: [["Medicamento / Dosis", "Mañana", "Mediodía", "Tarde", "Noche"]],
            body: data,
            styles: {
                halign: 'center',
                valign: 'middle',
                fontSize: 11,
                lineWidth: 0.2,
                lineColor: [180, 180, 180]
            },
            headStyles: {
                fillColor: [180, 210, 255],
                textColor: 20,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 250, 255]
            },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 25 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 }
            },
            didDrawCell: function (data) {
                const colIndex = data.column.index;
                const columnasHorario = ["mañana", "mediodía", "tarde", "noche"];
                const textoColumna = data.column.raw?.toLowerCase();

                if (colIndex === 1) {
                    data.cell.styles.lineLeftWidth = 0;
                }

                if (columnasHorario.includes(textoColumna)) {
                    doc.setDrawColor(160);
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                    doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                }

                if (data.section === 'body' || data.section === 'head') {
                    data.cell.styles.lineWidth = 0;
                }
            },
            tableLineWidth: 0,
            tableLineColor: 255
        });

        // 5. Anotaciones
        const anotaciones = document.querySelector("textarea")?.value.trim();
        if (anotaciones) {
            doc.setFontSize(10);
            doc.text("Anotaciones:", 10, doc.lastAutoTable.finalY + 10);
            const lines = doc.splitTextToSize(anotaciones, 180);
            doc.text(lines, 10, doc.lastAutoTable.finalY + 18);
        }

        // 6. Pie de página
        doc.setFontSize(12);
        doc.setTextColor(100);
        const pieTexto = "SERVICIO DE CARDIOLOGIA - CEMA";
        const pieLineas = doc.splitTextToSize(pieTexto, 180);
        const pieY = 285 - (pieLineas.length - 1) * 6;
        doc.text(pieLineas, 105, pieY, { align: "center" });

        // 7. Guardar PDF
        const filename = `Medicacion${nombre.replace(/ /g, "-") || "paciente"}.pdf`;
        doc.save(filename);
    };
});



document.getElementById("btnReceta")?.addEventListener("click", () => {
  const cantidadMeses = parseInt(prompt("¿Cuántos meses de receta desea emitir?", "3")) || 1;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: "a4", orientation: "landscape" });

  const nombre = document.getElementById("nombrePaciente").textContent.trim();
  const dni = document.getElementById("dniPaciente").textContent.trim();
  const baseFecha = new Date();

  const filas = document.querySelectorAll("#tablaMedicacion tbody tr");
  const grupos = [];
  for (let i = 0; i < filas.length; i += 2) {
    grupos.push([filas[i], filas[i + 1]].filter(Boolean));
  }

  const anchoReceta = 95;
  const margenIzq = 10;
  let recetaIndex = 0;

  const generarReceta = (grupo, colIndex, fechaTexto) => {
    const posX = margenIzq + colIndex * anchoReceta;
    const posY = 15;

    const logo = new Image();
    logo.src = "logo_cema.png";
    logo.onload = () => {
      doc.addImage(logo, "PNG", posX + 25, posY, 40, 20);
      doc.setFontSize(10);
      doc.text(`Paciente: ${nombre}`, posX, posY + 28);
      doc.text(`DNI: ${dni}`, posX, posY + 35);
      doc.setFontSize(11);
      doc.text("Rp:", posX, posY + 47);

      grupo.forEach((fila, idx) => {
        const cols = fila.querySelectorAll("input");
        const nombreMed = cols[0]?.value.trim();
        let dosis = cols[1]?.value.trim();
        if (dosis && !dosis.toLowerCase().includes("mg")) dosis += " mg";
        if (nombreMed && dosis) {
          doc.text(`• ${nombreMed} ${dosis} x 30 comp`, posX + 5, posY + 57 + idx * 10);
        }
      });

      doc.setFontSize(10);
      doc.text("Diagnóstico: FRCV", posX, posY + 82);
      doc.text(`Fecha: ${fechaTexto}`, posX, posY + 89);

      const firma = new Image();
      firma.src = "firma_digital.png";
      firma.onload = () => {
        doc.addImage(firma, "PNG", posX + 40, posY + 75, 45, 25);

        recetaIndex++;
        if (recetaIndex < grupos.length * cantidadMeses) {
          if (recetaIndex % 3 === 0) {
            doc.addPage();
          }

          const colNueva = recetaIndex % 3;
          const grupoReal = grupos[Math.floor(recetaIndex / cantidadMeses)];
          const nuevaFecha = new Date(baseFecha);
          nuevaFecha.setMonth(baseFecha.getMonth() + (recetaIndex % cantidadMeses));
          const fechaTextoNueva = nuevaFecha.toLocaleDateString("es-AR");

          generarReceta(grupoReal, colNueva, fechaTextoNueva);
        } else {
          window.open(doc.output("bloburl"), "_blank");
        }
      };
    };
  };

  if (grupos.length > 0) {
    generarReceta(grupos[0], 0, baseFecha.toLocaleDateString("es-AR"));
  }
});
