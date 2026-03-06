import type { StandardField } from '../utils/excelUtils';
import styles from './MergedDataView.module.css';

interface MergedDataViewProps {
  data: StandardField[];
}

export const MergedDataView = ({ data }: MergedDataViewProps) => {
  if (data.length === 0) {
    return <div className={styles.empty}>No data merged yet</div>;
  }

  return (
    <div className={styles.view}>
      <h2>Merged Student Data</h2>
      <p>Total students: {data.length}</p>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Klasse</th>
              <th>Blokk 1</th>
              <th>Blokk 2</th>
              <th>Blokk 3</th>
              <th>Blokk 4</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                <td>{row.navn || '-'}</td>
                <td>{row.klasse || '-'}</td>
                <td>{row.blokk1 || '-'}</td>
                <td>{row.blokk2 || '-'}</td>
                <td>{row.blokk3 || '-'}</td>
                <td>{row.blokk4 || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
