import * as XLSX from 'xlsx';
import { mapSubjectToCode } from './subjectCodeMapping';

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

        // Third pass: get Reserve columns
        blockHeaders.forEach((header, idx) => {
          if (header && header.toLowerCase().includes('reserve')) {
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
  blokk5: string | null;
  blokk6: string | null;
  blokk7: string | null;
  blokk8: string | null;
  reserve: string | null;
}

export const getBlokkFields = (count: number): string[] => {
  const fields: string[] = [];
  for (let i = 1; i <= Math.min(count, 8); i++) {
    fields.push(`blokk${i}`);
  }
  return fields;
};

// Auto-detect column mappings based on column names
export const autoDetectMapping = (columns: string[], blokkCount: number = 4): ColumnMapping => {
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
    else if (colLower.includes('blokk')) {
      // Extract number from blokk header
      const match = colLower.match(/blokk(\d+)/);
      if (match) {
        const blokkNum = parseInt(match[1]);
        if (blokkNum > 0 && blokkNum <= blokkCount) {
          mapping[col] = `blokk${blokkNum}`;
        }
      }
    }
    // Map Reserve columns
    else if (colLower.includes('reserve')) {
      mapping[col] = 'reserve';
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
        blokk5: null,
        blokk6: null,
        blokk7: null,
        blokk8: null,
        reserve: null,
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

/**
 * Export merged data as a tab-separated text file with student numbers and subject codes
 */
export const exportToTabText = (mergedData: StandardField[], filename: string = 'merged_students.txt') => {
  // Create data rows with student number starting from 1001 and mapped subject codes
  const rows = mergedData.map((row, index) => {
    const studentNumber = (1001 + index).toString();
    const navn = row.navn || '';
    const klasse = row.klasse || '';
    const blokk1 = row.blokk1 ? mapSubjectToCode(row.blokk1) : '';
    const blokk2 = row.blokk2 ? mapSubjectToCode(row.blokk2) : '';
    const blokk3 = row.blokk3 ? mapSubjectToCode(row.blokk3) : '';
    const blokk4 = row.blokk4 ? mapSubjectToCode(row.blokk4) : '';
    
    return [studentNumber, navn, klasse, blokk1, blokk2, blokk3, blokk4];
  });
  
  // Join each row with tabs
  const textContent = rows.map(row => row.join('\t')).join('\n');
  
  // Create a Blob and trigger download
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
