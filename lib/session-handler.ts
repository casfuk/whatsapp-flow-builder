import { prisma } from "./prisma";
const anyPrisma = prisma as any;
import { StepConfig } from "./types";

interface Flow {
  id: string;
  name: string;
  key: string;
  steps: any[];
  connections: any[];
}

export async function processMessage(
  phoneNumber: string,
  message: string,
  flow: Flow
) {
  // Find or create session
  let session = await anyPrisma.session.findFirst({

    where: {
      phoneNumber,
      flowId: flow.id,
      status: "active",
    },
    include: {
      answers: true,
    },
  });

  if (!session) {
    // Create new session, starting at the first "start" step
    const startStep = flow.steps.find((s) => s.type === "start");
    if (!startStep) {
      throw new Error("No start step found in flow");
    }

      session = await anyPrisma.session.create({
      data: {
        flowId: flow.id,
        phoneNumber,
        currentStepId: startStep.id,
        status: "active",
      },
      include: {
        answers: true,
      },
    });
  }

  const currentStep = flow.steps.find((s) => s.id === session.currentStepId);
  if (!currentStep) {
    return { error: "Current step not found" };
  }

  const config: StepConfig = JSON.parse(currentStep.config);

  // Process the current step based on type
  let responseMessage = "";
  let nextStepId: string | null = null;

  switch (config.type) {
    case "start":
      // Move to next step immediately
      nextStepId = getNextStepId(currentStep.id, flow.connections);
      break;

    case "send_message":
      responseMessage = (config as any).message || "";
      nextStepId = getNextStepId(currentStep.id, flow.connections);
      break;

    case "question_simple":
    case "question_multiple":
      // Save the answer
      await anyPrisma.answer.create({
        data: {
          sessionId: session.id,
          stepId: currentStep.id,
          question: (config as any).question,
          answer: message,
        },
      });

      // Move to next step
      nextStepId = getNextStepId(currentStep.id, flow.connections);
      break;

    case "condition":
      // Evaluate condition
      const conditionConfig = config as any;
      const variable = session.answers.find(
         (a: any) => (JSON.parse(a.tags || "{}").saveAs) === conditionConfig.variable
);

      let conditionMet = false;
      if (variable) {
        switch (conditionConfig.operator) {
          case "equals":
            conditionMet = variable.answer === conditionConfig.value;
            break;
          case "contains":
            conditionMet = variable.answer.includes(conditionConfig.value);
            break;
        }
      }

      // Get connections and find the right path
      const connections = flow.connections.filter(
        (c) => c.sourceId === currentStep.id
      );
      const connection = connections.find((c) =>
        conditionMet ? c.label === "true" : c.label === "false"
      );
      nextStepId = connection?.targetId || null;
      break;

    case "wait":
      // For wait steps, you'd schedule this to continue later
      // For now, just move to next step
      nextStepId = getNextStepId(currentStep.id, flow.connections);
      break;

    default:
      nextStepId = getNextStepId(currentStep.id, flow.connections);
      break;
  }

  // Update session with next step
  if (nextStepId) {
    await anyPrisma.session.update({
      where: { id: session.id },
      data: { currentStepId: nextStepId },
    });

    // Get next step and prepare its response
    const nextStep = flow.steps.find((s) => s.id === nextStepId);
    if (nextStep) {
      const nextConfig: StepConfig = JSON.parse(nextStep.config);

      if (nextConfig.type === "send_message") {
        responseMessage = (nextConfig as any).message || "";
      } else if (
        nextConfig.type === "question_simple" ||
        nextConfig.type === "question_multiple"
      ) {
        responseMessage = (nextConfig as any).question || "";
      }
    }
  } else {
    // No next step, mark session as completed
    await anyPrisma.session.update({
      where: { id: session.id },
      data: { status: "completed" },
    });
  }

  return {
    success: true,
    message: responseMessage,
    sessionId: session.id,
    completed: !nextStepId,
  };
}

function getNextStepId(
  currentStepId: string,
  connections: any[]
): string | null {
  const connection = connections.find((c) => c.sourceId === currentStepId);
  return connection?.targetId || null;
}
