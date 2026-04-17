# Council Permit Portal — UML Diagrams

Five PlantUML diagrams covering the full system.

## Files

| File | Diagram Type | What it shows |
|------|-------------|---------------|
| `use-case.puml` | Use Case | All actors (Applicant, Officer, Admin, AI, Paychangu) and every system action |
| `class-diagram.puml` | Class | All 16 Prisma models, fields, types, constraints, and relationships |
| `activity-diagram.puml` | Activity (swimlane) | Full permit application lifecycle across all three roles |
| `sequence-application.puml` | Sequence | Step-by-step message flow for submitting a permit application end-to-end |
| `sequence-ai-chat.puml` | Sequence | AI chat flow — intent classification, data fetching, AI call, suggestion chips |
| `component-architecture.puml` | Component | System architecture — pages, components, API routes, libraries, external services |

## How to Render

### Option A — VS Code extension (recommended)
Install **PlantUML** extension by jebbs.  
Open any `.puml` file → press `Alt+D` to preview.

### Option B — Online renderer
Paste file contents at https://www.plantuml.com/plantuml/uml/

### Option C — CLI
```bash
java -jar plantuml.jar diagrams/*.puml
# outputs PNG per diagram
```

### Option D — npm package
```bash
npx node-plantuml generate diagrams/use-case.puml --format png
```
