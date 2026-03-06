<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Setup Checklist - COMPLETED

- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	Project: Excel file merge and column mapping application
	Framework: Vite + React + TypeScript
	Purpose: Import multiple Excel files, map columns to standard fields, merge data, and tally school subjects

- [x] Scaffold the Project
	- [x] Run Vite scaffolding with react-ts template
	- [x] Initialize project files and folders

- [x] Customize the Project
	- [x] Add xlsx dependency for Excel file handling
	- [x] Create Excel parsing utilities
	- [x] Create ColumnMapper component
	- [x] Create FileUploader component
	- [x] Create MergedDataView component
	- [x] Create SubjectTally component
	- [x] Implement merge logic and state management

- [x] Install Required Extensions
	- No VS Code extensions required for this project

- [x] Compile the Project
	- [x] Install all npm dependencies
	- [x] Run build check to ensure no errors

- [x] Create and Run Task
	- [x] Create dev server task in tasks.json
	- [x] Verify development server runs successfully

- [x] Launch the Project
	- [x] Confirm dev server is running
	- [x] Provide startup instructions

- [x] Ensure Documentation is Complete
	- [x] Verify README.md exists and is current
	- [x] All implementation complete

## Implementation Summary

### Features Implemented
1. Excel file upload (supports .xlsx and .xls)
2. **Auto-detection of columns** - Automatically identifies Elevnavn, Klasse, and Blokk columns
3. **Column mapping interface** for each file with pre-populated auto-detected values
4. **Data merge and consolidation** with intelligent column matching
5. **Grade progression** - Automatically increments class year (1STA → 2STA, 2STA → 3STA, etc.)
6. **Subject tally system** - Counts students per subject across all blocks
7. **Export to Excel** - Download merged data as an Excel file with proper formatting
8. **Responsive UI** with dark theme and intuitive controls

### Project Structure
- FileUploader component for multi-file uploads
- ColumnMapper component for interactive column assignment
- MergedDataView component for displaying consolidated data
- SubjectTally component for subject analytics
- Excel utilities for parsing and processing

### Technology Stack
- React 19 with TypeScript
- Vite for fast development and builds
- XLSX library for Excel file handling
- CSS Modules for scoped styling

## Running the Application

The development server is already running. Access it at:
[Open http://localhost:5173](http://localhost:5173)

To start the server manually:
```bash
npm run dev
```

To build for production:
```bash
npm run build
```

See README.md for complete documentation.
