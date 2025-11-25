import { Node, Edge } from "reactflow";

export interface ValidationError {
  type: "error" | "warning";
  message: string;
  code?: string;
  nodeId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if flow has at least a start node
  const startNode = nodes.find((n) => n.type === "start");
  if (!startNode) {
    errors.push({
      type: "error",
      message: "El flujo debe tener un nodo de inicio",
    });
    return { isValid: false, errors };
  }

  // Validate trigger configuration
  if (startNode.data.hasTrigger && startNode.data.triggerConfig) {
    const triggerConfig = startNode.data.triggerConfig;

    if (!triggerConfig.type || triggerConfig.type === 'none') {
      errors.push({
        type: "error",
        message: "El disparador no está configurado. Debes seleccionar un tipo de disparador.",
        nodeId: startNode.id,
      });
    } else if (triggerConfig.type === 'tag_added') {
      if (!triggerConfig.tagId) {
        errors.push({
          type: "error",
          message: "El disparador 'Tag agregado' requiere que selecciones un tag.",
          nodeId: startNode.id,
        });
      }
      if (!triggerConfig.deviceId) {
        errors.push({
          type: "error",
          message: "El disparador 'Tag agregado' requiere que selecciones un dispositivo.",
          nodeId: startNode.id,
        });
      }
    } else if (triggerConfig.type === 'message_received') {
      if (!triggerConfig.keywords || triggerConfig.keywords.length === 0) {
        errors.push({
          type: "error",
          message: "El disparador 'Mensaje recibido' requiere al menos una palabra o frase clave.",
          nodeId: startNode.id,
        });
      }
      if (!triggerConfig.deviceId) {
        errors.push({
          type: "error",
          message: "El disparador 'Mensaje recibido' requiere que selecciones un dispositivo.",
          nodeId: startNode.id,
        });
      }
    } else if (triggerConfig.type === 'third_party') {
      if (!triggerConfig.fields || triggerConfig.fields.length === 0) {
        errors.push({
          type: "error",
          message: "El disparador 'Integración con terceros' requiere al menos un campo configurado.",
          nodeId: startNode.id,
        });
      }
    }
  }

  // Check for disconnected nodes (excluding start and placeholders)
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  nodes.forEach((node) => {
    if (node.type === "placeholder") return;

    if (node.id !== "start" && !connectedNodeIds.has(node.id)) {
      errors.push({
        type: "warning",
        message: `El nodo "${node.data.label || node.type}" está desconectado`,
        nodeId: node.id,
      });
    }
  });

  // Validate message nodes
  nodes.forEach((node) => {
    if (node.type === "send_message") {
      const data = node.data;

      if (!data.type) {
        errors.push({
          type: "error",
          message: "Mensaje: debe seleccionar un tipo de mensaje",
          nodeId: node.id,
        });
        return;
      }

      // Validate based on message type
      switch (data.type) {
        case "text":
          if (!data.text || data.text.trim() === "") {
            errors.push({
              type: "error",
              message: "Mensaje de texto: debe escribir un mensaje",
              nodeId: node.id,
            });
          }
          break;
        case "media":
        case "audio":
        case "document":
          // Check for mediaUrl (new) or fileUrl (legacy) - but prefer mediaUrl
          if (!data.mediaUrl && !data.fileUrl) {
            errors.push({
              type: "error",
              message: `Mensaje ${data.type}: debe cargar un archivo`,
              nodeId: node.id,
            });
          }
          // Warn if using blob URL (won't work with WhatsApp Cloud API)
          if (data.mediaUrl && data.mediaUrl.startsWith("blob:")) {
            errors.push({
              type: "error",
              message: `Mensaje ${data.type}: URL de archivo no válida (blob: URL). Debe subir el archivo al servidor.`,
              nodeId: node.id,
            });
          }
          if (data.fileUrl && data.fileUrl.startsWith("blob:") && !data.mediaUrl) {
            errors.push({
              type: "error",
              message: `Mensaje ${data.type}: URL de archivo no válida (blob: URL). Debe subir el archivo al servidor.`,
              nodeId: node.id,
            });
          }
          break;
        case "contact":
          if (!data.name || data.name.trim() === "") {
            errors.push({
              type: "error",
              message: "Contacto: debe proporcionar un nombre",
              nodeId: node.id,
            });
          }
          if (!data.useConnectedNumber && (!data.phone || data.phone.trim() === "")) {
            errors.push({
              type: "error",
              message: "Contacto: debe proporcionar un número de teléfono",
              nodeId: node.id,
            });
          }
          break;
      }

      // Validate delay
      if (data.delaySeconds !== undefined) {
        const min = data.type === "text" ? 3 : 5;
        const max = 60;
        if (data.delaySeconds < min || data.delaySeconds > max) {
          errors.push({
            type: "error",
            message: `Mensaje: tiempo entre mensaje debe estar entre ${min} y ${max} segundos`,
            nodeId: node.id,
          });
        }
      }
    }

    // Validate condition nodes
    if (node.type === "condition") {
      const conditions = node.data.conditions || [];
      if (conditions.length === 0) {
        errors.push({
          type: "error",
          message: "Condición: debe agregar al menos una condición",
          nodeId: node.id,
        });
      }
    }

    // Validate multiple choice nodes
    if (node.type === "multipleChoice") {
      const options = node.data.options || [];
      if (options.length === 0) {
        errors.push({
          type: "error",
          message: "Pregunta múltiple: debe agregar al menos una opción",
          nodeId: node.id,
        });
      }

      // Validate each option has a next step
      const nodeEdges = edges.filter((e) => e.source === node.id);
      options.forEach((opt: any) => {
        const hasEdge = nodeEdges.some((e) => e.sourceHandle === opt.id);
        if (!hasEdge) {
          errors.push({
            type: "error",
            code: "OPTION_NO_NEXT_STEP",
            message: `La opción "${opt.title || opt.label || 'sin texto'}" no tiene un siguiente paso conectado`,
            nodeId: node.id,
          });
        }
      });
    }

    // Validate wait nodes
    if (node.type === "wait") {
      if (!node.data.waitUnit || !node.data.waitValue) {
        errors.push({
          type: "error",
          message: "Espera: debe configurar el tiempo de espera",
          nodeId: node.id,
        });
      }
    }

    // Validate rotator nodes
    if (node.type === "rotator") {
      const options = node.data.options || [];
      if (options.length < 2) {
        errors.push({
          type: "error",
          message: "Rotador: debe tener al menos 2 opciones",
          nodeId: node.id,
        });
      }
    }
  });

  // Check for nodes that should have outgoing connections
  nodes.forEach((node) => {
    if (node.type === "placeholder" || node.type === "assign_conversation") return;

    const hasOutgoingEdge = edges.some((edge) => edge.source === node.id);

    if (!hasOutgoingEdge && node.type !== "start") {
      errors.push({
        type: "warning",
        message: `El nodo "${node.data.label || node.type}" no tiene conexión de salida`,
        nodeId: node.id,
      });
    }
  });

  const hasOnlyErrors = errors.filter((e) => e.type === "error").length > 0;

  return {
    isValid: !hasOnlyErrors,
    errors,
  };
}
