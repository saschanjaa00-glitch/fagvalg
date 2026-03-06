import { useState } from 'react';
import type { SubjectCount, StandardField } from '../utils/excelUtils';
import * as XLSX from 'xlsx';
import styles from './SubjectTally.module.css';

interface SubjectTallyProps {
  subjects: SubjectCount[];
  mergedData: StandardField[];
  subjectMaxByName: Record<string, number>;
  onSaveSubjectMaxByName: (values: Record<string, number>) => void;
}

interface StudentInBlokk {
  navn: string;
  klasse: string;
  blokk: string;
}

const DEFAULT_MAX_PER_SUBJECT = 30;

export const SubjectTally = ({ subjects, mergedData, subjectMaxByName, onSaveSubjectMaxByName }: SubjectTallyProps) => {
  const [markOverfilled, setMarkOverfilled] = useState(false);
  const [showOverfillModal, setShowOverfillModal] = useState(false);
  const [massUpdateMax, setMassUpdateMax] = useState(String(DEFAULT_MAX_PER_SUBJECT));
  const [draftSubjectMaxByName, setDraftSubjectMaxByName] = useState<Record<string, string>>({});

  const getSavedMax = (subject: string): number => {
    return subjectMaxByName[subject] ?? DEFAULT_MAX_PER_SUBJECT;
  };

  const openOverfillModal = () => {
    const draft: Record<string, string> = {};
    subjects.forEach((item) => {
      draft[item.subject] = String(getSavedMax(item.subject));
    });
    setDraftSubjectMaxByName(draft);
    setMassUpdateMax(String(DEFAULT_MAX_PER_SUBJECT));
    setShowOverfillModal(true);
  };

  const applyMassUpdate = () => {
    const parsed = Number.parseInt(massUpdateMax, 10);
    const safeValue = Number.isNaN(parsed) ? DEFAULT_MAX_PER_SUBJECT : Math.max(0, parsed);

    setDraftSubjectMaxByName((prev) => {
      const next = { ...prev };
      subjects.forEach((item) => {
        next[item.subject] = String(safeValue);
      });
      return next;
    });
  };

  const saveOverfillSettings = () => {
    const nextValues: Record<string, number> = { ...subjectMaxByName };

    subjects.forEach((item) => {
      const raw = draftSubjectMaxByName[item.subject] ?? String(DEFAULT_MAX_PER_SUBJECT);
      const parsed = Number.parseInt(raw, 10);
      nextValues[item.subject] = Number.isNaN(parsed) ? DEFAULT_MAX_PER_SUBJECT : Math.max(0, parsed);
    });

    onSaveSubjectMaxByName(nextValues);
    setShowOverfillModal(false);
  };

  // Get students for a specific subject with blokk information
  const getStudentsForSubject = (subject: string): StudentInBlokk[] => {
    const students: StudentInBlokk[] = [];
    
    mergedData.forEach((student) => {
      ['blokk1', 'blokk2', 'blokk3', 'blokk4'].forEach((blokkKey) => {
        const blokkValue = student[blokkKey as keyof StandardField];
        if (blokkValue && typeof blokkValue === 'string') {
          const subjects = blokkValue.split(/[,;]/).map((s) => s.trim()).filter((s) => s);
          if (subjects.includes(subject)) {
            students.push({
              navn: student.navn || 'Ukjent',
              klasse: student.klasse || 'Ingen klasse',
              blokk: blokkKey.replace('blokk', 'Blokk ')
            });
          }
        }
      });
    });
    
    return students;
  };

  // Get count of students per blokk for a subject
  const getSubjectBlokkBreakdown = (subject: string) => {
    const blokkCounts = {
      'Blokk 1': 0,
      'Blokk 2': 0,
      'Blokk 3': 0,
      'Blokk 4': 0
    };

    mergedData.forEach((student) => {
      if (student.blokk1?.split(/[,;]/).map(s => s.trim()).includes(subject)) blokkCounts['Blokk 1']++;
      if (student.blokk2?.split(/[,;]/).map(s => s.trim()).includes(subject)) blokkCounts['Blokk 2']++;
      if (student.blokk3?.split(/[,;]/).map(s => s.trim()).includes(subject)) blokkCounts['Blokk 3']++;
      if (student.blokk4?.split(/[,;]/).map(s => s.trim()).includes(subject)) blokkCounts['Blokk 4']++;
    });

    return blokkCounts;
  };

  // Export students for a specific subject
  const exportSubject = (subject: string) => {
    const students = getStudentsForSubject(subject);
    
    const exportData = students.map((student) => ({
      'Navn': student.navn,
      'Klasse': student.klasse,
      'Blokk': student.blokk
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Elever');
    XLSX.writeFile(workbook, `${subject.replace(/[^a-z0-9]/gi, '_')}_students.xlsx`);
  };

  const exportTable = () => {
    const exportData = subjects.map((item) => {
      const blokkBreakdown = getSubjectBlokkBreakdown(item.subject);
      return {
        Fag: item.subject,
        'Blokk 1': blokkBreakdown['Blokk 1'],
        'Blokk 2': blokkBreakdown['Blokk 2'],
        'Blokk 3': blokkBreakdown['Blokk 3'],
        'Blokk 4': blokkBreakdown['Blokk 4'],
        Totalt: item.count,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fagoversikt');
    XLSX.writeFile(workbook, 'subject_tally.xlsx');
  };

  if (subjects.length === 0) {
    return <div className={styles.empty}>Ingen fag funnet</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          className={styles.exportTableBtn}
          onClick={exportTable}
          title="Eksporter fagoversiktstabell"
        >
          Eksport tabell
        </button>
        <button
          className={`${styles.overfillBtn} ${markOverfilled ? styles.overfillBtnActive : ''}`.trim()}
          onClick={() => setMarkOverfilled((prev) => !prev)}
          title="Veksle fremheving av overfylte"
        >
          Merk overfylte
        </button>
        <button
          className={styles.settingsBtn}
          onClick={openOverfillModal}
          title="Overfyllingsinnstillinger"
        >
          Instillinger
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fag</th>
            <th>Blokk 1</th>
            <th>Blokk 2</th>
            <th>Blokk 3</th>
            <th>Blokk 4</th>
            <th>Totalt</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((item) => {
            const blokkBreakdown = getSubjectBlokkBreakdown(item.subject);
            const maxForSubject = getSavedMax(item.subject);
            const blokk1Over = blokkBreakdown['Blokk 1'] > maxForSubject;
            const blokk2Over = blokkBreakdown['Blokk 2'] > maxForSubject;
            const blokk3Over = blokkBreakdown['Blokk 3'] > maxForSubject;
            const blokk4Over = blokkBreakdown['Blokk 4'] > maxForSubject;
            const subjectOver = blokk1Over || blokk2Over || blokk3Over || blokk4Over;
            
            return (
              <tr key={item.subject}>
                <td className={markOverfilled && subjectOver ? styles.overfilledSubject : undefined}>{item.subject}</td>
                <td className={markOverfilled && blokk1Over ? styles.overfilledCell : undefined}>{blokkBreakdown['Blokk 1']}</td>
                <td className={markOverfilled && blokk2Over ? styles.overfilledCell : undefined}>{blokkBreakdown['Blokk 2']}</td>
                <td className={markOverfilled && blokk3Over ? styles.overfilledCell : undefined}>{blokkBreakdown['Blokk 3']}</td>
                <td className={markOverfilled && blokk4Over ? styles.overfilledCell : undefined}>{blokkBreakdown['Blokk 4']}</td>
                <td className={styles.totalCell}>{item.count}</td>
                <td>
                  <button
                    className={styles.exportBtn}
                    onClick={() => exportSubject(item.subject)}
                    title="Eksporter elevliste"
                  >
                    Eksporter
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showOverfillModal && (
        <div className={styles.modalOverlay} onClick={() => setShowOverfillModal(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h4>Merk overfylt</h4>
            <div className={styles.massUpdateRow}>
              <label htmlFor="mass-update-max">Masseoppdater maks</label>
              <input
                id="mass-update-max"
                type="number"
                min="0"
                value={massUpdateMax}
                onChange={(event) => setMassUpdateMax(event.target.value)}
                className={styles.maxInput}
              />
              <button type="button" className={styles.modalSecondaryBtn} onClick={applyMassUpdate}>
                Bruk på alle
              </button>
            </div>

            <div className={styles.modalTableWrap}>
              <table className={styles.modalTable}>
                <thead>
                  <tr>
                    <th>Fag</th>
                    <th>Maks</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => (
                    <tr key={item.subject}>
                      <td>{item.subject}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={draftSubjectMaxByName[item.subject] ?? String(DEFAULT_MAX_PER_SUBJECT)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraftSubjectMaxByName((prev) => ({
                              ...prev,
                              [item.subject]: value,
                            }));
                          }}
                          className={styles.maxInput}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalSecondaryBtn}
                onClick={() => setShowOverfillModal(false)}
              >
                Avbryt
              </button>
              <button type="button" className={styles.modalPrimaryBtn} onClick={saveOverfillSettings}>
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
