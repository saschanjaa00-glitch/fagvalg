import { useState } from 'react';
import type { SubjectCount, StandardField } from '../utils/excelUtils';
import { loadXlsx } from '../utils/excelUtils';
import styles from './SubjectTally.module.css';

interface SubjectTallyProps {
  subjects: SubjectCount[];
  mergedData: StandardField[];
  subjectSettingsByName: SubjectSettingsByName;
  onSaveSubjectSettingsByName: (values: SubjectSettingsByName) => void;
  onApplySubjectBlockMoves: (
    subject: string,
    operations: Array<
      | { type: 'move'; fromBlokk: number; toBlokk: number; reason: string }
      | { type: 'swap'; blokkA: number; blokkB: number; reason: string }
    >
  ) => void;
}

interface MathOptionCount {
  label: string;
  count: number;
}

type BlokkLabel = 'Blokk 1' | 'Blokk 2' | 'Blokk 3' | 'Blokk 4';

interface SubjectSettings {
  defaultMax: number;
  blokkMaxOverrides: Partial<Record<BlokkLabel, number>>;
  blokkEnabled: Partial<Record<BlokkLabel, boolean>>;
  blokkOrder: BlokkLabel[];
  extraGroupCounts?: Partial<Record<BlokkLabel, number>>;
}

export type SubjectSettingsByName = Record<string, SubjectSettings>;

interface SubjectDraft {
  defaultMax: string;
  blokkMaxOverrides: Partial<Record<BlokkLabel, string>>;
  blokkEnabled: Record<BlokkLabel, boolean>;
  blokkOrder: BlokkLabel[];
}

const DEFAULT_MAX_PER_SUBJECT = 30;
const BLOKK_LABELS: BlokkLabel[] = ['Blokk 1', 'Blokk 2', 'Blokk 3', 'Blokk 4'];

const buildDefaultSettings = (): SubjectSettings => ({
  defaultMax: DEFAULT_MAX_PER_SUBJECT,
  blokkMaxOverrides: {},
  blokkEnabled: {},
  blokkOrder: [...BLOKK_LABELS],
  extraGroupCounts: {},
});

const normalizeOrder = (order?: BlokkLabel[]): BlokkLabel[] => {
  return BLOKK_LABELS.map((label, index) => {
    const candidate = order?.[index];
    return candidate && BLOKK_LABELS.includes(candidate) ? candidate : label;
  });
};

const sanitizeCount = (value: string | number | undefined): number => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? DEFAULT_MAX_PER_SUBJECT : Math.max(0, value);
  }

  const parsed = Number.parseInt(value || '', 10);
  return Number.isNaN(parsed) ? DEFAULT_MAX_PER_SUBJECT : Math.max(0, parsed);
};

const getSettingsForSubject = (subjectSettingsByName: SubjectSettingsByName, subject: string): SubjectSettings => {
  const raw = subjectSettingsByName[subject];

  if (!raw) {
    return buildDefaultSettings();
  }

  return {
    defaultMax: sanitizeCount(raw.defaultMax),
    blokkMaxOverrides: { ...raw.blokkMaxOverrides },
    blokkEnabled: {
      'Blokk 1': raw.blokkEnabled?.['Blokk 1'],
      'Blokk 2': raw.blokkEnabled?.['Blokk 2'],
      'Blokk 3': raw.blokkEnabled?.['Blokk 3'],
      'Blokk 4': raw.blokkEnabled?.['Blokk 4'],
    },
    blokkOrder: normalizeOrder(raw.blokkOrder),
    extraGroupCounts: {
      'Blokk 1': Math.max(0, Math.floor(raw.extraGroupCounts?.['Blokk 1'] ?? 0)),
      'Blokk 2': Math.max(0, Math.floor(raw.extraGroupCounts?.['Blokk 2'] ?? 0)),
      'Blokk 3': Math.max(0, Math.floor(raw.extraGroupCounts?.['Blokk 3'] ?? 0)),
      'Blokk 4': Math.max(0, Math.floor(raw.extraGroupCounts?.['Blokk 4'] ?? 0)),
    },
  };
};

