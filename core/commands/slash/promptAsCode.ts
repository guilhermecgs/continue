import { Config, CustomCommand, SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";
import { renderTemplatedString } from "../../llm/llms";
import * as fs from "fs";

function yamlHeaderToJSON(yamlHeader: string): any {
  const lines: string[] = yamlHeader
    .split("\n")
    .filter((line) => line.trim() !== "");
  const yamlData: any = {};
  lines.forEach((line) => {
    const [key, value]: string[] = line.split(":").map((item) => item.trim());
    yamlData[key] = value;
  });
  return yamlData;
}

export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, "utf8").trim();
}

function extractYamlHeaderAndXmlFooter(fileContent: string): {
  yamlHeader: string;
  xmlFooter: string;
} {
  const dividerIndex: number = fileContent.indexOf("---", 3);
  const yamlHeader: string = fileContent.substring(0, dividerIndex).trim();
  const xmlFooter: string = fileContent.substring(dividerIndex + 3).trim();
  return { yamlHeader, xmlFooter };
}

function generateCustomCommand(
  yamlHeader: string,
  xmlFooter: string,
): CustomCommand {
  const yamlData: any = yamlHeaderToJSON(yamlHeader);
  return {
    name: yamlData.name,
    description: yamlData.description,
    prompt: xmlFooter,
  };
}

export function promptAsCodeCommandGenerator(filePath: string): SlashCommand {
  const fileContent = readFileContent(filePath);
  const { yamlHeader, xmlFooter } = extractYamlHeaderAndXmlFooter(fileContent);
  const customCommand = generateCustomCommand(yamlHeader, xmlFooter);
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

    // If true, this command will be run in NodeJs and have access to the filesystem and other Node-only APIs
    // You must make sure to dynamically import any Node-only dependencies in your command so that it doesn't break in the browser
  };
}
