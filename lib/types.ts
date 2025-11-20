import { Node, Edge } from "reactflow";

export type StepType =
  | "start"
  | "send_message"
  | "question_multiple"
  | "question_simple"
  | "wait"
  | "assign_conversation"
  | "condition"
  | "rotator"
  | "start_automation"
  | "template"
  | "assign_ai_agent";

export interface BaseStepConfig {
  type: StepType;
}

export interface SendMessageConfig extends BaseStepConfig {
  type: "send_message";
  message: string;
}

export interface QuestionSimpleConfig extends BaseStepConfig {
  type: "question_simple";
  question: string;
  saveAs?: string;
}

export interface QuestionMultipleConfig extends BaseStepConfig {
  type: "question_multiple";
  question: string;
  options: string[];
  saveAs?: string;
}

export interface WaitConfig extends BaseStepConfig {
  type: "wait";
  duration: number;
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface ConditionConfig extends BaseStepConfig {
  type: "condition";
  variable: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface TemplateConfig extends BaseStepConfig {
  type: "template";
  templateName: string;
  variables: Record<string, string>;
}

export interface AssignConversationConfig extends BaseStepConfig {
  type: "assign_conversation";
  assignTo: string;
}

export interface RotatorConfig extends BaseStepConfig {
  type: "rotator";
  options: string[];
}

export interface StartAutomationConfig extends BaseStepConfig {
  type: "start_automation";
  automationId: string;
}

export interface AssignAIAgentConfig extends BaseStepConfig {
  type: "assign_ai_agent";
  agentId: string;
  prompt?: string;
}

export interface StartConfig extends BaseStepConfig {
  type: "start";
}

export type StepConfig =
  | StartConfig
  | SendMessageConfig
  | QuestionSimpleConfig
  | QuestionMultipleConfig
  | WaitConfig
  | ConditionConfig
  | TemplateConfig
  | AssignConversationConfig
  | RotatorConfig
  | StartAutomationConfig
  | AssignAIAgentConfig;

export type FlowNode = Node<{
  label: string;
  config: StepConfig;
  stepId?: string;
}>;

export type FlowEdge = Edge<{
  label?: string;
}>;
