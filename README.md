# Excel File Merger

A web application for importing, mapping, and merging multiple Excel files with automatic column mapping, grade progression, and subject tallying.

## Features

- **Multi-file Upload**: Import multiple Excel files at once
- **Auto-Column Detection**: Automatically identifies and maps Elevnavn, Klasse, and Blokk columns
- **Smart Column Mapping**: Interactively map columns (shows auto-detected values)
- **Data Merge**: Combine data from all files into a single consolidated dataset
- **Grade Progression**: Automatically increments student class year (1STA → 2STA, 2STA → 3STA, etc.)
- **Subject Tally**: Automatic counting of students per school subject
- **Excel Export**: Download merged results as properly formatted Excel file
- **Responsive UI**: Clean, modern interface with dark theme

## Standard Fields

The application maps columns to these standard fields:

- **Navn**: Student name (auto-detects "Elevnavn")
- **Klasse**: Student class/grade (auto-detects "Klasse")
- **Blokk 1-4**: School subject blocks (auto-detects "Blokk1", "Blokk2", etc.)

## How to Use

### 1. Upload Files
- Click the "Choose Files" button to select one or more Excel files
- Columns are automatically detected and mapped
- Files appear in the "Uploaded Files" section

### 2. Review and Adjust Column Mappings (Optional)
- The app auto-detects standard columns and shows them in the mappers
- If your columns have different names or need adjustment, you can change the mappings
- The column mapping is file-specific and independent

### 3. Merge Data
- Click the "Merge Data" button to consolidate all data
- Student classes are automatically progressed by one year (1STA becomes 2STA, etc.)
- Only rows with student names are included in the merged dataset

### 4. View and Export Results
- **Merged Student Data Table**: Shows all consolidated student records with progressive class years
- **Subject Tally**: Shows count of students per subject, sorted by count (descending)
- **Export Button**: Download all merged data as an Excel file with proper formatting

## Examples

### Column Auto-Detection
The app recognizes these column name patterns:
- "Elevnavn", "elevnavn", "Student Name" → **Navn**
- "Klasse", "klasse", "Class" → **Klasse**
- Columns containing "blokk1", "BLOKK1", "blokk1-vg2" → **Blokk 1**
- Similar patterns for Blokk 2, 3, and 4

### Grade Progression
- Input: "1STA" → Output: "2STA"
- Input: "2VG2" → Output: "3VG2"
- Input: "3STB" → Output: "4STB"

### Subject Tallying
If a student has:
- Blokk 2: "Mathematics, English"
- Blokk 3: "Science"

The tally counts this as:
- Mathematics: 1
- English: 1
- Science: 1

## Installation & Development

### Prerequisites
- Node.js 18+
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will open at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Excel Parsing**: XLSX library
- **Styling**: CSS Modules

## Project Structure

```
src/
├── components/           # React components
│   ├── FileUploader.tsx
│   ├── ColumnMapper.tsx
│   ├── MergedDataView.tsx
│   ├── SubjectTally.tsx
│   └── *.module.css     # Component styles
├── utils/
│   └── excelUtils.ts     # Excel parsing and data processing logic
├── App.tsx              # Main app component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Features in Detail

### File Upload
Supports .xlsx and .xls Excel file formats. Multiple files can be uploaded and processed simultaneously.

### Auto-Column Detection
When files are uploaded, the app automatically:
- Detects "Elevnavn" columns and maps them to "Navn"
- Detects "Klasse" columns and maps them to "Klasse"
- Identifies Blokk columns (including variations like "blokk2-vg2") and maps them to the appropriate standard Blokk field
- Displays detected mappings for easy review and adjustment

### Column Mapping
- Each uploaded file has its own independent column mapping configuration
- Pre-populated with auto-detected values
- You can manually adjust mappings if needed
- Non-mapped columns are ignored during the merge process

### Grade Progression
When merging data:
- Student class years are automatically incremented by 1
- Handles various class formats: "1STA" → "2STA", "2VG2" → "3VG2", etc.
- Applied consistently across all students during the merge

### Data Consolidation
- Combines student data from all uploaded files
- Only records with a student name (Navn) are included
- Ensures no duplicate column headers in mixed datasets
- Maintains data integrity across different file structures

### Subject Tally
- Automatically counts student occurrences in each subject
- Handles multiple subjects per block (comma or semicolon separated)
- Displays results sorted by count in descending order
- Counts each unique subject combination separately

### Excel Export
- Download the complete merged dataset as an Excel file
- Properly formatted with headers: Navn, Klasse, Blokk 1-4
- Column widths optimized for readability
- Uses standard .xlsx format

## Limitations

- Only the first sheet of each Excel file is processed
- Subject counting assumes subjects are separated by commas or semicolons
- Empty or null values are treated as missing data
- Students without a name are excluded from the merged dataset

## Future Enhancements

- Export merged data to Excel
- Drag-and-drop file upload
- Column preview before mapping
- Custom field definitions
- Data validation and error reporting
- Duplicate detection and merging
