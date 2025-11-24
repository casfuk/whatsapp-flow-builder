import { prisma } from "./prisma";
import { Action } from "./runtime-types";

interface RuntimeContext {
  sessionId: string;
  flowId: string;
  variables: Record<string, any>;
}

interface StepExecutionResult {
  actions: Action[];
  nextStepId: string | null;
  shouldStop: boolean;
  variables?: Record<string, any>;
}

export class RuntimeEngine {
  private context: RuntimeContext;
  private flow: any;
  private steps: Map<string, any>;
  private connections: any[];

  constructor(flow: any, sessionId: string, initialVariables: Record<string, any> = {}) {
    this.flow = flow;
    this.context = {
      sessionId,
      flowId: flow.id,
      variables: initialVariables,
    };

    // Create a map of steps for quick lookup
    this.steps = new Map(flow.steps.map((step: any) => [step.id, step]));
    this.connections = flow.connections || [];
  }

  async executeFromStep(startStepId: string): Promise<Action[]> {
    const allActions: Action[] = [];
    let currentStepId: string | null = startStepId;

    while (currentStepId) {
      const step = this.steps.get(currentStepId);
      if (!step) break;

      // Save current step to session state
      await this.saveSessionState(currentStepId);

      const result = await this.executeStep(step);
      allActions.push(...result.actions);

      // Log all actions
      for (const action of result.actions) {
        await this.logAction(action);
      }

      if (result.shouldStop) {
        break;
      }

      // Update variables if returned
      if (result.variables) {
        this.context.variables = { ...this.context.variables, ...result.variables };
      }

      currentStepId = result.nextStepId;
    }

    // If we've reached the end, mark session as completed
    if (!currentStepId) {
      await this.saveSessionState(null, "completed");
    }

    return allActions;
  }

