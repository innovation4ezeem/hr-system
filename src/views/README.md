# MVC Mapping

This project follows an MVC-style structure for data flows:

- `src/models`: SQL/data access logic
- `src/controllers`: business logic and validation
- `src/app/api`: route handlers (entry points)
- `src/app` + `src/components`: UI views

Current module migrated:
- Performance Scores (`/api/performance-scores`)
- Users (`/api/users`)
- Departments (`/api/departments`)
- Leave Control State (`/api/leave-control-state`)
- Scoring Categories (`/api/scoring-categories`)
