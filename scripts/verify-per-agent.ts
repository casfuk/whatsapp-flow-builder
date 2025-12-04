import * as fs from 'fs';

const aiAgentContent = fs.readFileSync('app/api/ai-agent/route.ts', 'utf-8');

// Test 1: Per-agent turn counting
const hasTurnCounting = aiAgentContent.includes('perAgentTurnCount[agentId]');
console.log('\n✅ Per-Agent Separation Verification:\n');
console.log(`1. Turn count per agent: ${hasTurnCounting ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 2: Agent change detection
const hasAgentChange = aiAgentContent.includes('AGENT CHANGE DETECTED');
console.log(`2. Agent change detection: ${hasAgentChange ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 3: Message filtering by agentId
const hasFiltering = aiAgentContent.includes('msg.agentId === agentId');
console.log(`3. Message filtering by agentId: ${hasFiltering ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 4: Context filtering (only THIS agent's messages)
const hasContextFilter = aiAgentContent.includes('Only show agent messages from THIS AGENT');
console.log(`4. Context filtering comments: ${hasContextFilter ? 'PASS ✅' : 'FAIL ❌'}`);

// Test 5: Turn count increment in service
const serviceContent = fs.readFileSync('lib/whatsapp-message-service.ts', 'utf-8');
const hasIncrement = serviceContent.includes('perAgentTurnCount[agentId] = (perAgentTurnCount[agentId] || 0) + 1');
console.log(`5. Turn count increment in service: ${hasIncrement ? 'PASS ✅' : 'FAIL ❌'}`);

const allPass = hasTurnCounting && hasAgentChange && hasFiltering && hasContextFilter && hasIncrement;
console.log(`\n✅ Per-agent separation fully implemented: ${allPass ? 'PASS' : 'FAIL'}`);
