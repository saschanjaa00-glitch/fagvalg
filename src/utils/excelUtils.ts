import * as XLSX from 'xlsx';

export interface ParsedFile {
  id: string;
  filename: string;
  columns: string[];
  data: Record<string, string>[];
}

export const parseExcelFile = async (file: File): Promise<ParsedFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Read all rows as arrays first
        const allRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 }) as string[][];
        
        if (allRows.length < 6) {
          reject(new Error('Excel file must have at least 6 rows (headers in rows 4-5, data starts from row 6)'));
          return;
        }
        
        // Row 4 (index 3) contains Blokk headers
        const blockHeaders = allRows[3] || [];
        // Row 5 (index 4) contains Navn and Klasse headers
        const mainHeaders = allRows[4] || [];
        
        // Combine headers: look for Navn, Klasse first, then Blokk columns
        const headers: string[] = [];
        const columnMapping: (number | null)[] = []; // Map to original column index
        
        // First pass: get Navn and Klasse columns
        mainHeaders.forEach((header, idx) => {
          if (header && (header.toLowerCase().includes('navn') || header.toLowerCase() === 'klasse')) {
            headers.push(header);
            columnMapping.push(idx);
          }
        });
        
        // Second pass: get Blokk columns
        blockHeaders.forEach((header, idx) => {
          if (header && header.toLowerCase().includes('blokk')) {
            headers.push(header);
            columnMapping.push(idx);
          }
        });
        
        // Data starts from row 6 (index 5)
        const jsonData: Record<string, string>[] = [];
        for (let i = 5; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row || row.every((cell) => !cell)) {
            // Skip empty rows
            continue;
          }
          
          const dataRow: Record<string, string> = {};
          headers.forEach((header, headerIdx) => {
            const colIdx = columnMapping[headerIdx];
            if (colIdx !== null && colIdx !== undefined) {
              dataRow[header] = (row[colIdx] || '').toString();
            }
          });
          
          jsonData.push(dataRow);
        }
        
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          filename: file.name,
          columns: headers,
          data: jsonData,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export interface ColumnMapping {
  [key: string]: string | null; // fileColumn -> standardField
}

export interface StandardField {
  navn: string | null;
  klasse: string | null;
  blokk1: string | null;
  blokk2: string | null;
  blokk3: string | null;
  blokk4: string | null;
}

// Auto-detect column mappings based on column names
export const autoDetectMapping = (columns: string[]): ColumnMapping => {
  const mapping: ColumnMapping = {};
  
  columns.forEach((col) => {
    const colLower = col.toLowerCase();
    
    // Map Elevnavn to navn
    if (colLower.includes('elevnavn')) {
      mapping[col] = 'navn';
    }
    // Map Klasse to klasse
    else if (colLower === 'klasse') {
      mapping[col] = 'klasse';
    }
    // Map Blokk columns
    else if (colLower.includes('blokk1')) {
      mapping[col] = 'blokk1';
    }
    else if (colLower.includes('blokk2')) {
      mapping[col] = 'blokk2';
    }
    else if (colLower.includes('blokk3')) {
      mapping[col] = 'blokk3';
    }
    else if (colLower.includes('blokk4')) {
      mapping[col] = 'blokk4';
    }
    else {
      mapping[col] = null;
    }
  });
  
  return mapping;
};

// Progress class to next year (1STA -> 2STA, 2STA -> 3STA, etc.)
const progressClass = (klasse: string): string => {
  // Match patterns like "1STA", "2VG2", "3STB", etc.
  const match = klasse.match(/^(\d+)(.+)$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const suffix = match[2];
    return `${year + 1}${suffix}`;
  }
  return klasse; // Return unchanged if no match
};

export const mergeFiles = (
  files: ParsedFile[],
  mappings: Map<string, ColumnMapping>
): StandardField[] => {
  const merged: StandardField[] = [];
  
  files.forEach((file) => {
    const mapping = mappings.get(file.id) || {};
    
    file.data.forEach((row) => {
      const standardRow: StandardField = {
        navn: null,
        klasse: null,
        blokk1: null,
        blokk2: null,
        blokk3: null,
        blokk4: null,
      };
      
      Object.entries(row).forEach(([fileColumn, value]) => {
        const standardField = mapping[fileColumn];
        if (standardField && value) {
          standardRow[standardField as keyof StandardField] = value;
        }
      });
      
      // Progress class to next year
      if (standardRow.klasse) {
        standardRow.klasse = progressClass(standardRow.klasse);
      }
      
      // Only add if at least navn is present
      if (standardRow.navn) {
        merged.push(standardRow);
      }
    });
  });
  
  return merged;
};

export interface SubjectCount {
  subject: string;
  count: number;
}

export const tallySubjects = (mergedData: StandardField[]): SubjectCount[] => {
  const subjectMap = new Map<string, number>();
  
  mergedData.forEach((row) => {
    [row.blokk1, row.blokk2, row.blokk3, row.blokk4].forEach((blokk) => {
      if (blokk) {
        // Split by comma or semicolon if multiple subjects
        const subjects = blokk.split(/[,;]/).map((s) => s.trim()).filter((s) => s);
        subjects.forEach((subject) => {
          subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
        });
      }
    });
  });
  
  return Array.from(subjectMap.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
};

// Export merged data to Excel file
export const exportToExcel = (mergedData: StandardField[], filename: string = 'merged_students.xlsx') => {
  const exportData = mergedData.map((row) => ({
    'Navn': row.navn || '',
    'Klasse': row.klasse || '',
    'Blokk 1': row.blokk1 || '',
    'Blokk 2': row.blokk2 || '',
    'Blokk 3': row.blokk3 || '',
    'Blokk 4': row.blokk4 || '',
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];
  
  XLSX.writeFile(workbook, filename);
};
