import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.aiAgent.findMany({
    where: { name: { in: ['ClaudIA', 'MarIA'] } },
    select: { name: true, maxTurns: true, goal: true, tone: true, language: true }
  });

  console.log('\n✅ Agent Database Values Verification:\n');
  agents.forEach(agent => {
    console.log(`${agent.name}:`);
    console.log(`  - maxTurns: ${agent.maxTurns}`);
    console.log(`  - goal: ${agent.goal ? agent.goal.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`  - tone: ${agent.tone}`);
    console.log(`  - language: ${agent.language}`);
  });

  const allHave20 = agents.every(a => a.maxTurns === 20);
  console.log(`\n✅ All agents have maxTurns=20: ${allHave20 ? 'PASS' : 'FAIL'}`);
}

main().finally(() => prisma.$disconnect());
