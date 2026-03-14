import { useEffect, useMemo, useState } from 'react';
import type { StandardField, StudentAssignmentChange } from '../utils/excelUtils';
import styles from './EleverView.module.css';

type StudentFilter = 'all' | 'missing' | 'overloaded' | 'collisions' | 'duplicates';

interface EleverViewProps {
  data: StandardField[];
  blokkCount: number;
  subjectOptions: string[];
  changeLog: StudentAssignmentChange[];
  onStudentDataUpdate: (updatedData: StandardField[], changes: StudentAssignmentChange[]) => void;
}

interface AssignmentEntry {
  subject: string;
  blokkNumber: number;
}

interface ExistingSubjectGroups {
  subject: string;
  blokker: Set<number>;
}

const parseSubjects = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[,;]/)
    .map((subject) => subject.trim())
    .filter((subject) => subject.length > 0);
};

const isSameSubject = (left: string, right: string): boolean => {
  return left.localeCompare(right, 'nb', { sensitivity: 'base' }) === 0;
};

const getBlokkKey = (blokkNumber: number): keyof StandardField => {
  return `blokk${blokkNumber}` as keyof StandardField;
};

const getStudentId = (student: StandardField, index: number): string => {
  return student.studentId || `${student.navn || 'ukjent'}:${student.klasse || 'ukjent'}:${index}`;
};

const extractAssignments = (student: StandardField, blokkCount: number): AssignmentEntry[] => {
  const entries: AssignmentEntry[] = [];

  for (let blokkNumber = 1; blokkNumber <= blokkCount; blokkNumber += 1) {
    const field = getBlokkKey(blokkNumber);
    const value = student[field];
    const subjects = parseSubjects(typeof value === 'string' ? value : null);

    subjects.forEach((subject) => {
      entries.push({ subject, blokkNumber });
    });
  }

  return entries;
};

const hasMissingSubjects = (student: StandardField, blokkCount: number): boolean => {
  const assignments = extractAssignments(student, blokkCount).filter((entry) => entry.blokkNumber <= 4);
  const uniqueBlokker = new Set(assignments.map((entry) => entry.blokkNumber));
  return uniqueBlokker.size < 3;
};

const hasTooManySubjects = (student: StandardField, blokkCount: number): boolean => {
  const assignments = extractAssignments(student, blokkCount).filter((entry) => entry.blokkNumber <= 4);
  return assignments.length >= 4;
};

const hasBlokkCollisions = (student: StandardField, blokkCount: number): boolean => {
  const assignments = extractAssignments(student, blokkCount).filter((entry) => entry.blokkNumber <= 4);
  const byBlokk = new Map<number, number>();

  assignments.forEach((entry) => {
    byBlokk.set(entry.blokkNumber, (byBlokk.get(entry.blokkNumber) || 0) + 1);
  });

  return Array.from(byBlokk.values()).some((count) => count > 1);
};

const hasDuplicateSubjects = (student: StandardField, blokkCount: number): boolean => {
  const assignments = extractAssignments(student, blokkCount);
  const seen = new Set<string>();

  for (const assignment of assignments) {
    const normalized = assignment.subject.toLocaleLowerCase('nb');
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }

  return false;
};

