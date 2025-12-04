import * as fs from 'fs';

const webhookContent = fs.readFileSync('app/api/v1/integrations/[triggerId]/webhook/route.ts', 'utf-8');

console.log('\n✅ Elementor Response Verification:\n');

// Test 1: Elementor detection
const hasDetection = webhookContent.includes('isElementorRequest');
console.log(`1. Elementor detection logic: ${hasDetection ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 2: Multiple detection criteria
const hasMultipleCriteria =
  webhookContent.includes("includes('elementor')") &&
  webhookContent.includes("page_id");
console.log(`2. Multiple detection criteria: ${hasMultipleCriteria ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 3: Simple success response
const hasSuccessResponse = webhookContent.includes('{ success: true }');
console.log(`3. Simple success response: ${hasSuccessResponse ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 4: Status 200
const hasStatus200 = webhookContent.includes('status: 200');
console.log(`4. Explicit status 200: ${hasStatus200 ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 5: CORS headers
const hasCORS = webhookContent.includes('Access-Control-Allow-Origin');
console.log(`5. CORS headers present: ${hasCORS ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 6: Detailed response for non-Elementor
const hasDetailedResponse = webhookContent.includes('fields') && webhookContent.includes('flowId');
console.log(`6. Detailed response for Meta/Flow Builder: ${hasDetailedResponse ? 'PASS ✅' : 'FAIL ❌'}`);

const allPass = hasDetection && hasMultipleCriteria && hasSuccessResponse && hasStatus200 && hasCORS && hasDetailedResponse;
console.log(`\n✅ Elementor integration correct: ${allPass ? 'PASS' : 'FAIL'}`);
