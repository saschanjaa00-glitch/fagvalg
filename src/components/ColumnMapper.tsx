import type { ParsedFile, ColumnMapping } from '../utils/excelUtils';
import styles from './ColumnMapper.module.css';

interface ColumnMapperProps {
  files: ParsedFile[];
  onMappingChange: (fileId: string, mapping: ColumnMapping) => void;
  currentMappings: Map<string, ColumnMapping>;
}

const STANDARD_FIELDS = ['navn', 'klasse', 'blokk1', 'blokk2', 'blokk3', 'blokk4'];
const FIELD_LABELS: Record<string, string> = {
  navn: 'Navn (Name)',
  klasse: 'Klasse (Class)',
  blokk1: 'Blokk 1',
  blokk2: 'Blokk 2',
  blokk3: 'Blokk 3',
  blokk4: 'Blokk 4',
};

export const ColumnMapper = ({ files, onMappingChange, currentMappings }: ColumnMapperProps) => {
  // Create reverse mapping: standardField -> fileColumn
  const getReverseMapping = (fileMapping: ColumnMapping): Record<string, string | null> => {
    const reverse: Record<string, string | null> = {};
    Object.entries(fileMapping).forEach(([fileColumn, standardField]) => {
      if (standardField) {
        reverse[standardField] = fileColumn;
      }
    });
    return reverse;
  };

  const handleMappingChange = (fileId: string, field: string, fileColumn: string | null) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    const mapping: ColumnMapping = {};
    
    // Initialize mapping - set all columns to null first
    file.columns.forEach((col) => {
      mapping[col] = null;
    });
    
    // Copy existing mappings for other fields
    const currentMapping = currentMappings.get(fileId) || {};
    Object.entries(currentMapping).forEach(([col, field]) => {
      if (field && field !== null) {
        mapping[col] = field;
      }
    });
    
    // Update the mapping for this field
    if (fileColumn) {
      // Remove this field from any other column first
      Object.keys(mapping).forEach((col) => {
        if (mapping[col] === field) {
          mapping[col] = null;
        }
      });
      // Set the new mapping
      mapping[fileColumn] = field;
    }
    
    onMappingChange(fileId, mapping);
  };

  return (
    <div className={styles.mapper}>
      <h2>Map Columns</h2>
      <p>Columns have been auto-detected. You can adjust the mappings if needed:</p>
      
      {files.map((file) => {
        const fileMapping = currentMappings.get(file.id) || {};
        const reverseMapping = getReverseMapping(fileMapping);
        
        return (
          <div key={file.id} className={styles.fileSection}>
            <h3>{file.filename}</h3>
            <div className={styles.mappingGrid}>
              {STANDARD_FIELDS.map((field) => (
                <div key={field} className={styles.mappingRow}>
                  <label>{FIELD_LABELS[field]}</label>
                  <select
                    value={reverseMapping[field] || ''}
                    onChange={(e) => handleMappingChange(file.id, field, e.target.value || null)}
                    className={styles.select}
                  >
                    <option value="">-- Not mapped --</option>
                    {file.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
