
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
      const posY = 30;

      const logo = new Image();
      logo.src = "logo_cema.png";
      logo.onload = () => {
        doc.addImage(logo, "PNG", posX + 20, posY, 50, 25);
        doc.setFontSize(11);
        doc.text(`Paciente: ${nombre}`, posX, posY + 32);
        doc.text(`DNI: ${dni}`, posX, posY + 40);
        doc.setFontSize(13);
        doc.text("Rp:", posX, posY + 55);

        grupo.forEach((fila, idx) => {
          const cols = fila.querySelectorAll("input");
          const nombreMed = cols[0]?.value.trim();
          let dosis = cols[1]?.value.trim();
          if (dosis && !dosis.toLowerCase().includes("mg")) dosis += " mg";
          if (nombreMed && dosis) {
            doc.setFontSize(11);
            doc.text(`• ${nombreMed} ${dosis} x 30 comp`, posX + 5, posY + 67 + idx * 12);
          }
        });

        doc.setFontSize(10);
        doc.text("Diagnóstico: FRCV", posX, posY + 100);
        doc.text(`Fecha: ${fechaTexto}`, posX, posY + 108);

        const firma = new Image();
        firma.src = "firma_digital.png";
        firma.onload = () => {
          doc.addImage(firma, "PNG", posX + 40, posY + 112, 45, 25);

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
