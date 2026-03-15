export type BlokkLabel = 'Blokk 1' | 'Blokk 2' | 'Blokk 3' | 'Blokk 4';

export interface SubjectGroup {
  id: string;
  blokk: BlokkLabel;
  sourceBlokk: BlokkLabel;
  enabled: boolean;
  max: number;
  createdAt: string;
}

export interface SubjectSettings {
  defaultMax: number;
  groups?: SubjectGroup[];
  groupStudentAssignments?: Record<string, string>;
  blokkMaxOverrides?: Partial<Record<BlokkLabel, number>>;
  blokkEnabled?: Partial<Record<BlokkLabel, boolean>>;
  blokkOrder?: BlokkLabel[];
  extraGroupCounts?: Partial<Record<BlokkLabel, number>>;
}

export type SubjectSettingsByName = Record<string, SubjectSettings>;

export interface ResolvedGroup extends SubjectGroup {
  label: string;
  allocatedCount: number;
  allocatedStudentIds: string[];
  overfilled: boolean;
}

export type StudentIdsByBlokk = Record<BlokkLabel, string[]>;

export const DEFAULT_MAX_PER_SUBJECT = 30;
export const BLOKK_LABELS: BlokkLabel[] = ['Blokk 1', 'Blokk 2', 'Blokk 3', 'Blokk 4'];

const buildDefaultSettings = (): SubjectSettings => ({
  defaultMax: DEFAULT_MAX_PER_SUBJECT,
  groups: [],
});

const normalizeOrder = (order?: BlokkLabel[]): BlokkLabel[] => {
  return BLOKK_LABELS.map((label, index) => {
    const candidate = order?.[index];
    return candidate && BLOKK_LABELS.includes(candidate) ? candidate : label;
  });
};

export const sanitizeCount = (
  value: string | number | undefined,
  fallback: number = DEFAULT_MAX_PER_SUBJECT
): number => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : Math.max(0, Math.floor(value));
  }

  const parsed = Number.parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : Math.max(0, parsed);
};

export const makeGroupId = () => {
  return `group-${Math.random().toString(36).slice(2, 11)}`;
};

export const makeGroup = (
  blokk: BlokkLabel,
  sourceBlokk: BlokkLabel,
  max: number,
  enabled: boolean,
  createdAt?: string
): SubjectGroup => ({
  id: makeGroupId(),
  blokk,
  sourceBlokk,
  enabled,
  max: sanitizeCount(max),
  createdAt: createdAt || new Date().toISOString(),
});

const sanitizeGroups = (groups: SubjectGroup[] | undefined, defaultMax: number): SubjectGroup[] => {
  if (!Array.isArray(groups)) {
    return [];
  }

  const seenIds = new Set<string>();

  return groups
    .filter((group) => BLOKK_LABELS.includes(group.blokk))
    .map((group) => {
      const id = group.id && !seenIds.has(group.id) ? group.id : makeGroupId();
      seenIds.add(id);

      return {
        id,
        blokk: group.blokk,
        sourceBlokk: BLOKK_LABELS.includes(group.sourceBlokk as BlokkLabel)
          ? (group.sourceBlokk as BlokkLabel)
          : group.blokk,
        enabled: group.enabled !== false,
        max: sanitizeCount(group.max, defaultMax),
        createdAt: group.createdAt || new Date().toISOString(),
      };
    });
};

export const getBlokkNumber = (label: BlokkLabel): number => {
  return Number.parseInt(label.replace('Blokk ', ''), 10);
};

const buildLegacyGroups = (
  raw: SubjectSettings,
  defaultMax: number,
  blokkBreakdown: Record<BlokkLabel, number>
): SubjectGroup[] => {
  const groups: SubjectGroup[] = [];
  const placement = normalizeOrder(raw.blokkOrder);

  BLOKK_LABELS.forEach((sourceBlokk, sourceIndex) => {
    const targetBlokk = placement[sourceIndex] ?? sourceBlokk;
    const hasImportData = blokkBreakdown[sourceBlokk] > 0;
    const explicitEnabled = raw.blokkEnabled?.[sourceBlokk];
    const shouldCreate = hasImportData || typeof explicitEnabled === 'boolean';

    if (!shouldCreate) {
      return;
    }

    const max = sanitizeCount(raw.blokkMaxOverrides?.[sourceBlokk], defaultMax);
    const enabled = explicitEnabled ?? hasImportData;
    groups.push(makeGroup(targetBlokk, sourceBlokk, max, enabled));
  });

  BLOKK_LABELS.forEach((targetBlokk) => {
    const extras = Math.max(0, Math.floor(raw.extraGroupCounts?.[targetBlokk] ?? 0));
    for (let i = 0; i < extras; i += 1) {
      const max = sanitizeCount(raw.blokkMaxOverrides?.[targetBlokk], defaultMax);
      groups.push(makeGroup(targetBlokk, targetBlokk, max, true));
    }
  });

  return groups;
};

