import { App, Modal, Plugin, WorkspaceLeaf } from 'obsidian';
import { PLUGIN_INFO } from "./plugin-info";
import { MaxTabCountSettingTab } from "./settings";
import type { MaxTabCountSettings, RealLifeWorkspaceLeaf } from "./types";

// 定义一个接口, 接口中有一个名为 `mySetting` 的属性
const DEFAULT_SETTINGS: MaxTabCountSettings = {
    delayInMs: 100,
    maxTabCount: 7,
}

export default class MaxTabCount extends Plugin {
    private pluginName = `Plugin MaxTabCount v${PLUGIN_INFO.pluginVersion}`;
    private processors: Map<string, Promise<void>> = new Map();
    private unpinnedFileArray: WorkspaceLeaf[] = new Array(10);

    settings: MaxTabCountSettings;

    async onload() {
        await this.loadSettings();

        // 从 app 中获取 workspace 对象, 并赋值给 `workspace` 变量
        const { workspace } = this.app;

        workspace.onLayoutReady(() => {
            // 注册事件
            this.registerEvent(
                workspace.on("active-leaf-change", this.onActiveLeafChange.bind(this)),
            );

            console.log(`${this.pluginName} initialized`);
        });


        // const { vault } = this.app;
        // this.registerEvent(vault.on('create', () => {
        //     // new Notice('a new file has entered the arena')
        // }));

        // 这将在左侧ribbon中创建一个图标
        // const ribbonIconEl = this.addRibbonIcon('dice', 'tabs-max-number', (evt: MouseEvent) => {
        //     // Called when the user clicks the icon.
        //     // new Notice('help  fff');
        //     this.app.workspace.getLeftLeaf(false);
        //     this.app.workspace.iterateAllLeaves((leaf) => {
        //         console.log(leaf.getViewState().type);
        //     });
        // });
        // // Perform additional things with the ribbon
        // ribbonIconEl.addClass('my-plugin-ribbon-class');

        // // 这将在应用程序的底部添加一个状态栏项目。在移动应用程序上不起作用
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status Bar Text');

        // // 这添加了一个可以在任何地方触发的简单命令
        // this.addCommand({
        //     id: 'open-sample-modal-simple',
        //     name: 'Open sample modal (simple)',
        //     callback: () => {
        //         new SampleModal(this.app).open();
        //     }
        // });
        // // 这将添加一个编辑器命令，该命令可以对当前编辑器实例执行某些操作
        // this.addCommand({
        //     id: 'sample-editor-command',
        //     name: 'Sample editor command',
        //     editorCallback: (editor: Editor, view: MarkdownView) => {
        //         console.log(editor.getSelection());
        //         editor.replaceSelection('Sample Editor Command');
        //     }
        // });
        // // 这增加了一个复杂的命令，可以检查应用程序的当前状态是否允许执行该命令
        // this.addCommand({
        //     id: 'open-sample-modal-complex',
        //     name: 'Open sample modal (complex)',
        //     checkCallback: (checking: boolean) => {
        //         // Conditions to check
        //         const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        //         if (markdownView) {
        //             // If checking is true, we're simply "checking" if the command can be run.
        //             // If checking is false, then we want to actually perform the operation.
        //             if (!checking) {
        //                 new SampleModal(this.app).open();
        //             }

        //             // This command will only show up in Command Palette when the check function returns true
        //             return true;
        //         }
        //     }
        // });

        // 这增加了一个设置选项卡，以便用户可以配置插件的各个方面
        this.addSettingTab(new MaxTabCountSettingTab(this.app, this));

        // // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // // Using this function will automatically remove the event listener when this plugin is disabled.
        // this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        //     console.log('click', evt);
        // });

        // // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        // this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
        console.log(`${this.pluginName} unloaded`);
    }