const matchesSearch = (student: StandardField, query: string, index: number): boolean => {
  const trimmedQuery = query.trim().toLocaleLowerCase('nb');
  if (!trimmedQuery) {
    return true;
  }

  const id = getStudentId(student, index).toLocaleLowerCase('nb');
  const navn = (student.navn || '').toLocaleLowerCase('nb');
  const klasse = (student.klasse || '').toLocaleLowerCase('nb');

  return navn.includes(trimmedQuery) || klasse.includes(trimmedQuery) || id.includes(trimmedQuery);
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getTargetBlokker = (currentBlokk: number, blokkCount: number): number[] => {
  return Array.from({ length: blokkCount }, (_, index) => index + 1).filter((blokk) => blokk !== currentBlokk);
};

export const EleverView = ({
  data,
  blokkCount,
  subjectOptions,
  changeLog,
  onStudentDataUpdate,
}: EleverViewProps) => {
  const [studentQuery, setStudentQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<StudentFilter>('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [blokkToAdd, setBlokkToAdd] = useState('1');
  const [statusMessage, setStatusMessage] = useState('');
  const [moveTargetsByAssignment, setMoveTargetsByAssignment] = useState<Record<string, string>>({});

  const studentSummaries = useMemo(() => {
    return data.map((student, index) => {
      const assignments = extractAssignments(student, blokkCount);
      const studentId = getStudentId(student, index);
      return {
        student,
        index,
        studentId,
        assignments,
        missing: hasMissingSubjects(student, blokkCount),
        overloaded: hasTooManySubjects(student, blokkCount),
        collisions: hasBlokkCollisions(student, blokkCount),
        duplicates: hasDuplicateSubjects(student, blokkCount),
      };
    });
  }, [data, blokkCount]);

  const existingSubjectGroups = useMemo(() => {
    const groups: ExistingSubjectGroups[] = [];

    data.forEach((student) => {
      const assignments = extractAssignments(student, blokkCount);
      assignments.forEach((assignment) => {
        const existing = groups.find((entry) => isSameSubject(entry.subject, assignment.subject));
        if (existing) {
          existing.blokker.add(assignment.blokkNumber);
          return;
        }

        groups.push({
          subject: assignment.subject,
          blokker: new Set([assignment.blokkNumber]),
        });
      });
    });

    return groups;
  }, [data, blokkCount]);

  const getExistingTargetBlokker = (subject: string, currentBlokk: number): number[] => {
    const allOtherBlokker = getTargetBlokker(currentBlokk, blokkCount);
    const existingForSubject = existingSubjectGroups.find((entry) => isSameSubject(entry.subject, subject));

    if (!existingForSubject) {
      return [];
    }

    return allOtherBlokker.filter((blokk) => existingForSubject.blokker.has(blokk));
  };

  const counts = useMemo(() => {
    return {
      missing: studentSummaries.filter((entry) => entry.missing).length,
      overloaded: studentSummaries.filter((entry) => entry.overloaded).length,
      collisions: studentSummaries.filter((entry) => entry.collisions).length,
      duplicates: studentSummaries.filter((entry) => entry.duplicates).length,
    };
  }, [studentSummaries]);

  const filteredStudents = useMemo(() => {
    return studentSummaries.filter((entry) => {
      if (!matchesSearch(entry.student, studentQuery, entry.index)) {
        return false;
      }

      if (activeFilter === 'missing') {
        return entry.missing;
      }
      if (activeFilter === 'overloaded') {
        return entry.overloaded;
      }
      if (activeFilter === 'collisions') {
        return entry.collisions;
      }
      if (activeFilter === 'duplicates') {
        return entry.duplicates;
      }

      return true;
    });
  }, [activeFilter, studentQuery, studentSummaries]);

  useEffect(() => {
    if (filteredStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }

    const stillVisible = filteredStudents.some((entry) => entry.studentId === selectedStudentId);
    if (!stillVisible) {
      setSelectedStudentId(filteredStudents[0].studentId);
    }
  }, [filteredStudents, selectedStudentId]);

  useEffect(() => {
    setMoveTargetsByAssignment({});
  }, [selectedStudentId]);

  const selectedStudentEntry = useMemo(() => {
    return filteredStudents.find((entry) => entry.studentId === selectedStudentId) || null;
  }, [filteredStudents, selectedStudentId]);

  const selectedStudentChanges = useMemo(() => {
    if (!selectedStudentEntry) {
      return [];
    }

    return changeLog
      .filter((change) => change.studentId === selectedStudentEntry.studentId)
      .slice()
      .reverse()
      .slice(0, 12);
  }, [changeLog, selectedStudentEntry]);

  const applyStatusMessage = (message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => {
      setStatusMessage('');
    }, 2500);
  };

  const handleRemoveAssignment = (subject: string, blokkNumber: number) => {
    if (!selectedStudentEntry) {
      return;
    }

    const nextData = data.map((student, index) => {
      const currentId = getStudentId(student, index);
      if (currentId !== selectedStudentEntry.studentId) {
        return student;
      }

      const blokkKey = getBlokkKey(blokkNumber);
      const existingSubjects = parseSubjects(student[blokkKey] as string | null);
      let removed = false;
      const remainingSubjects = existingSubjects.filter((item) => {
        if (!removed && isSameSubject(item, subject)) {
          removed = true;
          return false;
        }
        return true;
      });

      return {
        ...student,
        [blokkKey]: remainingSubjects.length > 0 ? remainingSubjects.join(', ') : null,
      };
    });

    const change: StudentAssignmentChange = {
      studentId: selectedStudentEntry.studentId,
      navn: selectedStudentEntry.student.navn || 'Ukjent',
      klasse: selectedStudentEntry.student.klasse || 'Ingen klasse',
      subject,
      fromBlokk: blokkNumber,
      toBlokk: 0,
      reason: `Elever: fjernet ${subject} fra Blokk ${blokkNumber}`,
      changedAt: new Date().toISOString(),
    };

    onStudentDataUpdate(nextData, [change]);
    applyStatusMessage(`${subject} fjernet fra Blokk ${blokkNumber}`);
  };

  const handleAddSubject = () => {
    if (!selectedStudentEntry) {
      return;
    }

    const normalizedSubject = subjectToAdd.trim();
    const blokkNumber = Number.parseInt(blokkToAdd, 10);

    if (!normalizedSubject) {
      applyStatusMessage('Skriv inn eller velg et fag først');
      return;
    }

    if (Number.isNaN(blokkNumber) || blokkNumber < 1 || blokkNumber > blokkCount) {
      applyStatusMessage('Velg en gyldig blokk');
      return;
    }

    const alreadyAssigned = selectedStudentEntry.assignments.some((assignment) =>
      isSameSubject(assignment.subject, normalizedSubject)
    );

    if (alreadyAssigned) {
      applyStatusMessage('Eleven har allerede dette faget');
      return;
    }

    const nextData = data.map((student, index) => {
      const currentId = getStudentId(student, index);
      if (currentId !== selectedStudentEntry.studentId) {
        return student;
      }

      const blokkKey = getBlokkKey(blokkNumber);
      const existingSubjects = parseSubjects(student[blokkKey] as string | null);

      return {
        ...student,
        [blokkKey]: [...existingSubjects, normalizedSubject].join(', '),
      };
    });

    const change: StudentAssignmentChange = {
      studentId: selectedStudentEntry.studentId,
      navn: selectedStudentEntry.student.navn || 'Ukjent',
      klasse: selectedStudentEntry.student.klasse || 'Ingen klasse',
      subject: normalizedSubject,
      fromBlokk: 0,
      toBlokk: blokkNumber,
      reason: `Elever: la til ${normalizedSubject} i Blokk ${blokkNumber}`,
      changedAt: new Date().toISOString(),
    };

    onStudentDataUpdate(nextData, [change]);
    setSubjectToAdd('');
    applyStatusMessage(`${normalizedSubject} lagt til i Blokk ${blokkNumber}`);
  };

  const handleMoveAssignment = (subject: string, fromBlokk: number, toBlokk: number) => {
    if (!selectedStudentEntry) {
      return;
    }

    const targetBlokker = getExistingTargetBlokker(subject, fromBlokk);
    if (targetBlokker.length === 0) {
      applyStatusMessage('Ingen eksisterende grupper tilgjengelig for dette faget i andre blokker');
      return;
    }

    if (!targetBlokker.includes(toBlokk)) {
      applyStatusMessage('Ugyldig blokkvalg');
      return;
    }

    const nextData = data.map((student, index) => {
      const currentId = getStudentId(student, index);
      if (currentId !== selectedStudentEntry.studentId) {
        return student;
      }

      const fromKey = getBlokkKey(fromBlokk);
      const toKey = getBlokkKey(toBlokk);
      const fromSubjects = parseSubjects(student[fromKey] as string | null);
      const toSubjects = parseSubjects(student[toKey] as string | null);

      let moved = false;
      const remainingSourceSubjects = fromSubjects.filter((item) => {
        if (!moved && isSameSubject(item, subject)) {
          moved = true;
          return false;
        }
        return true;
      });

      if (!moved) {
        return student;
      }

      return {
        ...student,
        [fromKey]: remainingSourceSubjects.length > 0 ? remainingSourceSubjects.join(', ') : null,
        [toKey]: [...toSubjects, subject].join(', '),
      };
    });

    const change: StudentAssignmentChange = {
      studentId: selectedStudentEntry.studentId,
      navn: selectedStudentEntry.student.navn || 'Ukjent',
      klasse: selectedStudentEntry.student.klasse || 'Ingen klasse',
      subject,
      fromBlokk,
      toBlokk,
      reason: `Elever: flyttet ${subject} fra Blokk ${fromBlokk} til Blokk ${toBlokk}`,
      changedAt: new Date().toISOString(),
    };

    onStudentDataUpdate(nextData, [change]);
    applyStatusMessage(`${subject} flyttet til Blokk ${toBlokk}`);
  };

  if (data.length === 0) {
    return <p className={styles.empty}>Ingen elevdata tilgjengelig.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterButton} ${activeFilter === 'all' ? styles.filterButtonActive : ''}`.trim()}
          onClick={() => setActiveFilter('all')}
        >
          Alle ({data.length})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${activeFilter === 'missing' ? styles.filterButtonActive : ''}`.trim()}
          onClick={() => setActiveFilter('missing')}
          disabled={counts.missing === 0}
        >
          Mangler fag ({counts.missing})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${activeFilter === 'overloaded' ? styles.filterButtonActive : ''}`.trim()}
          onClick={() => setActiveFilter('overloaded')}
          disabled={counts.overloaded === 0}
        >
          For mange fag ({counts.overloaded})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${activeFilter === 'collisions' ? styles.filterButtonActive : ''}`.trim()}
          onClick={() => setActiveFilter('collisions')}
          disabled={counts.collisions === 0}
        >
          Blokk-kollisjoner ({counts.collisions})
        </button>
        <button
          type="button"
          className={`${styles.filterButton} ${activeFilter === 'duplicates' ? styles.filterButtonActive : ''}`.trim()}
          onClick={() => setActiveFilter('duplicates')}
          disabled={counts.duplicates === 0}
        >
          Duplikater ({counts.duplicates})
        </button>
      </div>

      <div className={styles.viewerGrid}>
        <aside className={styles.listPanel}>
          <input
            type="search"
            className={styles.searchInput}
            value={studentQuery}
            onChange={(event) => setStudentQuery(event.target.value)}
            placeholder="Sok elevnavn, klasse eller id"
          />

          <div className={styles.studentList}>
            {filteredStudents.map((entry) => (
              <button
                key={entry.studentId}
                type="button"
                className={`${styles.studentRow} ${entry.studentId === selectedStudentId ? styles.studentRowActive : ''}`.trim()}
                onClick={() => setSelectedStudentId(entry.studentId)}
              >
                <span className={styles.studentName}>{entry.student.navn || 'Ukjent elev'}</span>
                <small className={styles.studentMeta}>
                  {entry.student.klasse || 'Ingen klasse'} | {entry.assignments.length} fag
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.detailPanel}>
          {!selectedStudentEntry ? (
            <p className={styles.empty}>Ingen elever matcher filteret.</p>
          ) : (
            <>
              <div className={styles.studentHeader}>
                <div>
                  <h3>{selectedStudentEntry.student.navn || 'Ukjent elev'}</h3>
                  <p>{selectedStudentEntry.student.klasse || 'Ingen klasse'} | {selectedStudentEntry.studentId}</p>
                </div>
              </div>

              <div className={styles.addBar}>
                <input
                  type="text"
                  list="elever-subject-options"
                  value={subjectToAdd}
                  onChange={(event) => setSubjectToAdd(event.target.value)}
                  placeholder="Legg til fag"
                  className={styles.subjectInput}
                />
                <datalist id="elever-subject-options">
                  {subjectOptions.slice().sort((a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' })).map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
                <select
                  value={blokkToAdd}
                  onChange={(event) => setBlokkToAdd(event.target.value)}
                  className={styles.blokkSelect}
                >
                  {Array.from({ length: blokkCount }, (_, index) => index + 1).map((blokk) => (
                    <option key={blokk} value={String(blokk)}>
                      Blokk {blokk}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.addButton} onClick={handleAddSubject}>
                  Legg til
                </button>
              </div>

              {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}

              <table className={styles.assignmentTable}>
                <thead>
                  <tr>
                    <th>Fag</th>
                    <th>Blokk</th>
                    <th>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudentEntry.assignments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.emptyCell}>Ingen fag registrert</td>
                    </tr>
                  ) : (
                    selectedStudentEntry.assignments
                      .slice()
                      .sort((a, b) => {
                        if (a.blokkNumber !== b.blokkNumber) {
                          return a.blokkNumber - b.blokkNumber;
                        }
                        return a.subject.localeCompare(b.subject, 'nb', { sensitivity: 'base' });
                      })
                      .map((assignment, index) => {
                        const rowKey = `${assignment.subject}-${assignment.blokkNumber}-${index}`;
                        const targetBlokker = getExistingTargetBlokker(assignment.subject, assignment.blokkNumber);
                        const selectedTarget = moveTargetsByAssignment[rowKey] || String(targetBlokker[0] || '');

                        return (
                        <tr key={rowKey}>
                          <td>{assignment.subject}</td>
                          <td>Blokk {assignment.blokkNumber}</td>
                          <td className={styles.actionsCell}>
                            {targetBlokker.length > 0 && (
                              <>
                                <select
                                  className={styles.moveSelect}
                                  value={selectedTarget}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setMoveTargetsByAssignment((prev) => ({
                                      ...prev,
                                      [rowKey]: value,
                                    }));
                                  }}
                                  aria-label={`Velg ny blokk for ${assignment.subject}`}
                                >
                                  {targetBlokker.map((blokk) => (
                                    <option key={`${rowKey}-${blokk}`} value={String(blokk)}>
                                      Blokk {blokk}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className={styles.moveButton}
                                  onClick={() => handleMoveAssignment(assignment.subject, assignment.blokkNumber, Number.parseInt(selectedTarget, 10))}
                                  title={`Flytt ${assignment.subject} til valgt blokk`}
                                >
                                  Endre blokk
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => handleRemoveAssignment(assignment.subject, assignment.blokkNumber)}
                            >
                              Fjern
                            </button>
                          </td>
                        </tr>
                      )})
                  )}
                </tbody>
              </table>

              <div className={styles.logPanel}>
                <h4>Endringslogg ({selectedStudentChanges.length})</h4>
                {selectedStudentChanges.length === 0 ? (
                  <p className={styles.logEmpty}>Ingen endringer registrert for denne eleven ennå.</p>
                ) : (
                  <ul className={styles.logList}>
                    {selectedStudentChanges.map((change, index) => (
                      <li key={`${change.changedAt}-${index}`}>
                        <span>{change.reason}</span>
                        <small>{formatTimestamp(change.changedAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