  private async executeStep(step: any): Promise<StepExecutionResult> {
    const config = JSON.parse(step.configJson);
    const actions: Action[] = [];

    switch (step.type) {
      case "start":
        return {
          actions: [],
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };

      case "send_message":
        // Check if this is a multimedia message
        const messageType = config.messageType || config.type || "text";

        if (messageType === "multimedia" || messageType === "media") {
          // Handle multimedia messages (image, document, video, audio)
          const mediaId = config.mediaId;
          const mediaUrl = config.mediaUrl || config.url;
          const caption = this.interpolateVariables(config.caption || "");
          const filename = config.filename;

          console.log(`[RuntimeEngine] Sending multimedia message - type: ${config.mediaFormat || 'image'}`);
          console.log(`[RuntimeEngine] Media ID: ${mediaId || 'none'}, URL: ${mediaUrl || 'none'}`);
          console.log(`[RuntimeEngine] Caption: "${caption}"`);

          // Determine media format (default to image)
          const mediaFormat = config.mediaFormat || "image";

          if (mediaFormat === "image") {
            actions.push({
              type: "send_whatsapp_media",
              to: this.context.variables.phone,
              mediaType: "image",
              image: {
                id: mediaId,
                link: mediaUrl,
                caption: caption,
              },
            });
          } else if (mediaFormat === "document") {
            actions.push({
              type: "send_whatsapp_media",
              to: this.context.variables.phone,
              mediaType: "document",
              document: {
                id: mediaId,
                link: mediaUrl,
                caption: caption,
                filename: filename,
              },
            });
          } else if (mediaFormat === "video") {
            actions.push({
              type: "send_whatsapp_media",
              to: this.context.variables.phone,
              mediaType: "video",
              video: {
                id: mediaId,
                link: mediaUrl,
                caption: caption,
              },
            });
          } else if (mediaFormat === "audio") {
            actions.push({
              type: "send_whatsapp_media",
              to: this.context.variables.phone,
              mediaType: "audio",
              audio: {
                id: mediaId,
                link: mediaUrl,
              },
            });
          }
        } else {
          // Regular text message
          const message = this.interpolateVariables(config.message || config.text || "");
          actions.push({
            type: "send_whatsapp",
            to: this.context.variables.phone,
            text: message,
          });
        }

        return {
          actions,
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };

      case "question_simple":
      case "question_multiple":
        // Support both questionText (QuestionNode) and question (legacy)
        const questionText = config.questionText || config.question || "";
        const question = this.interpolateVariables(questionText);

        console.log(`[RuntimeEngine] Question node - text: "${question}"`);
        if (config.buttons) {
          console.log(`[RuntimeEngine] Question has ${config.buttons.length} button(s):`,
            config.buttons.map((b: any) => b.label || b.title));
        }

        actions.push({
          type: "send_whatsapp",
          to: this.context.variables.phone,
          text: question,
        });

        // Stop here - wait for user response
        return {
          actions,
          nextStepId: null,
          shouldStop: true,
        };

      case "multipleChoice":
        // Handle multipleChoice nodes (MultipleChoiceNode.tsx)
        const mcMessage = config.message || config.questionText || "";
        const mcQuestion = this.interpolateVariables(mcMessage);
        const mcOptions = config.options || [];

        console.log(`[RuntimeEngine] ========================================`);
        console.log(`[RuntimeEngine] Executing multipleChoice step: ${step.id}`);
        console.log(`[RuntimeEngine] Contact: ${this.context.variables.phone}`);
        console.log(`[RuntimeEngine] Question text: "${mcQuestion}"`);
        console.log(`[RuntimeEngine] Options count: ${mcOptions.length}`);
        console.log(`[RuntimeEngine] Options:`, mcOptions.map((opt: any) => `${opt.id}: "${opt.title}"`));

        // Use interactive buttons if 3 or fewer options, otherwise use numbered list
        const useInteractiveButtons = mcOptions.length > 0 && mcOptions.length <= 3;

        if (useInteractiveButtons) {
          console.log(`[RuntimeEngine] Using WhatsApp interactive buttons (${mcOptions.length} options)`);

          // Build interactive button payload
          const buttons = mcOptions.map((opt: any, index: number) => ({
            type: "reply",
            reply: {
              id: opt.id, // Use option ID as button ID
              title: (opt.title || opt.label || `Opción ${index + 1}`).substring(0, 20), // WhatsApp limit: 20 chars
            },
          }));

          actions.push({
            type: "send_whatsapp_interactive",
            to: this.context.variables.phone,
            interactive: {
              type: "button",
              body: {
                text: mcQuestion,
              },
              action: {
                buttons: buttons,
              },
            },
          });
        } else {
          // Fallback to numbered list for >3 options or no options
          console.log(`[RuntimeEngine] Using numbered list (${mcOptions.length} options)`);

          let fullMessage = mcQuestion;
          if (mcOptions.length > 0) {
            fullMessage += "\n\n";
            mcOptions.forEach((opt: any, index: number) => {
              fullMessage += `${index + 1}. ${opt.title || opt.label || `Option ${index + 1}`}\n`;
            });
            fullMessage += "\nResponde con el número de tu opción.";
          }

          actions.push({
            type: "send_whatsapp",
            to: this.context.variables.phone,
            text: fullMessage,
          });
        }

        console.log(`[RuntimeEngine] ========================================`);

        // Stop here - wait for user response
        return {
          actions,
          nextStepId: null,
          shouldStop: true,
        };

      case "wait":
        const duration = config.duration || 5;
        actions.push({
          type: "wait",
          duration: duration,
          unit: config.unit || "minutes",
        });
        return {
          actions,
          nextStepId: this.getNextStepId(step.id),
          shouldStop: true, // Stop execution, resume later
        };

      case "assign_conversation":
        // Resolve the assignee
        let resolvedAssigneeId: string | null = null;
        const agentType = config.agentType || "human"; // Default to human

        // If assignToSelf is true or agentId is null/undefined, use default agent
        if (config.assignToSelf === true || !config.agentId) {
          try {
            const settings = await prisma.settings.findUnique({
              where: { id: 1 },
            });
            resolvedAssigneeId = settings?.defaultAgent || null;

            if (!resolvedAssigneeId) {
              console.warn(
                `[RuntimeEngine] No default agent configured in settings. ` +
                `Assignment will be null for session ${this.context.sessionId}`
              );
            } else {
              console.log(
                `[RuntimeEngine] Assigning to default agent: ${resolvedAssigneeId} ` +
                `for session ${this.context.sessionId}`
              );
            }
          } catch (error) {
            console.error(
              `[RuntimeEngine] Failed to fetch default agent from settings:`,
              error
            );
          }
        } else {
          // Use the specified agent ID
          resolvedAssigneeId = config.agentId;
          console.log(
            `[RuntimeEngine] Assigning to ${agentType} agent: ${resolvedAssigneeId} ` +
            `for session ${this.context.sessionId}`
          );
        }

        // Update SessionState with the resolved assignee and type
        try {
          await prisma.sessionState.update({
            where: { sessionId: this.context.sessionId },
            data: {
              assigneeId: resolvedAssigneeId,
              assigneeType: agentType,
              aiTurnCount: 0, // Reset turn count when assigning
            },
          });
          console.log(
            `[RuntimeEngine] Successfully updated SessionState with assigneeId: ${resolvedAssigneeId}, type: ${agentType}`
          );
        } catch (error) {
          console.error(
            `[RuntimeEngine] Failed to update SessionState with assigneeId:`,
            error
          );
        }

        // Send email notification if configured
        if (config.sendEmail) {
          const emailBody = this.buildAssignmentEmail();
          actions.push({
            type: "send_email",
            to: config.adminEmail || process.env.ADMIN_EMAIL || "admin@example.com",
            subject: `Nueva conversación asignada - ${this.flow.name}`,
            body: emailBody,
          });
        }

        // Add assignment action
        actions.push({
          type: "assign_conversation",
          assigneeId: resolvedAssigneeId,
          sessionId: this.context.sessionId,
        });

        return {
          actions,
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };

      case "condition":
        const conditionMet = this.evaluateCondition(config);
        const nextStepId = this.getConditionalNextStep(step.id, conditionMet);
        return {
          actions: [],
          nextStepId,
          shouldStop: false,
        };

      case "template":
        const templateMessage = this.interpolateVariables(config.template || "");
        actions.push({
          type: "send_whatsapp_template",
          to: this.context.variables.phone,
          template: config.templateName,
          variables: config.variables || {},
        });
        return {
          actions,
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };

      default:
        // For unknown types, just continue
        return {
          actions: [],
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };
    }
  }