export const SubjectTally = ({
  subjects,
  mergedData,
  subjectSettingsByName,
  onSaveSubjectSettingsByName,
  onApplySubjectBlockMoves,
}: SubjectTallyProps) => {
  const [markOverfilled, setMarkOverfilled] = useState(false);
  const [showOverfillModal, setShowOverfillModal] = useState(false);
  const [massUpdateMax, setMassUpdateMax] = useState(String(DEFAULT_MAX_PER_SUBJECT));
  const [draftsBySubject, setDraftsBySubject] = useState<Record<string, SubjectDraft>>({});
  const [copiedSubject, setCopiedSubject] = useState<string | null>(null);
  const [draggedSubject, setDraggedSubject] = useState<string | null>(null);
  const [draggedBlokk, setDraggedBlokk] = useState<BlokkLabel | null>(null);
  const [draggedFromTarget, setDraggedFromTarget] = useState<BlokkLabel | null>(null);
  const [draggedIsExtra, setDraggedIsExtra] = useState(false);

  const blokkLabelToNumber = (label: BlokkLabel): number => {
    return Number.parseInt(label.replace('Blokk ', ''), 10);
  };

  const handleCopyTotal = async (subject: string, count: number) => {
    try {
      await navigator.clipboard.writeText(String(count));
      setCopiedSubject(subject);
      setTimeout(() => setCopiedSubject(null), 500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getBlokkBreakdown = (subject: string): Record<BlokkLabel, number> => {
    const blokkCounts: Record<BlokkLabel, number> = {
      'Blokk 1': 0,
      'Blokk 2': 0,
      'Blokk 3': 0,
      'Blokk 4': 0,
    };

    mergedData.forEach((student) => {
      if (student.blokk1?.split(/[,;]/).map((s) => s.trim()).includes(subject)) blokkCounts['Blokk 1']++;
      if (student.blokk2?.split(/[,;]/).map((s) => s.trim()).includes(subject)) blokkCounts['Blokk 2']++;
      if (student.blokk3?.split(/[,;]/).map((s) => s.trim()).includes(subject)) blokkCounts['Blokk 3']++;
      if (student.blokk4?.split(/[,;]/).map((s) => s.trim()).includes(subject)) blokkCounts['Blokk 4']++;
    });

    return blokkCounts;
  };

  const getEffectiveMax = (subject: string, blokk: BlokkLabel): number => {
    const settings = getSettingsForSubject(subjectSettingsByName, subject);
    const raw = settings.blokkMaxOverrides[blokk];

    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return Math.max(0, raw);
    }

    return settings.defaultMax;
  };

  const isBlokkEnabled = (
    subject: string,
    blokk: BlokkLabel,
    blokkBreakdown?: Record<BlokkLabel, number>
  ): boolean => {
    const settings = getSettingsForSubject(subjectSettingsByName, subject);
    const explicit = settings.blokkEnabled[blokk];
    if (typeof explicit === 'boolean') {
      return explicit;
    }

    const breakdown = blokkBreakdown ?? getBlokkBreakdown(subject);
    return breakdown[blokk] > 0;
  };

  const getOrderedBlokker = (subject: string, blokkBreakdown: Record<BlokkLabel, number>) => {
    const settings = getSettingsForSubject(subjectSettingsByName, subject);

    const placedByTarget: Record<BlokkLabel, Array<{
      id: string;
      source: BlokkLabel;
      count: number;
      enabled: boolean;
      hasExplicitEnabled: boolean;
      max: number;
      target: BlokkLabel;
      isExtra: boolean;
    }>> = {
      'Blokk 1': [],
      'Blokk 2': [],
      'Blokk 3': [],
      'Blokk 4': [],
    };

    BLOKK_LABELS.forEach((sourceBlokk, sourceIndex) => {
      const targetBlokk = settings.blokkOrder[sourceIndex] ?? sourceBlokk;
      const explicitEnabled = typeof settings.blokkEnabled[sourceBlokk] === 'boolean';
      placedByTarget[targetBlokk].push({
        id: `source-${sourceBlokk}`,
        source: sourceBlokk,
        count: blokkBreakdown[sourceBlokk],
        enabled: isBlokkEnabled(subject, sourceBlokk, blokkBreakdown),
        hasExplicitEnabled: explicitEnabled,
        max: getEffectiveMax(subject, sourceBlokk),
        target: targetBlokk,
        isExtra: false,
      });
    });

    BLOKK_LABELS.forEach((targetBlokk) => {
      const extraCount = Math.max(0, Math.floor(settings.extraGroupCounts?.[targetBlokk] ?? 0));
      for (let i = 0; i < extraCount; i++) {
        placedByTarget[targetBlokk].push({
          id: `extra-${targetBlokk}-${i + 1}`,
          source: targetBlokk,
          count: 0,
          enabled: true,
          hasExplicitEnabled: true,
          max: getEffectiveMax(subject, targetBlokk),
          target: targetBlokk,
          isExtra: true,
        });
      }
    });

    return placedByTarget;
  };

  const shouldShowPlacedEntry = (entry: {
    count: number;
    enabled: boolean;
    isExtra: boolean;
    hasExplicitEnabled: boolean;
  }) => {
    if (entry.isExtra) {
      return true;
    }

    if (entry.count > 0) {
      return true;
    }

    if (entry.enabled) {
      return true;
    }

    // Keep explicitly user-managed empty groups visible, but hide implicit empty groups from import.
    return entry.hasExplicitEnabled;
  };

  const getActiveTotal = (subject: string, blokkBreakdown: Record<BlokkLabel, number>): number => {
    return BLOKK_LABELS.reduce((sum, blokk) => {
      if (!isBlokkEnabled(subject, blokk, blokkBreakdown)) {
        return sum;
      }
      return sum + blokkBreakdown[blokk];
    }, 0);
  };

  const exportTable = async () => {
    const XLSX = await loadXlsx();
    const exportData = subjects.map((item) => {
      const blokkBreakdown = getBlokkBreakdown(item.subject);
      const placedByTarget = getOrderedBlokker(item.subject, blokkBreakdown);

      const formatGroupCell = (entries: Array<{
        count: number;
        enabled: boolean;
        isExtra: boolean;
        hasExplicitEnabled: boolean;
      }>) => {
        const visibleEntries = entries.filter(shouldShowPlacedEntry);
        if (visibleEntries.length === 0) {
          return '';
        }

        const activeCount = visibleEntries.reduce((sum, entry) => sum + (entry.enabled ? entry.count : 0), 0);
        const groupSuffix = visibleEntries.length > 1 ? ` (${visibleEntries.length} grp)` : '';

        if (activeCount === 0) {
          return `0${groupSuffix} (av)`;
        }

        return `${activeCount}${groupSuffix}`;
      };

      return {
        Fag: item.subject,
        Gruppe1: formatGroupCell(placedByTarget['Blokk 1']),
        Gruppe2: formatGroupCell(placedByTarget['Blokk 2']),
        Gruppe3: formatGroupCell(placedByTarget['Blokk 3']),
        Gruppe4: formatGroupCell(placedByTarget['Blokk 4']),
        TotaltAktive: getActiveTotal(item.subject, blokkBreakdown),
        TotaltOriginalt: item.count,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fagoversikt');
    XLSX.writeFile(workbook, 'subject_tally.xlsx');
  };

  const extractMathOptionsFromBlokkMat = (value: string | null): Set<'2P' | 'S1' | 'R1'> => {
    const selected = new Set<'2P' | 'S1' | 'R1'>();

    if (!value) {
      return selected;
    }

    value
      .split(/[,;/]/)
      .map((part) => part.trim().toUpperCase().replace(/\s+/g, ''))
      .filter((part) => part.length > 0)
      .forEach((part) => {
        if (part.includes('2P')) {
          selected.add('2P');
        }
        if (part.includes('S1')) {
          selected.add('S1');
        }
        if (part.includes('R1')) {
          selected.add('R1');
        }
      });

    return selected;
  };

  const countMathOption = (option: '2P' | 'S1' | 'R1'): number => {
    return mergedData.reduce((count, student) => {
      const selected = extractMathOptionsFromBlokkMat(student.blokkmatvg2);
      return count + (selected.has(option) ? 1 : 0);
    }, 0);
  };

  const mathOptionCounts: MathOptionCount[] = [
    {
      label: 'Matematikk 2P',
      count: countMathOption('2P'),
    },
    {
      label: 'Matematikk S1',
      count: countMathOption('S1'),
    },
    {
      label: 'Matematikk R1',
      count: countMathOption('R1'),
    },
  ];

  const openOverfillModal = () => {
    const nextDrafts: Record<string, SubjectDraft> = {};

    subjects.forEach((item) => {
      const saved = getSettingsForSubject(subjectSettingsByName, item.subject);
      const breakdown = getBlokkBreakdown(item.subject);
      nextDrafts[item.subject] = {
        defaultMax: String(saved.defaultMax),
        blokkMaxOverrides: {
          'Blokk 1': saved.blokkMaxOverrides['Blokk 1'] !== undefined ? String(saved.blokkMaxOverrides['Blokk 1']) : '',
          'Blokk 2': saved.blokkMaxOverrides['Blokk 2'] !== undefined ? String(saved.blokkMaxOverrides['Blokk 2']) : '',
          'Blokk 3': saved.blokkMaxOverrides['Blokk 3'] !== undefined ? String(saved.blokkMaxOverrides['Blokk 3']) : '',
          'Blokk 4': saved.blokkMaxOverrides['Blokk 4'] !== undefined ? String(saved.blokkMaxOverrides['Blokk 4']) : '',
        },
        blokkEnabled: {
          'Blokk 1': saved.blokkEnabled['Blokk 1'] ?? breakdown['Blokk 1'] > 0,
          'Blokk 2': saved.blokkEnabled['Blokk 2'] ?? breakdown['Blokk 2'] > 0,
          'Blokk 3': saved.blokkEnabled['Blokk 3'] ?? breakdown['Blokk 3'] > 0,
          'Blokk 4': saved.blokkEnabled['Blokk 4'] ?? breakdown['Blokk 4'] > 0,
        },
        blokkOrder: [...saved.blokkOrder],
      };
    });

    setDraftsBySubject(nextDrafts);
    setMassUpdateMax(String(DEFAULT_MAX_PER_SUBJECT));
    setShowOverfillModal(true);
  };

  const applyMassUpdate = () => {
    const safeValue = sanitizeCount(massUpdateMax);

    setDraftsBySubject((prev) => {
      const next = { ...prev };
      subjects.forEach((item) => {
        const draft = next[item.subject];
        if (!draft) {
          return;
        }
        next[item.subject] = {
          ...draft,
          defaultMax: String(safeValue),
        };
      });
      return next;
    });
  };

  const resetOverridesToDefault = () => {
    setDraftsBySubject((prev) => {
      const next = { ...prev };
      subjects.forEach((item) => {
        const draft = next[item.subject];
        if (!draft) {
          return;
        }
        next[item.subject] = {
          ...draft,
          blokkMaxOverrides: {
            'Blokk 1': '',
            'Blokk 2': '',
            'Blokk 3': '',
            'Blokk 4': '',
          },
        };
      });
      return next;
    });
  };

  const saveOverfillSettings = () => {
    const nextValues: SubjectSettingsByName = { ...subjectSettingsByName };

    subjects.forEach((item) => {
      const draft = draftsBySubject[item.subject];
      if (!draft) {
        return;
      }

      const current = getSettingsForSubject(subjectSettingsByName, item.subject);

      const defaultMax = sanitizeCount(draft.defaultMax);
      const parsedOverrides: Partial<Record<BlokkLabel, number>> = {};

      BLOKK_LABELS.forEach((blokk) => {
        const raw = draft.blokkMaxOverrides[blokk];
        if (raw === undefined || raw.trim() === '') {
          return;
        }

        const parsed = Number.parseInt(raw, 10);
        if (Number.isNaN(parsed)) {
          return;
        }

        parsedOverrides[blokk] = Math.max(0, parsed);
      });

      nextValues[item.subject] = {
        defaultMax,
        blokkMaxOverrides: parsedOverrides,
        blokkEnabled: {
          'Blokk 1': draft.blokkEnabled['Blokk 1'],
          'Blokk 2': draft.blokkEnabled['Blokk 2'],
          'Blokk 3': draft.blokkEnabled['Blokk 3'],
          'Blokk 4': draft.blokkEnabled['Blokk 4'],
        },
        blokkOrder: normalizeOrder(draft.blokkOrder),
        extraGroupCounts: { ...(current.extraGroupCounts || {}) },
      };
    });

    onSaveSubjectSettingsByName(nextValues);
    setShowOverfillModal(false);
  };

  const placeBlokkForSubject = (subject: string, source: BlokkLabel, target: BlokkLabel) => {
    const current = getSettingsForSubject(subjectSettingsByName, subject);
    const sourceIndex = BLOKK_LABELS.indexOf(source);
    if (sourceIndex < 0) {
      return;
    }

    const placement = normalizeOrder(current.blokkOrder);
    if (placement[sourceIndex] === target) {
      return;
    }

    onApplySubjectBlockMoves(subject, [
      {
        type: 'move',
        fromBlokk: blokkLabelToNumber(source),
        toBlokk: blokkLabelToNumber(target),
        reason: `Flyttet ${subject} fra ${source} til ${target}`,
      },
    ]);

    placement[sourceIndex] = target;

    onSaveSubjectSettingsByName({
      ...subjectSettingsByName,
      [subject]: {
        ...current,
        blokkOrder: placement,
      },
    });
  };

  const swapPlacedBlokkerForSubject = (subject: string, source: BlokkLabel, targetSource: BlokkLabel) => {
    if (source === targetSource) {
      return;
    }

    const current = getSettingsForSubject(subjectSettingsByName, subject);
    const sourceIndex = BLOKK_LABELS.indexOf(source);
    const targetIndex = BLOKK_LABELS.indexOf(targetSource);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const placement = normalizeOrder(current.blokkOrder);
    const sourceTarget = placement[sourceIndex];
    const targetTarget = placement[targetIndex];

    onApplySubjectBlockMoves(subject, [{
      type: 'swap',
      blokkA: blokkLabelToNumber(source),
      blokkB: blokkLabelToNumber(targetSource),
      reason: `Byttet ${subject}: ${source} <-> ${targetSource}`,
    }]);

    placement[sourceIndex] = targetTarget;
    placement[targetIndex] = sourceTarget;

    onSaveSubjectSettingsByName({
      ...subjectSettingsByName,
      [subject]: {
        ...current,
        blokkOrder: placement,
      },
    });
  };

  const addExtraGroupToTarget = (subject: string, target: BlokkLabel) => {
    const current = getSettingsForSubject(subjectSettingsByName, subject);
    const placement = normalizeOrder(current.blokkOrder);
    const breakdown = getBlokkBreakdown(subject);

    const inactiveEmptySource = BLOKK_LABELS.find((sourceBlokk, index) => {
      const placedTarget = placement[index] ?? sourceBlokk;
      const isInTarget = placedTarget === target;
      const isEmpty = breakdown[sourceBlokk] === 0;
      const isInactive = !isBlokkEnabled(subject, sourceBlokk, breakdown);
      return isInTarget && isEmpty && isInactive;
    });

    if (inactiveEmptySource) {
      onSaveSubjectSettingsByName({
        ...subjectSettingsByName,
        [subject]: {
          ...current,
          blokkEnabled: {
            ...current.blokkEnabled,
            [inactiveEmptySource]: true,
          },
        },
      });
      return;
    }

    const currentCount = Math.max(0, Math.floor(current.extraGroupCounts?.[target] ?? 0));
    const nextExtraGroupCounts: Partial<Record<BlokkLabel, number>> = {
      ...(current.extraGroupCounts || {}),
      [target]: currentCount + 1,
    };

    onSaveSubjectSettingsByName({
      ...subjectSettingsByName,
      [subject]: {
        ...current,
        extraGroupCounts: nextExtraGroupCounts,
      },
    });
  };

  const clearDraggedState = () => {
    setDraggedSubject(null);
    setDraggedBlokk(null);
    setDraggedFromTarget(null);
    setDraggedIsExtra(false);
  };

  const removeDraggedGroup = (subject: string) => {
    if (draggedSubject !== subject || !draggedBlokk) {
      clearDraggedState();
      return;
    }

    const current = getSettingsForSubject(subjectSettingsByName, subject);

    if (draggedIsExtra) {
      const target = draggedFromTarget ?? draggedBlokk;
      const currentCount = Math.max(0, Math.floor(current.extraGroupCounts?.[target] ?? 0));
      if (currentCount > 0) {
        onSaveSubjectSettingsByName({
          ...subjectSettingsByName,
          [subject]: {
            ...current,
            extraGroupCounts: {
              ...(current.extraGroupCounts || {}),
              [target]: currentCount - 1,
            },
          },
        });
      }
      clearDraggedState();
      return;
    }

    onSaveSubjectSettingsByName({
      ...subjectSettingsByName,
      [subject]: {
        ...current,
        blokkEnabled: {
          ...current.blokkEnabled,
          [draggedBlokk]: false,
        },
      },
    });
    clearDraggedState();
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
          Innstillinger
        </button>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fag</th>
            <th>Gruppe 1</th>
            <th>Gruppe 2</th>
            <th>Gruppe 3</th>
            <th>Gruppe 4</th>
            <th>Totalt</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((item) => {
            const blokkBreakdown = getBlokkBreakdown(item.subject);
            const placedByTarget = getOrderedBlokker(item.subject, blokkBreakdown);
            const overfilledByBlokk = BLOKK_LABELS.reduce((acc, blokk) => {
              const enabled = isBlokkEnabled(item.subject, blokk);
              const max = getEffectiveMax(item.subject, blokk);
              return {
                ...acc,
                [blokk]: enabled && blokkBreakdown[blokk] > max,
              };
            }, {} as Record<BlokkLabel, boolean>);
            const subjectOver = BLOKK_LABELS.some((blokk) => overfilledByBlokk[blokk]);
            const activeTotal = getActiveTotal(item.subject, blokkBreakdown);

            return (
              <tr key={item.subject} className={styles.subjectRow}>
                <td className={`${styles.subjectNameCell} ${markOverfilled && subjectOver ? styles.overfilledSubject : ''}`.trim()}>{item.subject}</td>
                {BLOKK_LABELS.map((targetBlokk) => {
                  const entries = placedByTarget[targetBlokk];
                  const visibleEntries = entries.filter(shouldShowPlacedEntry);

                  return (
                    <td
                      key={`${item.subject}-${targetBlokk}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedSubject === item.subject && draggedBlokk) {
                          if (draggedIsExtra) {
                            clearDraggedState();
                            return;
                          }
                          placeBlokkForSubject(item.subject, draggedBlokk, targetBlokk);
                        }
                        clearDraggedState();
                      }}
                    >
                      <div className={styles.groupStack}>
                        {visibleEntries.map((entry) => {
                          const overfilled = entry.enabled && entry.count > entry.max;

                          return (
                          <div
                            key={`${item.subject}-${targetBlokk}-${entry.id}`}
                            className={`${styles.groupCard} ${entry.enabled ? styles.groupCardActive : styles.groupCardInactive} ${overfilled ? styles.groupCardOverfilled : ''}`.trim()}
                            draggable={true}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (!entry.isExtra && draggedSubject === item.subject && draggedBlokk) {
                                swapPlacedBlokkerForSubject(item.subject, draggedBlokk, entry.source);
                              }
                              clearDraggedState();
                            }}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', `${item.subject}:${entry.id}`);
                              setDraggedSubject(item.subject);
                              setDraggedBlokk(entry.source);
                              setDraggedFromTarget(targetBlokk);
                              setDraggedIsExtra(entry.isExtra);
                            }}
                            onDragEnd={clearDraggedState}
                            title={entry.isExtra
                              ? `${entry.target} ekstra gruppe`
                              : `${entry.source} plassert i ${entry.target} (${entry.enabled ? 'aktiv' : 'inaktiv'}) - dra for å plassere i en annen blokk`}
                          >
                            <span className={styles.groupCount}>{entry.count}</span>
                            <span className={styles.groupPlacementLabel}>{entry.isExtra ? 'Ny' : entry.source.replace('Blokk ', 'B')}</span>
                          </div>
                          );
                        })}
                        {visibleEntries.length === 0 && <div className={styles.groupEmptySlot}>Tom</div>}
                        <button
                          type="button"
                          className={styles.groupAddButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            addExtraGroupToTarget(item.subject, targetBlokk);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (draggedSubject === item.subject && draggedBlokk) {
                              if (draggedIsExtra) {
                                clearDraggedState();
                                return;
                              }
                              placeBlokkForSubject(item.subject, draggedBlokk, targetBlokk);
                            }
                            clearDraggedState();
                          }}
                          title={`Legg til ny gruppe i ${targetBlokk}`}
                          aria-label={`Legg til ny gruppe i ${targetBlokk}`}
                        >
                          +
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td
                  className={`${styles.totalCell} ${markOverfilled && subjectOver ? styles.totalCellOverfilled : ''}`.trim()}
                  onDoubleClick={() => handleCopyTotal(item.subject, activeTotal)}
                  title="Dobbeltklikk for å kopiere"
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: copiedSubject === item.subject ? '#4CAF50' : undefined,
                    transition: 'background-color 0.5s ease-out',
                  }}
                >
                  {activeTotal}
                </td>
                <td>
                  <div
                    className={styles.trashDropZone}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      removeDraggedGroup(item.subject);
                    }}
                    title="Dra en gruppe hit for å fjerne"
                  >
                    🗑
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 className={styles.subSectionTitle}>Matematikkvalg</h4>
      <table className={styles.mathTable}>
        <thead>
          <tr>
            <th>Fag</th>
            <th>Antall</th>
          </tr>
        </thead>
        <tbody>
          {mathOptionCounts.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td className={styles.mathCountCell}>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showOverfillModal && (
        <div className={styles.modalOverlay} onClick={() => setShowOverfillModal(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h4>Merk overfylt</h4>
            <div className={styles.massUpdateRow}>
              <label htmlFor="mass-update-max">Masseoppdater standard maks</label>
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
              <button type="button" className={styles.modalSecondaryBtn} onClick={resetOverridesToDefault}>
                Nullstill til standard
              </button>
            </div>

            <div className={styles.modalTableWrap}>
              <table className={styles.modalTable}>
                <thead>
                  <tr>
                    <th>Fag</th>
                    <th>Standard maks</th>
                    <th>B1</th>
                    <th>B2</th>
                    <th>B3</th>
                    <th>B4</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => {
                    const draft = draftsBySubject[item.subject];

                    if (!draft) {
                      return null;
                    }

                    return (
                      <tr key={item.subject}>
                        <td>{item.subject}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={draft.defaultMax}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraftsBySubject((prev) => ({
                                ...prev,
                                [item.subject]: {
                                  ...draft,
                                  defaultMax: value,
                                },
                              }));
                            }}
                            className={styles.maxInput}
                          />
                        </td>
                        {BLOKK_LABELS.map((blokk) => {
                          const sourceBlokk = blokk;

                          return (
                          <td key={`${item.subject}-${blokk}`}>
                            <input
                              type="number"
                              min="0"
                              value={draft.blokkMaxOverrides[sourceBlokk] ?? ''}
                              placeholder={draft.defaultMax}
                              onChange={(event) => {
                                const value = event.target.value;
                                setDraftsBySubject((prev) => ({
                                  ...prev,
                                  [item.subject]: {
                                    ...draft,
                                    blokkMaxOverrides: {
                                      ...draft.blokkMaxOverrides,
                                      [sourceBlokk]: value,
                                    },
                                  },
                                }));
                              }}
                              className={styles.maxInput}
                            />
                          </td>
                          );
                        })}
                      </tr>
                    );
                  })}
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
