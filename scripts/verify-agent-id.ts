import * as fs from 'fs';
import * as path from 'path';

function searchAgentMessages(dir: string, results: any[] = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
      searchAgentMessages(filePath, results);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (line.includes('sender: "agent"')) {
          // Check if agentId is present within next 5 lines
          const contextLines = lines.slice(idx, idx + 8).join('\n');
          const hasAgentId = contextLines.includes('agentId:') || contextLines.includes('agentId =');

          results.push({
            file: filePath.replace(process.cwd(), ''),
            line: idx + 1,
            hasAgentId,
            context: lines.slice(Math.max(0, idx - 2), idx + 6).join('\n')
          });
        }
      });
    }
  }

  return results;
}

const results = searchAgentMessages(path.join(process.cwd(), 'app/api'));

console.log('\n✅ sendAndPersistMessage Agent ID Coverage:\n');
console.log(`Total agent messages found: ${results.length}`);
console.log(`With agentId: ${results.filter(r => r.hasAgentId).length}`);
console.log(`Without agentId: ${results.filter(r => !r.hasAgentId).length}\n`);

results.forEach(r => {
  const status = r.hasAgentId ? '✅' : '❌';
  console.log(`${status} ${r.file}:${r.line}`);
});

const allHaveAgentId = results.every(r => r.hasAgentId);
console.log(`\n✅ All agent messages have agentId: ${allHaveAgentId ? 'PASS' : 'FAIL'}`);
