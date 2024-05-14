import {
  Config,
  CustomCommand,
  SlashCommand,
  SlashCommandDescription,
} from "..";
import { stripImages } from "../llm/countTokens";
import { renderTemplatedString } from "../llm/llms";
import SlashCommands from "./slash";
import { promptAsCodeCommandGenerator } from "./slash/promptAsCode";
import * as fs from "fs";
import path from "path";

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

export function filesUnderPromptFolder(
  folderPath: string,
  files: string[],
): string[] {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      filesUnderPromptFolder(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export function slashCommandFromFile(file: string): SlashCommand {
  return promptAsCodeCommandGenerator(file);
}
