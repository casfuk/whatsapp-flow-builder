export interface Action {
  type: "send_whatsapp" | "send_whatsapp_interactive" | "send_whatsapp_media" | "send_email" | "send_whatsapp_template" | "wait" | "assign_to_admin" | "assign_conversation";
  [key: string]: any;
}

export interface SendWhatsAppAction extends Action {
  type: "send_whatsapp";
  to: string;
  text: string;
}

export interface SendWhatsAppInteractiveAction extends Action {
  type: "send_whatsapp_interactive";
  to: string;
  interactive: any;
}

export interface SendWhatsAppMediaAction extends Action {
  type: "send_whatsapp_media";
  data: {
    to: string;
    mediaType: "image" | "document" | "video" | "audio" | "media";
    mediaId?: string;
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
  };
  // Legacy structure (deprecated)
  to?: string;
  mediaType?: "image" | "document" | "video" | "audio";
  image?: any;
  document?: any;
  video?: any;
  audio?: any;
}

export interface SendEmailAction extends Action {
  type: "send_email";
  to: string;
  subject: string;
  body: string;
}

export interface SendTemplateAction extends Action {
  type: "send_whatsapp_template";
  to: string;
  template: string;
  variables: Record<string, any>;
}

export interface WaitAction extends Action {
  type: "wait";
  duration: number;
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface AssignToAdminAction extends Action {
  type: "assign_to_admin";
  admin: string;
}

export interface AssignConversationAction extends Action {
  type: "assign_conversation";
  assigneeId: string | null;
  assigneeType?: "human" | "ai";
  sessionId: string;
}

export type FlowAction =
  | SendWhatsAppAction
  | SendWhatsAppInteractiveAction
  | SendWhatsAppMediaAction
  | SendEmailAction
  | SendTemplateAction
  | WaitAction
  | AssignToAdminAction
  | AssignConversationAction;
