import { sendWhatsAppTextMessage } from "./whatsapp";

interface FlowContext {
  from: string;
  text: string;
}

/**
 * Minimal flow engine for incoming messages
 */
export async function runFlowForIncomingMessage({ from, text }: FlowContext) {
  const lowerText = text.toLowerCase();

  // Simple keyword-based responses
  if (lowerText.includes("hola")) {
    await sendWhatsAppTextMessage(from, "¡Hola! Esta es una respuesta automática de pruebas.");
    return { handled: true };
  }

  // TODO: Add real flow logic here
  // - Match against automation triggers
  // - Execute flow steps
  // - Store conversation state

  return { handled: false };
}
