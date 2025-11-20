import { prisma } from "@/lib/prisma";

export interface WhatsAppClient {
  sendTextMessage(params: { to: string; body: string }): Promise<void>;
  markAsRead?(params: { messageId: string }): Promise<void>;
}

// Stub: Cloud API implementation
class CloudApiClient implements WhatsAppClient {
  constructor(private config: any) {}

  async sendTextMessage(params: { to: string; body: string }): Promise<void> {
    console.log("[CloudApiClient] Would send:", params);
    // TODO: Implement Cloud API call
  }

  async markAsRead(params: { messageId: string }): Promise<void> {
    console.log("[CloudApiClient] Would mark as read:", params);
  }
}

// Stub: QR Session implementation
class QrSessionClient implements WhatsAppClient {
  constructor(private config: any) {}

  async sendTextMessage(params: { to: string; body: string }): Promise<void> {
    console.log("[QrSessionClient] Would send:", params);
    // TODO: Implement QR session send
  }

  async markAsRead(params: { messageId: string }): Promise<void> {
    console.log("[QrSessionClient] Would mark as read:", params);
  }
}

// Factory: Get WhatsApp client for workspace
export async function getWhatsAppClient(workspaceId?: string): Promise<WhatsAppClient> {
  const config = await prisma.whatsAppConfig.findFirst({
    where: { workspaceId: workspaceId || null },
  });

  if (!config) {
    throw new Error("No WhatsApp configuration found for workspace");
  }

  if (config.mode === "cloud_api") {
    return new CloudApiClient(config);
  }

  if (config.mode === "qr_session") {
    return new QrSessionClient(config);
  }

  throw new Error(`Unknown WhatsApp mode: ${config.mode}`);
}
