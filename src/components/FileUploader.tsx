import { useState } from 'react';
import type { ParsedFile } from '../utils/excelUtils';
import { parseExcelFile } from '../utils/excelUtils';
import styles from './FileUploader.module.css';

interface FileUploaderProps {
  onFilesAdded: (files: ParsedFile[]) => void;
}

export const FileUploader = ({ onFilesAdded }: FileUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isExcelFile = (file: File): boolean => {
    return (
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );
  };

  const processFiles = async (fileList: FileList) => {
    setError(null);
    setSuccessMessage(null);

    if (fileList.length === 0) {
      setError('No files selected. Please choose Excel files.');
      return;
    }

    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    // Validate files first
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!isExcelFile(file)) {
        invalidFiles.push(`"${file.name}" is not a valid Excel file (.xlsx or .xls)`);
      } else {
        validFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      setError(`Invalid files found:\n\n${invalidFiles.join('\n')}\n\nExpected: Excel files (.xlsx or .xls)`);
      return;
    }

    if (validFiles.length === 0) {
      setError('No valid Excel files found. Please select .xlsx or .xls files.');
      return;
    }

    setIsLoading(true);
    try {
      const parsedFiles: ParsedFile[] = [];
      const failedFiles: string[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          const parsed = await parseExcelFile(file);
          parsedFiles.push(parsed);
        } catch (err) {
          failedFiles.push(`"${file.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (parsedFiles.length > 0) {
        onFilesAdded(parsedFiles);
        setSuccessMessage(`✓ Successfully loaded ${parsedFiles.length} file(s)`);
        
        if (failedFiles.length > 0) {
          setError(`Failed to parse:\n\n${failedFiles.join('\n')}`);
        }
      } else if (failedFiles.length > 0) {
        setError(`Failed to parse all files:\n\n${failedFiles.join('\n')}`);
      }
    } catch (err) {
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) return;
    await processFiles(files);
    event.currentTarget.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files) {
      setError('No files were dropped. Please try again.');
      return;
    }

    await processFiles(files);
  };

  return (
    <div className={styles.uploader}>
      <h2>Upload Excel Files</h2>
      
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className={styles.uploadLabel}>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isLoading}
            className={styles.input}
          />
          <span className={styles.button}>
            {isLoading ? 'Processing...' : 'Choose Files'}
          </span>
        </label>
        <p className={styles.info}>
          Or drag and drop Excel files here
        </p>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <strong>❌ Error:</strong>
          <pre>{error}</pre>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          {successMessage}
        </div>
      )}
    </div>
  );
};