    async loadSettings() {
        this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async onActiveLeafChange(
        activeLeaf: RealLifeWorkspaceLeaf,
    ): Promise<void> {
        const { id } = activeLeaf;

        var openedFileCount = this.getOpenedLeafsCount();
        console.log("打开了" + openedFileCount + "个标签页");

        if (this.processors.has(id)) {
            this.logMsg(id, "❌ Already processing leaf");
            return;
        }

        const processor = this.processActiveLeaf(activeLeaf);
        this.processors.set(id, processor);

        try {
            await processor;
        } finally {
            this.processors.delete(id);
            this.logMsg(id, "Finished processing");
        }
    }

    private async processActiveLeaf(
        activeLeaf: RealLifeWorkspaceLeaf,
    ): Promise<void> {
        const leafID = activeLeaf.id;
        const logMsg = (label: string, payload: any = "") =>
            this.logMsg(leafID, label, payload);

        logMsg(
            "Processing leaf",
            { file: activeLeaf.view.getState().file, parent: activeLeaf.parent.id },
        );

        const filePath = activeLeaf.view.getState().file;
        if (!filePath) {
            logMsg("Contains no file");
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const { workspace } = this.app;
            const viewType = activeLeaf?.view.getViewType();

            // Find all leaves of the same type, in the same window, which show the same
            // file as the one in the active leaf, sorted by age. The oldest tab will be
            // the first element. This list excludes the active leaf.
            const duplicateLeaves =
                (workspace.getLeavesOfType(viewType) as RealLifeWorkspaceLeaf[])
                    // Keep this pane's leaves which show the same file as the active leaf
                    .filter((l) =>
                        l.parent.id === activeLeaf.parent.id &&
                        l.id !== leafID &&
                        l.view?.getState().file === filePath
                    )
                    // Sort by `activeTime`, most recent first, but push all never-active
                    // leaves to the end
                    .sort((l1, l2) => {
                        if (l1.activeTime === 0) return -1;
                        if (l2.activeTime === 0) return 1;
                        return l2.activeTime - l1.activeTime;
                    });

            // No duplicates found, nothing to do
            if (duplicateLeaves.length === 0) {
                logMsg("No duplicates found");
                return resolve();
            }

            // Find the target tab that we'll need to focus in a moment
            const targetToFocus = (
                duplicateLeaves.find((l) => l.pinned) ||
                duplicateLeaves.find((l) => !l.pinned)
            ) as RealLifeWorkspaceLeaf;

            // Deferring the operation for a bit to give Obsidian time to update the
            // tab's history. Without this `setTimeout()`, the history would not be
            // updated properly yet, and the "has history?" check below would fail.
            // ¯\_(ツ)_/¯
            setTimeout(() => {
                // Keep the cursor position and scroll position of the active leaf for
                // later reuse.
                const ephemeralState = { ...activeLeaf.getEphemeralState() };
                const hasEphemeralState = Object.keys(ephemeralState).length > 0;

                // If the active leaf has history, go back, then focus the target tab
                if (
                    activeLeaf.view.navigation &&
                    activeLeaf.history.backHistory.length > 0
                ) {
                    // This will trigger another `active-leaf-change` event, but since this
                    // leaf is already being processed, that new event will be ignored
                    activeLeaf.history.back();
                    logMsg("history.back");
                } //
                // The active leaf has no history but is pinned, so we'll leave it
                // alone and just back off here.
                else if (activeLeaf.pinned) {
                    logMsg("pinned tab, not detaching");
                    return resolve();
                } //
                // The active leaf has no history, so we'll close it after focussing the
                // new target tab
                else {
                    activeLeaf.detach();
                    logMsg("detach");
                }

                // Focus the target tab after a short delay. Without the delay, the tab
                // operation would fail silently, i.e. the tab would not be focused.
                setTimeout(() => {
                    workspace.setActiveLeaf(targetToFocus, { focus: true });
                    if (hasEphemeralState) {
                        targetToFocus.setEphemeralState(ephemeralState);
                    }
                }, this.settings.delayInMs);

                // Resolve the promise.
                resolve();
            }, this.settings.delayInMs);
        });
    }

    private getUnpinnedLeaf(): WorkspaceLeaf[] {
        const { workspace } = this.app;

        workspace.iterateRootLeaves((leaf) => {
            console.log(leaf.getViewState().pinned);
            if (leaf.getViewState().pinned) {

            } else {
                this.unpinnedFileArray.push(leaf);
            }
        });

        return this.unpinnedFileArray;
    }

    // 获取打开的标签页数量
    private getOpenedLeafsCount(): Number {
        const { workspace } = this.app;
        var pinned_file_count = 0;
        var unpinned_file_count = 0;
        workspace.iterateRootLeaves((leaf) => {
            console.log(leaf.getViewState().pinned);
            if (leaf.getViewState().pinned) {
                pinned_file_count++;
            } else {
                unpinned_file_count++;
            }
        });
        return (pinned_file_count + unpinned_file_count);
    }

    private logMsg(leafID: string, label: string, payload: any = "") {
        console.log(`[${leafID}] ${label}`, payload);
    }

}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