  async continueFromQuestion(stepId: string, answer: string, optionId?: string): Promise<Action[]> {
    const step = this.steps.get(stepId);
    if (!step) return [];

    const config = JSON.parse(step.configJson);
    const actions: Action[] = [];

    // Store the answer
    if (config.storeKey) {
      this.context.variables[config.storeKey] = answer;
    }

    // Save to database
    await this.saveAnswer(stepId, config.question, answer);

    // Save to custom field if specified
    if (config.saveToFieldId) {
      await this.saveToCustomField(config.saveToFieldId, answer);
    }

    // Handle branching for multiple choice
    let nextStepId: string | null = null;

    if (step.type === "question_multiple" || step.type === "multipleChoice") {
      // Use sourceHandle (optionId) to find the specific next step for this option
      if (optionId) {
        const connection = this.connections.find(
          (conn) => conn.fromStepId === stepId && conn.sourceHandle === optionId
        );
        nextStepId = connection ? connection.toStepId : null;
      }

      // Fallback to generic next step if no specific connection found
      if (!nextStepId) {
        nextStepId = this.getNextStepId(stepId);
      }
    } else {
      nextStepId = this.getNextStepId(stepId);
    }

    // Continue execution from next step
    if (nextStepId) {
      const nextActions = await this.executeFromStep(nextStepId);
      actions.push(...nextActions);
    }

    return actions;
  }

  private getNextStepId(currentStepId: string): string | null {
    const connection = this.connections.find(
      (conn) => conn.fromStepId === currentStepId
    );
    return connection ? connection.toStepId : null;
  }

  private getConditionalNextStep(currentStepId: string, conditionMet: boolean): string | null {
    const connection = this.connections.find(
      (conn) =>
        conn.fromStepId === currentStepId &&
        conn.conditionLabel === (conditionMet ? "true" : "false")
    );

    // Fallback to any connection if no conditional match
    if (!connection) {
      return this.getNextStepId(currentStepId);
    }

    return connection ? connection.toStepId : null;
  }

