import { prisma } from "./prisma";
import { Action } from "./runtime-types";
import { evaluateConditions } from "./flow/conditions";

interface RuntimeContext {
  sessionId: string;
  flowId: string;
  variables: Record<string, any>;
  chatId?: string; // Optional chat ID for updating Chat record
}

interface AiAgentStepConfig {
  aiAction?: "activate" | "change" | "stop";
  agentId?: string | null;
  respondNow?: boolean;
  resetContext?: boolean;
  stopMessage?: string;
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

  constructor(flow: any, sessionId: string, initialVariables: Record<string, any> = {}, chatId?: string) {
    this.flow = flow;
    this.context = {
      sessionId,
      flowId: flow.id,
      variables: initialVariables,
      chatId,
    };

    // Create a map of steps for quick lookup
    this.steps = new Map(flow.steps.map((step: any) => [step.id, step]));
    this.connections = flow.connections || [];
  }

  async executeFromStep(startStepId: string): Promise<Action[]> {
    console.log(`[RuntimeEngine] ========================================`);
    console.log(`[RuntimeEngine] 🚀 STARTING FLOW EXECUTION`);
    console.log(`[RuntimeEngine] Flow ID: ${this.flow.id}`);
    console.log(`[RuntimeEngine] Flow Name: ${this.flow.name}`);
    console.log(`[RuntimeEngine] Session ID: ${this.context.sessionId}`);
    console.log(`[RuntimeEngine] Start Step ID: ${startStepId}`);
    console.log(`[RuntimeEngine] Variables:`, this.context.variables);
    console.log(`[RuntimeEngine] Total steps in flow: ${this.steps.size}`);
    console.log(`[RuntimeEngine] ========================================`);

    const allActions: Action[] = [];
    let currentStepId: string | null = startStepId;

    while (currentStepId) {
      const step = this.steps.get(currentStepId);
      if (!step) {
        console.error(`[RuntimeEngine] ❌ Step not found: ${currentStepId}`);
        break;
      }

      console.log(`[RuntimeEngine] → Executing step: ${step.type} (${step.id})`);
      console.log(`[RuntimeEngine] → Step label: ${step.label}`);

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
        try {
          // Check for new media structure (type + mediaType + mediaUrl/mediaId)
          const { type, text, caption, mediaUrl, mediaId, mediaType, fileName } = config;

          // IMPORTANT: Never use fileUrl - it's a browser blob URL
          if (type === "media" || type === "audio" || type === "document") {
            // Prefer mediaId, fallback to mediaUrl
            const hasMediaId = mediaId && mediaId !== "";
            const hasMediaUrl = mediaUrl && mediaUrl !== "" && !mediaUrl.startsWith("blob:");

            if (!hasMediaId && !hasMediaUrl) {
              console.error("[RuntimeEngine send_message] Missing both mediaId and mediaUrl for media node", step.id);
              // Fallback to text message
              const fallbackText = this.interpolateVariables(caption || text || "Media message");
              actions.push({
                type: "send_whatsapp",
                to: this.context.variables.phone,
                text: fallbackText,
              });
              return {
                actions,
                nextStepId: this.getNextStepId(step.id),
                shouldStop: false,
              };
            }

            console.log(`[RuntimeEngine] Sending ${mediaType || type} - mediaId: ${mediaId || 'none'}, mediaUrl: ${hasMediaUrl ? mediaUrl : 'none'}`);

            actions.push({
              type: "send_whatsapp_media",
              data: {
                to: this.context.variables.phone,
                mediaId: hasMediaId ? mediaId : undefined,
                mediaUrl: hasMediaUrl ? mediaUrl : undefined,
                mediaType: mediaType ?? type,
                caption: this.interpolateVariables(caption ?? text ?? ""),
                fileName: fileName || undefined,
              },
            });

            return {
              actions,
              nextStepId: this.getNextStepId(step.id),
              shouldStop: false,
            };
          }

          // Check if this is a multimedia message (old structure)
          const messageType = config.messageType || "text";

          if (messageType === "multimedia" || messageType === "media") {
            // Handle multimedia messages (image, document, video, audio)
            const mediaId = config.mediaId;
            const mediaUrl = config.mediaUrl || config.url;
            const caption = this.interpolateVariables(config.caption || "");
            const filename = config.filename;
            const mediaFormat = config.mediaFormat || "image";

            console.log(`[RuntimeEngine] Attempting multimedia message - format: ${mediaFormat}`);
            console.log(`[RuntimeEngine] Media ID: ${mediaId || 'none'}, URL: ${mediaUrl || 'none'}`);

            try {
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
              } else {
                throw new Error(`Unsupported media format: ${mediaFormat}`);
              }
              console.log(`[RuntimeEngine] ✓ Multimedia action created`);
            } catch (mediaError) {
              console.error(`[Multimedia Runtime Error] Failed to create media action:`, mediaError);
              // Fallback to text message with caption
              const fallbackText = caption || config.message || "Media message";
              console.log(`[RuntimeEngine] Falling back to text message: "${fallbackText}"`);
              actions.push({
                type: "send_whatsapp",
                to: this.context.variables.phone,
                text: fallbackText,
              });
            }
          } else {
            // Regular text message (DEFAULT PATH - MUST ALWAYS WORK)
            const message = this.interpolateVariables(config.message || config.text || "");
            console.log(`[RuntimeEngine] Text message: "${message}"`);
            actions.push({
              type: "send_whatsapp",
              to: this.context.variables.phone,
              text: message,
            });
          }
        } catch (error) {
          console.error(`[Send Message Runtime Error]`, error);
          // Ultimate fallback: send error message so flow doesn't completely die
          actions.push({
            type: "send_whatsapp",
            to: this.context.variables.phone,
            text: config.message || config.text || "Message",
          });
        }

        // Continue to next node (e.g., to reach multipleChoice after intro message)
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
        try {
          // Handle multipleChoice nodes (MultipleChoiceNode.tsx)
          const mcMessage = config.message || config.questionText || "";
          const mcQuestion = this.interpolateVariables(mcMessage);
          const mcOptions = config.options || [];

          console.log(`[RuntimeEngine] ========================================`);
          console.log(`[RuntimeEngine] Executing multipleChoice step: ${step.id}`);
          console.log(`[RuntimeEngine] Contact: ${this.context.variables.phone}`);
          console.log(`[RuntimeEngine] Question text: "${mcQuestion}"`);
          console.log(`[RuntimeEngine] Options count: ${mcOptions.length}`);
          console.log(`[RuntimeEngine] Options:`, mcOptions.map((opt: any) => `${opt.id}: "${opt.label || opt.title}"`));

          // Build interactive button payload - WhatsApp Cloud API format
          const buttons = mcOptions.map((opt: any, index: number) => ({
            type: "reply",
            reply: {
              id: opt.id,
              title: (opt.label || opt.title || `Opción ${index + 1}`).substring(0, 20), // WhatsApp limit: 20 chars
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
          console.log(`[RuntimeEngine] ✓ Interactive buttons action created with ${buttons.length} buttons`);
          console.log(`[RuntimeEngine] ========================================`);
        } catch (error) {
          console.error(`[MultipleChoice Runtime Error]`, error);
          // Fallback to numbered list only on error
          const mcMessage = config.message || config.questionText || "";
          const mcQuestion = this.interpolateVariables(mcMessage);
          const mcOptions = config.options || [];

          let fullMessage = mcQuestion;
          if (mcOptions.length > 0) {
            fullMessage += "\n\n";
            mcOptions.forEach((opt: any, index: number) => {
              fullMessage += `${index + 1}. ${opt.label || opt.title || `Option ${index + 1}`}\n`;
            });
            fullMessage += "\nResponde con el número de tu opción.";
          }
          actions.push({
            type: "send_whatsapp",
            to: this.context.variables.phone,
            text: fullMessage,
          });
        }

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
        console.log(`[RuntimeEngine] ========================================`);
        console.log(`[RuntimeEngine] 👤 ASSIGN_CONVERSATION STEP`);
        console.log(`[RuntimeEngine] Step ID: ${step.id}`);
        console.log(`[RuntimeEngine] Full config object:`, JSON.stringify(config, null, 2));
        console.log(`[RuntimeEngine] Parsed agentType: ${config.agentType}`);
        console.log(`[RuntimeEngine] Parsed agentId: ${config.agentId}`);
        console.log(`[RuntimeEngine] Parsed assignToSelf: ${config.assignToSelf}`);
        console.log(`[RuntimeEngine] ========================================`);

        // Resolve the assignee
        let resolvedAssigneeId: string | null = null;
        const agentType = config.agentType || "human"; // Default to human

        console.log(`[RuntimeEngine] → agentType (with default): "${agentType}"`);

        // If assignToSelf is true or agentId is null/undefined, use default agent
        if (config.assignToSelf === true || !config.agentId) {
          console.log(`[RuntimeEngine] → Using default agent logic (assignToSelf=${config.assignToSelf}, agentId=${config.agentId})`);
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
          console.log(`[RuntimeEngine] → Using specified agent ID from config`);
          console.log(
            `[RuntimeEngine] → Assigning to ${agentType} agent: ${resolvedAssigneeId} ` +
            `for session ${this.context.sessionId}`
          );
        }

        console.log(`[RuntimeEngine] ========================================`);
        console.log(`[RuntimeEngine] 📋 FINAL RESOLVED VALUES:`);
        console.log(`[RuntimeEngine] → resolvedAssigneeId: ${resolvedAssigneeId}`);
        console.log(`[RuntimeEngine] → agentType: ${agentType}`);
        console.log(`[RuntimeEngine] → chatId: ${this.context.chatId || 'not provided'}`);
        console.log(`[RuntimeEngine] ========================================`);

        // Update Chat record if chatId is provided and agentType is AI
        if (this.context.chatId && agentType === "ai" && resolvedAssigneeId) {
          console.log(`[RuntimeEngine] 🤖 Updating Chat record with AI agent assignment...`);
          try {
            const updatedChat = await prisma.chat.update({
              where: { id: this.context.chatId },
              data: {
                assignedAgentType: "AI",
                assignedAgentId: resolvedAssigneeId,
                assignedToUserId: null,
                aiDisabled: false,
                // Same context isolation as the "AI agent" action
                aiContextStartedAt: this.context.variables.sessionStartedAt
                  ? new Date(this.context.variables.sessionStartedAt)
                  : new Date(),
              },
            });
            console.log(`[RuntimeEngine] ✅✅✅ Chat record updated successfully!`);
            console.log(`[RuntimeEngine] Updated Chat:`, JSON.stringify({
              id: updatedChat.id,
              assignedAgentType: updatedChat.assignedAgentType,
              assignedAgentId: updatedChat.assignedAgentId,
            }, null, 2));
          } catch (chatUpdateError) {
            console.error(`[RuntimeEngine] ❌ Failed to update Chat record:`, chatUpdateError);
          }
        } else if (!this.context.chatId) {
          console.log(`[RuntimeEngine] ⚠️ No chatId provided - skipping Chat record update`);
        } else if (agentType !== "ai") {
          console.log(`[RuntimeEngine] ℹ️ agentType is "${agentType}" (not "ai") - skipping Chat record update`);
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
          assigneeType: agentType,
          assignToSelf: config.assignToSelf === true || !config.agentId,
          sessionId: this.context.sessionId,
          flowName: this.flow.name,
        });

        return {
          actions,
          nextStepId: this.getNextStepId(step.id),
          shouldStop: false,
        };

      case "condition": {
        // Flow builder format: conditions[] + output handles "cumple" / "no_cumple"
        if (Array.isArray(config.conditions)) {
          const met = await evaluateConditions(config.conditions, {
            message: this.context.variables.lastReply ?? this.context.variables.message,
            contactId: this.context.variables.contactId,
            phone: this.context.variables.phone,
          });
          console.log(`[RuntimeEngine] Condition ${step.id}: ${met ? "cumple" : "no cumple"}`);
          return { actions: [], nextStepId: this.getBranchStepId(step.id, met), shouldStop: false };
        }
        // Legacy format: variable/operator/value + "true"/"false" labels
        const conditionMet = this.evaluateCondition(config);
        return { actions: [], nextStepId: this.getConditionalNextStep(step.id, conditionMet), shouldStop: false };
      }

      case "ai_agent":
        return this.executeAiAgentStep(step, config);

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

  /** Next step for a yes/no branch. An unconnected branch ends the flow (never falls through to the other branch). */
  private getBranchStepId(currentStepId: string, conditionMet: boolean): string | null {
    const handles = conditionMet ? ["cumple", "true", "yes"] : ["no_cumple", "false", "no"];
    const connection = this.connections.find(
      (conn) =>
        conn.fromStepId === currentStepId &&
        (handles.includes(conn.sourceHandle) || handles.includes(conn.conditionLabel))
    );
    return connection ? connection.toStepId : null;
  }

  /**
   * "AI agent" flow action: activate, change or stop the AI agent that handles
   * this conversation. The flow decides which agent; the agent's own record
   * holds its personality, knowledge and settings.
   */
  private async executeAiAgentStep(step: { id: string }, config: AiAgentStepConfig): Promise<StepExecutionResult> {
    const next = { nextStepId: this.getNextStepId(step.id), shouldStop: false };
    const mode: "activate" | "change" | "stop" = config.aiAction === "stop" || config.aiAction === "change" ? config.aiAction : "activate";
    const chatId = this.context.chatId;

    if (!chatId) {
      console.warn(`[RuntimeEngine] ai_agent step ${step.id}: no chat for this session - skipped`);
      return { actions: [], ...next };
    }

    if (mode === "stop") {
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          assignedAgentType: null,
          assignedAgentId: null,
          lastQuestionSentAt: null,
          lastQuestionAttempts: 0,
          lastQuestionMessageId: null,
        },
      });
      const message = config.stopMessage ? this.interpolateVariables(String(config.stopMessage)) : "";
      return {
        actions: message ? [{ type: "send_whatsapp", to: this.context.variables.phone, text: message }] : [],
        ...next,
      };
    }

    const agent = config.agentId
      ? await prisma.aiAgent.findUnique({ where: { id: config.agentId }, select: { id: true, name: true, isActive: true } })
      : null;
    if (!agent || !agent.isActive) {
      console.warn(`[RuntimeEngine] ai_agent step ${step.id}: agent ${config.agentId || "(none)"} missing or inactive - skipped`);
      return { actions: [], ...next };
    }

    // New context segment unless the flow explicitly keeps the previous one.
    // It starts at the message that started this flow, so the agent sees this
    // flow's exchange but nothing from earlier agents/businesses.
    const keepContext = mode === "change" && config.resetContext === false;
    const segmentStart = this.context.variables.sessionStartedAt ? new Date(this.context.variables.sessionStartedAt) : new Date();

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        assignedAgentType: "AI",
        assignedAgentId: agent.id,
        assignedToUserId: null,
        aiDisabled: false,
        lastQuestionSentAt: null,
        lastQuestionAttempts: 0,
        lastQuestionMessageId: null,
        ...(keepContext ? {} : { aiContextStartedAt: segmentStart }),
      },
    });
    console.log(`[RuntimeEngine] AI agent ${mode}: ${agent.name} (${agent.id}) for chat ${chatId}`);

    return {
      actions: [{ type: "ai_agent", mode, agentId: agent.id, respondNow: config.respondNow !== false }],
      ...next,
    };
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
      // For runtime engine context, we don't have deviceId, so we'll find any matching phone
      let contact = await prisma.contact.findFirst({
        where: { phone: phoneNumber },
      });

      if (!contact) {
        // Create contact if it doesn't exist (with empty deviceId for non-device contacts)
        contact = await prisma.contact.create({
          data: {
            phone: phoneNumber,
            deviceId: "",
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
