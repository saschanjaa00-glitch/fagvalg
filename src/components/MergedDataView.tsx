import { useState } from 'react';
import type { StandardField } from '../utils/excelUtils';
import { getBlokkFields } from '../utils/excelUtils';
import styles from './MergedDataView.module.css';

interface MergedDataViewProps {
  data: StandardField[];
  totalDataCount: number;
  selectedSubject: string;
  onSubjectFilterChange: (subject: string) => void;
  subjectOptions: string[];
  blokkCount: number;
}

export const MergedDataView = ({
  data,
  totalDataCount,
  selectedSubject,
  onSubjectFilterChange,
  subjectOptions,
  blokkCount
}: MergedDataViewProps) => {
  const [showReserve, setShowReserve] = useState(true);
  const blokkFields = getBlokkFields(blokkCount);
  
  const initializeColumnFilters = () => {
    const filters: Record<string, string[]> = {
      navn: [],
      klasse: [],
      reserve: [],
    };
    blokkFields.forEach(field => {
      filters[field] = [];
    });
    return filters;
  };

  const initializeFilterInputs = () => {
    const inputs: Record<string, string> = {
      navn: '',
      klasse: '',
      reserve: '',
    };
    blokkFields.forEach(field => {
      inputs[field] = '';
    });
    return inputs;
  };

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(initializeColumnFilters());
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>(initializeFilterInputs());

  const addFilter = (column: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed && !columnFilters[column].includes(trimmed)) {
      setColumnFilters(prev => ({
        ...prev,
        [column]: [...prev[column], trimmed]
      }));
      setFilterInputs(prev => ({
        ...prev,
        [column]: ''
      }));
    }
  };

  const removeFilter = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: prev[column].filter(f => f !== value)
    }));
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, column: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFilter(column, filterInputs[column]);
    }
  };

  const columnMatches = (cellValue: string | null, filters: string[]): boolean => {
    if (filters.length === 0) return true;
    if (!cellValue) return false;
    return filters.some(filter =>
      cellValue.toLowerCase().includes(filter.toLowerCase())
    );
  };

  const filteredData = data.filter(row => {
    const baseMatch =
      columnMatches(row.navn, columnFilters.navn) &&
      columnMatches(row.klasse, columnFilters.klasse) &&
      columnMatches(row.reserve, columnFilters.reserve);
    
    if (!baseMatch) return false;
    
    // Check dynamic blokk fields
    for (const field of blokkFields) {
      const value = row[field as keyof StandardField] as string | null;
      if (!columnMatches(value, columnFilters[field])) {
        return false;
      }
    }
    
    return true;
  });

  const renderSubjectCell = (value: string | null) => {
    if (!value) {
      return '-';
    }

    if (!selectedSubject) {
      return value;
    }

    const parts = value.split(/([,;])/);

    return (
      <>
        {parts.map((part, idx) => {
          const trimmed = part.trim();
          const isSeparator = trimmed === ',' || trimmed === ';' || part === ',' || part === ';';
          const isMatch = !isSeparator
            && trimmed !== ''
            && trimmed.localeCompare(selectedSubject, 'nb', { sensitivity: 'base' }) === 0;

          if (isMatch) {
            return (
              <strong key={idx} className={styles.highlightSubject}>
                {part}
              </strong>
            );
          }

          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  };

  return (
    <div className={styles.view}>
      <div className={styles.filterRow}>
        <label htmlFor="subject-filter" className={styles.filterLabel}>
          Filtrer etter fag:
        </label>
        <select
          id="subject-filter"
          className={styles.filterSelect}
          value={selectedSubject}
          onChange={(event) => onSubjectFilterChange(event.target.value)}
        >
          <option value="">Alle fag</option>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>
      <p>Totalt antall elever vist: {filteredData.length} / {totalDataCount}</p>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Klasse</th>
              {blokkFields.map((field) => (
                <th key={field}>{field.charAt(0).toUpperCase() + field.slice(1)}</th>
              ))}
              <th className={styles.reserveHeaderCell}>
                <button
                  className={styles.reserveToggle}
                  onClick={() => setShowReserve(!showReserve)}
                  title={showReserve ? 'Skjul reservefag' : 'Vis reservefag'}
                >
                  {showReserve ? '▼' : '▶'}
                </button>
                <span>Reserve</span>
              </th>
            </tr>
            <tr className={styles.filterRow2}>
              <td>
                <div className={styles.filterInputWrapper}>
                  <input
                    type="text"
                    className={styles.columnFilter}
                    placeholder="Filter..."
                    value={filterInputs.navn}
                    onChange={(e) => setFilterInputs(prev => ({ ...prev, navn: e.target.value }))}
                    onKeyDown={(e) => handleFilterKeyDown(e, 'navn')}
                  />
                  {columnFilters.navn.length > 0 && (
                    <div className={styles.filterChips}>
                      {columnFilters.navn.map((filter) => (
                        <span key={filter} className={styles.chip}>
                          {filter}
                          <button
                            className={styles.chipRemove}
                            onClick={() => removeFilter('navn', filter)}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className={styles.filterInputWrapper}>
                  <input
                    type="text"
                    className={styles.columnFilter}
                    placeholder="Filter..."
                    value={filterInputs.klasse}
                    onChange={(e) => setFilterInputs(prev => ({ ...prev, klasse: e.target.value }))}
                    onKeyDown={(e) => handleFilterKeyDown(e, 'klasse')}
                  />
                  {columnFilters.klasse.length > 0 && (
                    <div className={styles.filterChips}>
                      {columnFilters.klasse.map((filter) => (
                        <span key={filter} className={styles.chip}>
                          {filter}
                          <button
                            className={styles.chipRemove}
                            onClick={() => removeFilter('klasse', filter)}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              {blokkFields.map((field) => (
                <td key={field}>
                  <div className={styles.filterInputWrapper}>
                    <input
                      type="text"
                      className={styles.columnFilter}
                      placeholder="Filter..."
                      value={filterInputs[field]}
                      onChange={(e) => setFilterInputs(prev => ({ ...prev, [field]: e.target.value }))}
                      onKeyDown={(e) => handleFilterKeyDown(e, field)}
                    />
                    {columnFilters[field].length > 0 && (
                      <div className={styles.filterChips}>
                        {columnFilters[field].map((filter) => (
                          <span key={filter} className={styles.chip}>
                            {filter}
                            <button
                              className={styles.chipRemove}
                              onClick={() => removeFilter(field, filter)}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              ))}
              <td>
                {showReserve && (
                  <div className={styles.filterInputWrapper}>
                    <input
                      type="text"
                      className={styles.columnFilter}
                      placeholder="Filter..."
                      value={filterInputs.reserve}
                      onChange={(e) => setFilterInputs(prev => ({ ...prev, reserve: e.target.value }))}
                      onKeyDown={(e) => handleFilterKeyDown(e, 'reserve')}
                    />
                    {columnFilters.reserve.length > 0 && (
                      <div className={styles.filterChips}>
                        {columnFilters.reserve.map((filter) => (
                          <span key={filter} className={styles.chip}>
                            {filter}
                            <button
                              className={styles.chipRemove}
                              onClick={() => removeFilter('reserve', filter)}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={2 + blokkFields.length + (showReserve ? 1 : 0)} className={styles.emptyRow}>
                  Ingen elever matcher de valgte filtrene
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.navn || '-'}</td>
                  <td>{row.klasse || '-'}</td>
                  {blokkFields.map((field) => (
                    <td key={field}>
                      {renderSubjectCell(row[field as keyof StandardField] as string | null)}
                    </td>
                  ))}
                  {showReserve && (
                    <td className={styles.reserveCell}>{row.reserve || '-'}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
