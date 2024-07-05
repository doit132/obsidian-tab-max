import { WorkspaceLeaf } from "obsidian";

export type MaxTabCountSettings = {
    delayInMs: number;
    maxTabCount: number;
};

export type RealLifeWorkspaceLeaf = WorkspaceLeaf & {
    activeTime: number;
    history: {
        back: () => void;
        backHistory: any[];
    };
    id: string;
    pinned: boolean;
    parent: { id: string };
};
