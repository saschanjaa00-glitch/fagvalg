import { useState } from 'react';
import type { SubjectCount, StandardField } from '../utils/excelUtils';
import * as XLSX from 'xlsx';
import styles from './SubjectTally.module.css';

interface SubjectTallyProps {
  subjects: SubjectCount[];
  mergedData: StandardField[];
}

interface StudentInBlokk {
  navn: string;
  klasse: string;
  blokk: string;
}

export const SubjectTally = ({ subjects, mergedData }: SubjectTallyProps) => {
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  const toggleExpand = (subject: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(subject)) {
      newExpanded.delete(subject);
    } else {
      newExpanded.add(subject);
    }
    setExpandedSubjects(newExpanded);
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
              navn: student.navn || 'Unknown',
              klasse: student.klasse || 'No class',
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `${subject.replace(/[^a-z0-9]/gi, '_')}_students.xlsx`);
  };
  if (subjects.length === 0) {
    return <div className={styles.empty}>No subjects found</div>;
  }

  return (
    <div className={styles.tally}>
      <h2>Subject Tally</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Student Count</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((item) => {
            const isExpanded = expandedSubjects.has(item.subject);
            const blokkBreakdown = getSubjectBlokkBreakdown(item.subject);
            
            return (
              <>
                <tr key={item.subject}>
                  <td>
                    <button
                      className={styles.expandBtn}
                      onClick={() => toggleExpand(item.subject)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      <span className={styles.chevron}>{isExpanded ? '▼' : '►'}</span>
                    </button>
                    {item.subject}
                  </td>
                  <td>{item.count}</td>
                  <td>
                    <button
                      className={styles.exportBtn}
                      onClick={() => exportSubject(item.subject)}
                      title="Export student list"
                    >
                      Export
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={styles.expandedRow}>
                    <td colSpan={3}>
                      <div className={styles.blokkBreakdown}>
                        <strong>Students per Blokk:</strong>
                        <ul>
                          {Object.entries(blokkBreakdown).map(([blokk, count]) => (
                            <li key={blokk}>
                              {blokk}: {count} student{count !== 1 ? 's' : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
