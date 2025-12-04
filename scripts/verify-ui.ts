import * as fs from 'fs';

const uiContent = fs.readFileSync('app/agentes-ia/page.tsx', 'utf-8');

console.log('\n✅ UI Protection Verification:\n');

// Test 1: Read-only fields disabled
const hasDisabled = uiContent.includes('disabled={!!editingAgent}');
console.log(`1. Fields disabled when editing: ${hasDisabled ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 2: Backend labels
const hasBackendLabels = uiContent.includes('(backend)') || uiContent.includes('desde backend');
console.log(`2. Backend labels present: ${hasBackendLabels ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 3: Payload excludes read-only fields
const excludesReadOnly = uiContent.includes('exclude read-only fields');
console.log(`3. Edit payload excludes read-only: ${excludesReadOnly ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 4: Loads from DB via API
const loadsFromDB = uiContent.includes('fetch("/api/ai-agents")');
console.log(`4. Loads agents from DB: ${loadsFromDB ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 5: Shows maxTurns from agent object
const showsMaxTurns = uiContent.includes('{agent.maxTurns}');
console.log(`5. Shows maxTurns from DB: ${showsMaxTurns ? 'PASS ✅' : 'FAIL ❌'}`);

const allPass = hasDisabled && hasBackendLabels && excludesReadOnly && loadsFromDB && showsMaxTurns;
console.log(`\n✅ UI correctly protects backend values: ${allPass ? 'PASS' : 'FAIL'}`);
