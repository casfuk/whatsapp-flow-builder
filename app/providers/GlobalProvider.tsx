'use client';

import { create } from "zustand";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
};

type Flow = {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
};

type GlobalState = {
  whatsappNumber: string;
  defaultAgent: string;
  contacts: Contact[];
  flows: Flow[];
  setWhatsappNumber: (v: string) => void;
  setDefaultAgent: (v: string) => void;
  setContacts: (contacts: Contact[]) => void;
  addContact: (c: Contact) => void;
  setFlows: (flows: Flow[]) => void;
};

export const useGlobal = create<GlobalState>((set) => ({
  whatsappNumber: "",
  defaultAgent: "",
  contacts: [],
  flows: [],
  setWhatsappNumber: (v) => set({ whatsappNumber: v }),
  setDefaultAgent: (v) => set({ defaultAgent: v }),
  setContacts: (contacts) => set({ contacts }),
  addContact: (c) => set((s) => ({ contacts: [...s.contacts, c] })),
  setFlows: (flows) => set({ flows }),
}));