  private evaluateCondition(config: any): boolean {
    const variable = this.context.variables[config.variable];
    const value = config.value;

    switch (config.operator) {
      case "equals":
        return variable === value;
      case "contains":
        return String(variable).includes(value);
      case "greater_than":
        return Number(variable) > Number(value);
      case "less_than":
        return Number(variable) < Number(value);
      default:
        return false;
    }
  }

  private interpolateVariables(text: string): string {
    let result = text;
    for (const [key, value] of Object.entries(this.context.variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      result = result.replace(regex, String(value));
    }
    return result;
  }

  private buildAssignmentEmail(): string {
    const vars = this.context.variables;
    let body = `<h2>Nueva conversación asignada</h2>`;
    body += `<p><strong>Flow:</strong> ${this.flow.name}</p>`;
    body += `<p><strong>Session ID:</strong> ${this.context.sessionId}</p>`;
    body += `<hr>`;
    body += `<h3>Información del contacto:</h3>`;
    body += `<ul>`;

    for (const [key, value] of Object.entries(vars)) {
      body += `<li><strong>${key}:</strong> ${value}</li>`;
    }

    body += `</ul>`;
    return body;
  }

  private async saveAnswer(stepId: string, question: string, answer: string) {
    try {
      // Get or create FormAnswer for this session
      const existingAnswer = await prisma.formAnswer.findFirst({
        where: {
          flowId: this.context.flowId,
          sessionId: this.context.sessionId,
        },
      });

      const currentAnswers = existingAnswer
        ? JSON.parse(existingAnswer.answersJson)
        : {};

      currentAnswers[stepId] = {
        question,
        answer,
        timestamp: new Date().toISOString(),
      };

      if (existingAnswer) {
        await prisma.formAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            answersJson: JSON.stringify(currentAnswers),
          },
        });
      } else {
        await prisma.formAnswer.create({
          data: {
            flowId: this.context.flowId,
            sessionId: this.context.sessionId,
            answersJson: JSON.stringify(currentAnswers),
          },
        });
      }
    } catch (error) {
      console.error("Failed to save answer:", error);
    }
  }

  private async saveToCustomField(customFieldId: string, value: string) {
    try {
      // Get phone number from context
      const phoneNumber = this.context.variables.phone;
      if (!phoneNumber) {
        console.warn("No phone number in context, cannot save to custom field");
        return;
      }

      // Find or create contact by phone number
      let contact = await prisma.contact.findUnique({
        where: { phone: phoneNumber },
      });

      if (!contact) {
        // Create contact if it doesn't exist
        contact = await prisma.contact.create({
          data: {
            phone: phoneNumber,
            source: "whatsapp",
          },
        });
      }

      // Save or update the custom field value
      await prisma.contactCustomFieldValue.upsert({
        where: {
          contactId_customFieldId: {
            contactId: contact.id,
            customFieldId,
          },
        },
        update: {
          value,
        },
        create: {
          contactId: contact.id,
          customFieldId,
          value,
        },
      });
    } catch (error) {
      console.error("Failed to save to custom field:", error);
    }
  }

  getVariables(): Record<string, any> {
    return this.context.variables;
  }

  async saveSessionState(currentStepId: string | null, status: string = "active") {
    try {
      await prisma.sessionState.upsert({
        where: { sessionId: this.context.sessionId },
        update: {
          currentStepId,
          variablesJson: JSON.stringify(this.context.variables),
          status,
        },
        create: {
          sessionId: this.context.sessionId,
          flowId: this.context.flowId,
          currentStepId,
          variablesJson: JSON.stringify(this.context.variables),
          status,
        },
      });
    } catch (error) {
      console.error("Failed to save session state:", error);
    }
  }

  async logAction(action: Action) {
    try {
      await prisma.debugAction.create({
        data: {
          sessionId: this.context.sessionId,
          actionType: action.type,
          actionData: JSON.stringify(action),
        },
      });

      // Also log to console for development
      console.log(`[Runtime] Action:`, action);
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  }

  static async getSessionState(sessionId: string) {
    return await prisma.sessionState.findUnique({
      where: { sessionId },
    });
  }
}

// Export alias for backward compatibility
export { RuntimeEngine as FlowEngine };
