export type TriggerType = 'none' | 'message_received' | 'tag_added' | 'third_party';

export type MatchMode = 'contains' | 'exact' | 'all';

export interface TagAddedTrigger {
  id: string;
  name: string;
  type: 'tag_added';
  tagId: string | null;
  deviceId: string | null;
  oncePerContact: boolean;
}

export interface MessageReceivedTrigger {
  id: string;
  name: string;
  type: 'message_received';
  deviceId: string | null;
  matchMode: MatchMode;     // 'contains' | 'exact' | 'all'
  keywords: string[];       // list of phrases
  oncePerContact: boolean;
  smartTrigger?: boolean;   // IA Disparador Inteligente
}

export interface ThirdPartyTrigger {
  id: string;
  name: string;
  type: 'third_party';
  deviceId?: string | null;
  webhookUrl?: string;
  fields: { label: string; key: string }[];
  oncePerContact: boolean;
}

export interface NoneTrigger {
  id: string;
  name: string;
  type: 'none';
  oncePerContact: boolean;
}

export type TriggerConfig = TagAddedTrigger | MessageReceivedTrigger | ThirdPartyTrigger | NoneTrigger;

export const getTriggerTypeLabel = (type: TriggerType): string => {
  switch (type) {
    case 'none':
      return 'Sin disparador';
    case 'message_received':
      return 'Mensaje recibido';
    case 'tag_added':
      return 'Tag agregado';
    case 'third_party':
      return 'Integración con terceros';
    default:
      return 'Sin disparador';
  }
};
