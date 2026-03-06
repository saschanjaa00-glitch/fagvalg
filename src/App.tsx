import { useState } from 'react';
import type { ParsedFile, ColumnMapping, StandardField, SubjectCount } from './utils/excelUtils';
import { mergeFiles, tallySubjects, autoDetectMapping, exportToExcel } from './utils/excelUtils';
import './App.css';
import { FileUploader } from './components/FileUploader';
import { ColumnMapper } from './components/ColumnMapper';
import { MergedDataView } from './components/MergedDataView';
import { SubjectTally } from './components/SubjectTally';

function App() {
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [mappings, setMappings] = useState<Map<string, ColumnMapping>>(new Map());
  const [mergedData, setMergedData] = useState<StandardField[]>([]);
  const [subjects, setSubjects] = useState<SubjectCount[]>([]);
  
  const [uploadedFilesExpanded, setUploadedFilesExpanded] = useState(false);
  const [columnMapperExpanded, setColumnMapperExpanded] = useState(false);
  const [mergedDataExpanded, setMergedDataExpanded] = useState(false);
  const [subjectTallyExpanded, setSubjectTallyExpanded] = useState(false);
  const [warningExpanded, setWarningExpanded] = useState(false);

  const handleFilesAdded = (files: ParsedFile[]) => {
    setParsedFiles((prev) => [...prev, ...files]);
    
    // Auto-detect and apply mappings for new files
    const newMappings = new Map(mappings);
    files.forEach((file) => {
      const autoMapping = autoDetectMapping(file.columns);
      newMappings.set(file.id, autoMapping);
    });
    setMappings(newMappings);
  };

  const handleMappingChange = (fileId: string, mapping: ColumnMapping) => {
    const newMappings = new Map(mappings);
    newMappings.set(fileId, mapping);
    setMappings(newMappings);
  };

  const handleMerge = () => {
    const merged = mergeFiles(parsedFiles, mappings);
    setMergedData(merged);
    setSubjects(tallySubjects(merged));
  };

  const handleReset = () => {
    setParsedFiles([]);
    setMappings(new Map());
    setMergedData([]);
    setSubjects([]);
  };

  const handleRemoveFile = (fileId: string) => {
    setParsedFiles((prev) => prev.filter((f) => f.id !== fileId));
    const newMappings = new Map(mappings);
    newMappings.delete(fileId);
    setMappings(newMappings);
  };

  const handleExport = () => {
    exportToExcel(mergedData, 'merged_students.xlsx');
  };

  // Get students with less than 3 blokkfag
  const getStudentsWithFewSubjects = () => {
    return mergedData.filter(student => {
      const blokkCount = [
        student.blokk1,
        student.blokk2,
        student.blokk3,
        student.blokk4
      ].filter(blokk => blokk && blokk.trim() !== '').length;
      return blokkCount < 3;
    });
  };

  const studentsWithFewSubjects = getStudentsWithFewSubjects();

  return (
    <div className="app">
      <header className="header">
        <h1>Excel File Merger</h1>
        <p>Merge multiple Excel files and map columns to standard fields</p>
      </header>

      <main className="main">
        <FileUploader onFilesAdded={handleFilesAdded} />

        {parsedFiles.length > 0 && (
          <>
            <div className="uploaded-files">
              <h3 
                className="collapsible-header" 
                onClick={() => setUploadedFilesExpanded(!uploadedFilesExpanded)}
              >
                <span className="chevron">{uploadedFilesExpanded ? '▼' : '►'}</span>
                Uploaded Files ({parsedFiles.length})
              </h3>
              {uploadedFilesExpanded && (
                <ul>
                  {parsedFiles.map((file) => (
                    <li key={file.id}>
                      <span>{file.filename}</span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="remove-btn"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="column-mapper-section">
              <h3 
                className="collapsible-header" 
                onClick={() => setColumnMapperExpanded(!columnMapperExpanded)}
              >
                <span className="chevron">{columnMapperExpanded ? '▼' : '►'}</span>
                Map Columns
              </h3>
              {columnMapperExpanded && (
                <ColumnMapper 
                  files={parsedFiles} 
                  onMappingChange={handleMappingChange}
                  currentMappings={mappings}
                />
              )}
            </div>

            <div className="action-buttons">
              <button onClick={handleMerge} className="merge-btn">
                Merge Data
              </button>
              <button onClick={handleReset} className="reset-btn">
                Reset All
              </button>
            </div>
          </>
        )}

        {mergedData.length > 0 && (
          <>
            <div className="action-buttons">
              <button onClick={handleExport} className="export-btn">
                Export to Excel
              </button>
            </div>
            
            {studentsWithFewSubjects.length > 0 && (
              <div className="warning-box">
                <h3 
                  className="collapsible-header warning-header" 
                  onClick={() => setWarningExpanded(!warningExpanded)}
                >
                  <span className="chevron">{warningExpanded ? '▼' : '►'}</span>
                  ⚠️ Warning: {studentsWithFewSubjects.length} student{studentsWithFewSubjects.length !== 1 ? 's' : ''} with less than 3 blokkfag
                </h3>
                {warningExpanded && (
                  <div className="warning-content">
                    <ul>
                      {studentsWithFewSubjects.map((student, idx) => {
                        const blokkCount = [
                          student.blokk1,
                          student.blokk2,
                          student.blokk3,
                          student.blokk4
                        ].filter(blokk => blokk && blokk.trim() !== '').length;
                        const subjects = [
                          student.blokk1,
                          student.blokk2,
                          student.blokk3,
                          student.blokk4
                        ].filter(blokk => blokk && blokk.trim() !== '');
                        return (
                          <li key={idx}>
                            <strong>{student.navn || 'Unknown'}</strong> ({student.klasse || 'No class'}) - {blokkCount} subject{blokkCount !== 1 ? 's' : ''}: {subjects.join(', ') || 'None'}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="merged-data-section">
              <h3 
                className="collapsible-header" 
                onClick={() => setMergedDataExpanded(!mergedDataExpanded)}
              >
                <span className="chevron">{mergedDataExpanded ? '▼' : '►'}</span>
                Merged Student Data ({mergedData.length} students)
              </h3>
              {mergedDataExpanded && (
                <MergedDataView data={mergedData} />
              )}
            </div>
            
            <div className="subject-tally-section">
              <h3 
                className="collapsible-header" 
                onClick={() => setSubjectTallyExpanded(!subjectTallyExpanded)}
              >
                <span className="chevron">{subjectTallyExpanded ? '▼' : '►'}</span>
                Subject Tally ({subjects.length} subjects)
              </h3>
              {subjectTallyExpanded && (
                <SubjectTally subjects={subjects} mergedData={mergedData} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
