import { App, PluginSettingTab, Setting } from "obsidian";
import MaxTabCount from "./main";

export class MaxTabCountSettingTab extends PluginSettingTab {
    plugin: MaxTabCount;

    private delayOptions: number[] = [
        100,
        150,
        200,
        300,
        500,
    ];


    constructor(app: App, plugin: MaxTabCount) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl, plugin } = this;

        containerEl.empty();
        containerEl.createEl("h2", { text: "MaxTabCount Settings" });

        const delayOptionsRecord = this.delayOptions
            .reduce(
                (acc, current) => {
                    acc[`${current}`] = `${current}ms`;
                    return acc;
                },
                {} as Record<string, string>,
            );

        // Output format
        new Setting(containerEl)
            .setName("Delay before close tab")
            .setDesc(``)
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(delayOptionsRecord)
                    .setValue(`${plugin.settings.delayInMs}`)
                    .onChange(
                        async (value) => {
                            plugin.settings.delayInMs = +value;
                            await plugin.saveSettings();
                            this.display();
                        },
                    );
            });

        new Setting(containerEl)
            .setName('maxTabCount')
            .setDesc('最大允许打开的标签页数量')
            .addText(text =>
                text
                    .setPlaceholder('Enter count (0-100)')
                    .setValue(`${plugin.settings.maxTabCount}`.toString())
                    .onChange(async value => {
                            plugin.settings.maxTabCount = +value;
                            await plugin.saveSettings();
                            this.display();
                        },
                    )
            );
    }


}


