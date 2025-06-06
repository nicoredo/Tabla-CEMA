
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

document.getElementById("btnPDF")?.addEventListener("click", async () => {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const logo = new Image();
    logo.src = chrome.runtime.getURL("logo_cema.png");

    logo.onload = () => {
      doc.addImage(logo, 'PNG', 80, 10, 50, 15); // Logo centrado
      generarTablaPDF(doc, true); // abrir en nueva pestaña
    };

    logo.onerror = () => {
      console.warn("❌ No se pudo cargar el logo. Se genera PDF sin logo.");
      generarTablaPDF(doc, true);
    };
  } catch (e) {
    console.error("❌ Error generando PDF:", e);
  }
});


function generarTablaPDF(doc, abrirEnPestania = false) {
  const nombre = document.getElementById("nombrePaciente").innerText;
  const dni = document.getElementById("dniPaciente").innerText;
  const filas = Array.from(document.querySelectorAll("#tbodyMedicacion tr")).map(tr => {
    const celdas = tr.querySelectorAll("input");
return [
  `${celdas[0]?.value || ""} ${celdas[1]?.value || ""}`.trim(), // Medicamento + Mg
  celdas[2]?.value || "", // Mañana
  celdas[3]?.value || "", // Mediodía
  celdas[4]?.value || "", // Tarde
  celdas[5]?.value || "", // Noche
];

  });

  doc.setFontSize(12);
  doc.text(`Paciente: ${nombre}`, 20, 35);
  doc.text(`DNI: ${dni}`, 20, 42);

  doc.autoTable({
    startY: 50,
  head: [["Medicamento (dosis)", "Mañana", "Mediodía", "Tarde", "Noche"]],
    body: filas,
    styles: { halign: 'center' }
  });

  if (abrirEnPestania) {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  } else {
    doc.save(`Receta_${nombre || 'paciente'}.pdf`);
  }
}

// recetas

document.getElementById("btnReceta")?.addEventListener("click", () => {
  mostrarDialogoRecetaExtendido((cantidadMeses, incluirTabla) => {
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
            if (recetaIndex % 3 === 0) doc.addPage();

            const colNueva = recetaIndex % 3;
            const grupoReal = grupos[Math.floor(recetaIndex / cantidadMeses)];
            const nuevaFecha = new Date(baseFecha);
            nuevaFecha.setMonth(baseFecha.getMonth() + (recetaIndex % cantidadMeses));
            const fechaTextoNueva = nuevaFecha.toLocaleDateString("es-AR");

            generarReceta(grupoReal, colNueva, fechaTextoNueva);
          } else {
            window.open(doc.output("bloburl"), "_blank");

            if (incluirTabla) {
              const docTabla = new jsPDF();
              const logo = new Image();
              logo.src = chrome.runtime.getURL("logo.png");
              logo.onload = () => {
                docTabla.addImage(logo, 'PNG', 80, 10, 50, 15);
                generarTablaPDF(docTabla, true);
              };
              logo.onerror = () => {
                generarTablaPDF(docTabla, true);
              };
            }
          }
        };
      };
    };

    if (grupos.length > 0) {
      generarReceta(grupos[0], 0, baseFecha.toLocaleDateString("es-AR"));
    }
  });
});

function mostrarDialogoRecetaExtendido(callback) {
  const contenedor = document.createElement("div");
  contenedor.innerHTML = `
    <div style="
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #e6f3ff; padding: 20px; border-radius: 12px;
        border: 2px solid #007acc; z-index: 10000;
        box-shadow: 0 0 15px rgba(0,0,0,0.2); width: 320px;
        font-family: 'Segoe UI', sans-serif; color: #003b5c;
    ">
      <h3 style="margin-top: 0;">Generar receta</h3>
      <label for="mesesReceta">¿Cuántos meses?</label>
      <input type="number" id="mesesReceta" min="1" max="12" value="3"
        style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #ccc; margin: 8px 0 12px;" />
      
      <label style="display:flex; align-items:center; margin-bottom: 16px;">
        <input type="checkbox" id="incluirTabla" style="margin-right: 8px;" />
        Imprimir tabla de medicación
      </label>
      
      <div style="text-align: right;">
        <button id="btnCancelarReceta" style="
          background: #ff4d4d; color: white; border: none;
          padding: 6px 12px; border-radius: 6px; margin-right: 10px; cursor: pointer;
        ">Cancelar</button>
        
        <button id="btnAceptarReceta" style="
          background: #28a745; color: white; border: none;
          padding: 6px 12px; border-radius: 6px; cursor: pointer;
        ">Aceptar</button>
      </div>
    </div>
  `;
  document.body.appendChild(contenedor);

  document.getElementById("btnCancelarReceta").onclick = () => contenedor.remove();
  document.getElementById("btnAceptarReceta").onclick = () => {
    const meses = parseInt(document.getElementById("mesesReceta").value) || 1;
    const incluirTabla = document.getElementById("incluirTabla").checked;
    contenedor.remove();
    callback(meses, incluirTabla);
  };
}

