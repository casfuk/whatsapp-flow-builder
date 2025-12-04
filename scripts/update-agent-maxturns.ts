import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating AI agents maxTurns to 20...');

  const result = await prisma.aiAgent.updateMany({
    where: {
      name: {
        in: ['ClaudIA', 'MarIA']
      }
    },
    data: {
      maxTurns: 20
    }
  });

  console.log(`✅ Updated ${result.count} agent(s)`);

  // Verify the update
  const agents = await prisma.aiAgent.findMany({
    where: {
      name: {
        in: ['ClaudIA', 'MarIA']
      }
    },
    select: {
      name: true,
      maxTurns: true
    }
  });

  console.log('\nCurrent agent settings:');
  agents.forEach(agent => {
    console.log(`  ${agent.name}: maxTurns = ${agent.maxTurns}`);
  });
}

main()
  .catch((e) => {
    console.error('Error updating agents:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
