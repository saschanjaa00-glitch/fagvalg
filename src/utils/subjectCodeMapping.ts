// Mapping from subject names to subject codes
export const subjectCodeMapping: Record<string, string> = {
  'Biologi 1': '2BIO5',
  'Biologi 2': '3BIO5',
  'Breddeidrett 1': '1BID5',
  'Engelsk 1': '2ENG5',
  'Engelsk 2': '3ENG5',
  'Entreprenørskap og bedr.utv. 1': '2ENT5',
  'Entreprenørskap og bedr.utv. 2': '3ENT5',
  'Fransk nivå III': '3FRA5',
  'Fysikk 1': '2FYS5',
  'Fysikk 2': '3FYS5',
  'Geofag 1': '2GEO5',
  'Geofag 2': '3GEO5',
  'Kjemi 1': '2KJE5',
  'Kjemi 2': '3KJE5',
  'Markedsføring og ledelse 1': '2MFL5',
  'Markedsføring og ledelse 2': '3MFL5',
  'Matematikk R2': '2MAR5',
  'Matematikk S2': '3MAS5',
  'Pol. og menneskerettigheter': '3PMR5',
  'Psykologi 1': '2PSY5',
  'Psykologi 2': '3PSY5',
  'Rettslære 1': '2RTL5',
  'Rettslære 2': '3RTL5',
  'Samfunnsgeografi': '2SGE5',
  'Samfunnsøkonomi 1': '2SØK5',
  'Samfunnsøkonomi 2': '3SØK5',
  'Sosialkunnskap': '3SKU5',
  'Sosiologi og sosialantropologi': '2SSA5',
  'Spansk nivå III': '3SPA5',
  'Toppidrett 2': '2TID5',
  'Toppidrett 3': '3TID5',
  'Tysk I+II': '3TYI5',
  'Tysk nivå III': '3TYS5',
};

/**
 * Maps a subject name to its code. Returns the original name if no mapping exists.
 */
export const mapSubjectToCode = (subjectName: string): string => {
  return subjectCodeMapping[subjectName] || subjectName;
};
