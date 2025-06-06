
fetch(chrome.runtime.getURL('terminologia_medica.json'))
  .then(response => response.json())
  .then(terminologia => {
    console.log("✅ content.js cargado");

    function contieneNegacion(oracion, termino) {
      const negaciones = ["no", "niega", "sin", "ausencia de", "negativo para"];
      const afirmaciones = ["sí", "si", "presenta", "refiere", "con", "diagnosticado de"];
      const reversores = ["pero", "aunque", "sin embargo", "no obstante"];
      const separadores = /[,;]|(?:\bpero\b|\baunque\b|\bsin embargo\b|\bno obstante\b)/i;
      const partes = oracion.toLowerCase().split(separadores);
      const terminoLower = termino.toLowerCase();
      let negado = false;
      for (const parte of partes) {
        const palabras = parte.trim().split(/\s+/);
        for (let i = 0; i < palabras.length; i++) {
          const palabra = palabras[i];
          if (negaciones.includes(palabra)) {
            negado = true;
          } else if (afirmaciones.includes(palabra)) {
            negado = false;
          } else if (reversores.includes(palabra)) {
            negado = false;
          }
          if (palabra === terminoLower) {
            return negado;
          }
        }
      }
      return false;
    }

    function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // eliminación
        matrix[i][j - 1] + 1,       // inserción
        matrix[i - 1][j - 1] + costo // sustitución
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes
    .replace(/[\W_]+/g, " ")         // reemplaza signos por espacio
}

function buscarMedicamentos(texto) {
  const encontrados = new Set();
  const oraciones = texto.split(/(?<=[.!?\n])/);
  const combinadosDetectados = new Set();

  for (const oracion of oraciones) {
    const oracionNormalizada = normalizarTexto(oracion);

    for (const [base, sinonimos] of Object.entries(terminologia.medicacion)) {
      const patrones = [base, ...sinonimos];

      for (const termino of patrones) {
        const terminoNorm = normalizarTexto(termino);

        // 1. Match exacto sin negación
        if (oracionNormalizada.includes(terminoNorm) && !contieneNegacion(oracion, termino)) {
          encontrados.add(base);
        }
      }
    }

    // 2. Detección manual de combinaciones
    const combinaciones = oracionNormalizada.match(/\b([\w]+)\s*(\/|\+| y )\s*([\w]+)\b/gi);
    if (combinaciones) {
      for (const combinacion of combinaciones) {
        const compNorm = normalizarTexto(combinacion);
        combinadosDetectados.add(compNorm.replace(/\s+/g, ""));
      }
    }
  }

  // 3. Eliminar los componentes individuales si ya se encontró la combinación
  for (const combinado of combinadosDetectados) {
    const partes = combinado.split(/\/|\+|y/).map(p => p.trim());
    let contienePartes = partes.every(p =>
      Array.from(encontrados).some(e => normalizarTexto(e).includes(p))
    );
    if (contienePartes) {
      partes.forEach(p => {
        Array.from(encontrados).forEach(e => {
          if (normalizarTexto(e).includes(p)) {
            encontrados.delete(e);
          }
        });
      });
      encontrados.add(partes.join("/"));
    }
  }

  return Array.from(encontrados);
}


function extraerNombreYDNI() {
  const texto = document.body.innerText;

  // Separar por líneas reales
  const lineas = texto.split(/\n+/).map(l => l.trim()).filter(Boolean);

  let nombre = null;
  let dni = null;

  for (const linea of lineas) {
    // Buscar nombre en mayúsculas con coma
    if (!nombre && /^[A-ZÁÉÍÓÚÑ\s]+,\s*[A-ZÁÉÍÓÚÑ\s]+$/.test(linea)) {
      nombre = capitalizarNombre(linea.replace(',', '').trim());
    }

    // Buscar DNI en formato "DNI: 12345678"
    if (!dni && /DNI:\s*\d{6,9}/.test(linea)) {
      const match = linea.match(/DNI:\s*(\d{6,9})/);
      if (match) dni = match[1];
    }

    if (nombre && dni) break;
  }

  console.log("🧍 Nombre detectado:", nombre);
  console.log("🆔 DNI detectado:", dni);

  return { nombre, dni };
}

function capitalizarNombre(nombre) {
  return nombre
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// Test directo
const datos = extraerNombreYDNI();
alert(`Nombre: ${datos.nombre}\\nDNI: ${datos.dni}`);
   
function buscarMedicacionConDosis(texto) {
  const resultados = new Map();
  if (!texto) return [];

  for (const [base, sinonimos] of Object.entries(terminologia.medicacion)) {
    const patrones = [base, ...sinonimos];
    for (const termino of patrones) {
      const terminoEscapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // El grupo completo de dosis es opcional
      const pattern = `\\b${terminoEscapado}\\b(?:[^\\d\\n\\r]{0,10})?(?:\\s*(\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|g|ml|ug|u|unidades)?))?`;
      const expresion = new RegExp(pattern, "gi");

      let match;
      while ((match = expresion.exec(texto))) {
        if (!contieneNegacion(match[0], termino) && !resultados.has(base)) {
          const dosis = match[1] ? ` ${match[1].trim().replace(/\\s+/g, "")}` : "";
          resultados.set(base, `${base}${dosis}`);
          break;
        }
      }
    }
  }

  return Array.from(resultados.values());
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.tipo === 'popupListo') {
        console.log("📩 Recibido mensaje desde popup:", msg);
        try {
          const texto = document.body.innerText.toLowerCase();
          console.log("Texto clínico detectado:", texto.slice(0, 300));
          const medicamentos = buscarMedicacionConDosis(texto);
          const { nombreCompleto, dni } = extraerNombreYDNI();

          console.log("Medicamentos detectados:", medicamentos);
          console.log("Nombre:", nombreCompleto, "| DNI:", dni);

          chrome.runtime.sendMessage({
            tipo: 'datosPaciente',
            payload: {
              nombreCompleto,
              dni,
              medicamentos
            }
          });
        } catch (e) {
          console.error("❌ Error al extraer y enviar datos:", e);
        }
      }
    });
  })
  .catch(error => {
    console.error("❌ Error al cargar terminología médica:", error);
  });
