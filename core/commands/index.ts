import { Config, CustomCommand, SlashCommand, SlashCommandDescription } from "..";
import { stripImages } from "../llm/countTokens";
import { renderTemplatedString } from "../llm/llms";
import SlashCommands from "./slash";
import { promptAsCodeCommandGenerator } from "./slash/promptAsCode";

export function slashFromCustomCommand(
	customCommand: CustomCommand,
): SlashCommand {
	return {
		name: customCommand.name,
		description: customCommand.description,
		run: async function* ({ input, llm, history, ide }) {
			// Remove slash command prefix from input
			let userInput = input;
			if (userInput.startsWith(`/${customCommand.name}`)) {
				userInput = userInput
					.slice(customCommand.name.length + 1, userInput.length)
					.trimStart();
			}

			// Render prompt template
			const promptUserInput = await renderTemplatedString(
				customCommand.prompt,
				ide.readFile.bind(ide),
				{ input: userInput },
			);

			const messages = [...history];
			// Find the last chat message with this slash command and replace it with the user input
			for (let i = messages.length - 1; i >= 0; i--) {
				if (
					messages[i].role === "user" &&
					stripImages(messages[i].content).startsWith(`/${customCommand.name}`)
				) {
					messages[i] = { ...messages[i], content: promptUserInput };
					break;
				}
			}

			for await (const chunk of llm.streamChat(messages)) {
				yield stripImages(chunk.content);
			}
		},
	};
}

export function slashCommandFromDescription(
	desc: SlashCommandDescription,
): SlashCommand | undefined {
	const cmd = SlashCommands.find((cmd) => cmd.name === desc.name);
	if (!cmd) {
		return undefined;
	}
	return {
		...cmd,
		params: desc.params,
	};
}

export function filesUnderPromptFolder(promptFolder: string) {

	// read name from file
    //const promptFolder: string = "/Users/laviviana.proano/Documents/ia/continue/prompt"
    // final folder = config.basefoldeForTheproject + "./prompt"

    const fs = require("fs");

    // log... save something on a txt file
    console.log(promptFolder);

    // read description from file

    const promptFiles: string[] = fs.readdirSync(promptFolder);
	return promptFiles;
    /*promptFiles.forEach((promptFilename) => {
        const fileContent: string = fs.readFileSync(
        `${promptFolder}/${promptFilename}`,
        "utf-8"
        );
        const [name, description, run]: string[] = fileContent.split("\n");
*/
	// return here a list of files
}


export function slashCommandFromFile(file: String): SlashCommand {
	return promptAsCodeCommandGenerator(file);
}