const buildImportGroups = (
  defaultMax: number,
  blokkBreakdown: Record<BlokkLabel, number>
): SubjectGroup[] => {
  const groups: SubjectGroup[] = [];

  BLOKK_LABELS.forEach((blokk) => {
    if (blokkBreakdown[blokk] > 0) {
      groups.push(makeGroup(blokk, blokk, defaultMax, true));
    }
  });

  return groups;
};

export const getSettingsForSubject = (
  subjectSettingsByName: SubjectSettingsByName,
  subject: string,
  blokkBreakdown: Record<BlokkLabel, number>
): SubjectSettings => {
  const raw = subjectSettingsByName[subject];

  if (!raw) {
    const defaults = buildDefaultSettings();
    return {
      ...defaults,
      groupStudentAssignments: {},
      groups: buildImportGroups(defaults.defaultMax, blokkBreakdown),
    };
  }

  const defaultMax = sanitizeCount(raw.defaultMax);
  const explicitGroups = sanitizeGroups(raw.groups, defaultMax);
  const groupStudentAssignments = (raw.groupStudentAssignments && typeof raw.groupStudentAssignments === 'object')
    ? { ...raw.groupStudentAssignments }
    : {};

  if (Array.isArray(raw.groups)) {
    return {
      defaultMax,
      groupStudentAssignments,
      groups: explicitGroups,
    };
  }

  const hasLegacyConfig =
    !!raw.blokkOrder
    || !!raw.blokkEnabled
    || !!raw.blokkMaxOverrides
    || !!raw.extraGroupCounts;

  if (!hasLegacyConfig) {
    return {
      defaultMax,
      groupStudentAssignments,
      groups: buildImportGroups(defaultMax, blokkBreakdown),
    };
  }

  return {
    defaultMax,
    groupStudentAssignments,
    groups: buildLegacyGroups(raw, defaultMax, blokkBreakdown),
  };
};

export const shouldShowGroup = (group: ResolvedGroup): boolean => {
  return group.allocatedCount > 0 || group.enabled;
};

export const getResolvedGroupsByTarget = (
  groups: SubjectGroup[],
  blokkStudentIds: StudentIdsByBlokk,
  groupStudentAssignments: Record<string, string>
): Record<BlokkLabel, ResolvedGroup[]> => {
  const byTarget: Record<BlokkLabel, SubjectGroup[]> = {
    'Blokk 1': [],
    'Blokk 2': [],
    'Blokk 3': [],
    'Blokk 4': [],
  };

  groups.forEach((group) => {
    byTarget[group.blokk].push(group);
  });

  const resolvedByTarget: Record<BlokkLabel, ResolvedGroup[]> = {
    'Blokk 1': [],
    'Blokk 2': [],
    'Blokk 3': [],
    'Blokk 4': [],
  };

  BLOKK_LABELS.forEach((blokk) => {
    const sorted = [...byTarget[blokk]].sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt);
      }
      return left.id.localeCompare(right.id);
    });

    const enabledGroups = sorted.filter((group) => group.enabled);
    const allocation: Record<string, number> = {};
    const studentIdsByGroupId: Record<string, string[]> = {};
    sorted.forEach((group) => {
      allocation[group.id] = 0;
      studentIdsByGroupId[group.id] = [];
    });

    const studentIds = blokkStudentIds[blokk] || [];
    const unassignedStudentIds: string[] = [];

    studentIds.forEach((studentId) => {
      const assignedGroupId = groupStudentAssignments[studentId];
      if (!assignedGroupId) {
        unassignedStudentIds.push(studentId);
        return;
      }

      const assignedGroup = enabledGroups.find((group) => group.id === assignedGroupId);
      if (!assignedGroup) {
        unassignedStudentIds.push(studentId);
        return;
      }

      allocation[assignedGroup.id] = (allocation[assignedGroup.id] || 0) + 1;
      studentIdsByGroupId[assignedGroup.id].push(studentId);
    });

    unassignedStudentIds.forEach((studentId, index) => {
      if (enabledGroups.length === 0) {
        return;
      }

      const targetGroup = enabledGroups[index % enabledGroups.length];
      allocation[targetGroup.id] = (allocation[targetGroup.id] || 0) + 1;
      studentIdsByGroupId[targetGroup.id].push(studentId);
    });

    resolvedByTarget[blokk] = sorted.map((group, index) => {
      const count = allocation[group.id] ?? 0;
      return {
        ...group,
        label: `${getBlokkNumber(blokk)}-${index + 1}`,
        allocatedCount: count,
        allocatedStudentIds: studentIdsByGroupId[group.id] || [],
        overfilled: group.enabled && count > group.max,
      };
    });
  });

  return resolvedByTarget;
};

export const getActiveTotal = (groupsByTarget: Record<BlokkLabel, ResolvedGroup[]>): number => {
  return BLOKK_LABELS.reduce((sum, blokk) => {
    const activeCount = groupsByTarget[blokk]
      .filter((group) => group.enabled)
      .reduce((groupSum, group) => groupSum + group.allocatedCount, 0);
    return sum + activeCount;
  }, 0);
};