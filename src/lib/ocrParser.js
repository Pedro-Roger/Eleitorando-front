export function parseTitleOcr(text) {
  const result = { nome: '', dataNascimento: '', titleNumber: '', zona: '', secao: '', municipio: '', uf: '' };

  // Normalize: collapse whitespace, remove extra spaces
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split into lines for line-by-line processing
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cleaned = line.trim();

    // --- Name: "NOME DO ELEITOR" label ---
    if (!result.nome) {
      const nomeMatch = cleaned.match(/^(?:NOME\s+DO\s+ELEITOR|NOME\s+DO\s+ELEITORA)\s*[:\-]?\s*(.+)$/i);
      if (nomeMatch) {
        result.nome = nomeMatch[1].trim();
        continue;
      }
    }

    // --- Date of birth ---
    if (!result.dataNascimento) {
      const dobMatch = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dobMatch) {
        result.dataNascimento = `${dobMatch[1]}/${dobMatch[2]}/${dobMatch[3]}`;
      }
    }

    // --- Title number (INSCRIÇÃO) ---
    if (!result.titleNumber) {
      const titleMatch = cleaned.match(/INSCRIÇÃO\s*[:\-]?\s*(\d{10,14})/i);
      if (titleMatch) {
        result.titleNumber = titleMatch[1];
        continue;
      }
    }

    // --- Zone ---
    if (!result.zona) {
      const zonaMatch = cleaned.match(/ZONA\s*[:\-]?\s*(\d+)/i);
      if (zonaMatch) {
        result.zona = zonaMatch[1];
        continue;
      }
    }

    // --- Section ---
    if (!result.secao) {
      const secaoMatch = cleaned.match(/SE[ÇC][ÃA]O\s*[:\-]?\s*(\d+)/i);
      if (secaoMatch) {
        result.secao = secaoMatch[1];
        continue;
      }
    }

    // --- Municipality / UF ---
    if (!result.municipio) {
      const cityMatch = cleaned.match(/^([A-ZÀ-ÿ\s]+)\s*\/\s*(SP|MG|RJ|ES|BA|PR|RS|SC|MS|MT|GO|DF|PA|AM|AP|AC|AL|PB|PE|PI|CE|RN|SE|RO|RR|TO|MA|PA)\s*$/i);
      if (cityMatch) {
        result.municipio = cityMatch[1].trim();
        result.uf = cityMatch[2].toUpperCase();
        continue;
      }
    }
  }

  // Fallback: if name wasn't found via label, try to find it as the first substantial text line
  if (!result.nome) {
    for (const line of lines) {
      const cleaned = line.trim();
      // Skip lines that are clearly labels, numbers, or headers
      if (
        /^(REPÚBLICA|FEDERATIVA|DO|BRASIL|TÍTULO|ELEITORAL|NOME|CÓDIGO|DATA|NASCIMENTO|INSCRIÇÃO|ZONA|SEÇÃO|MUNICÍPIO|UF|EMISSÃO|impresso|autenticidade|página|Tribunal|Superior|Eleitoral|internet|endereço|www|tse|jus|br|Orientações|Estarão|aptos|votar|eleitores|eleitoras|regulares|maiores|dezesseis|anos|data|turno|único|eleição|biometria|coletada|A\s+autenticidade|poderá|ser|confirmada|na|página|do|Tribunal|Superior|Eleitoral|na|internet|no|endereço|por meio|do|código|de|validação|ou|Code)/i.test(cleaned)
      ) {
        continue;
      }
      // Skip pure numbers
      if (/^\d+$/.test(cleaned)) continue;
      // Skip short lines
      if (cleaned.length < 3) continue;
      // Skip lines that are mostly numbers (like date or title number)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) continue;
      if (/^\d{10,14}$/.test(cleaned)) continue;
      // Skip lines that are just zone/section numbers
      if (/^\d{1,4}$/.test(cleaned)) continue;

      // This is likely the name
      result.nome = cleaned;
      break;
    }
  }

  return result;
}
