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
  try {
    const fileContent = fs.readFileSync(filePath, "utf8").trim();
    return fileContent;
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    throw new Error(`Could not read file at ${filePath}`);
  }
}

function extractYamlHeaderAndXmlFooter(fileContent: string): {
  yamlHeader: string;
  xmlFooter: string;
} {
  const SECTION_DIVIDER = "---";
  const dividerIndex: number = fileContent.indexOf(SECTION_DIVIDER, 3);
  const yamlHeader: string = fileContent.substring(0, dividerIndex).trim();
  const xmlFooter: string = fileContent.substring(dividerIndex + 3).trim();
  return { yamlHeader, xmlFooter };
}

function generateCustomCommand(
  yamlHeader: string,
  xmlFooter: string
): CustomCommand {
  const yamlData: any = yamlHeaderToJSON(yamlHeader);

  const promptContent = removeXmlTags(xmlFooter);

  return {
    name: yamlData.name,
    description: yamlData.description,
    prompt: promptContent,
  };
}
function removeXmlTags(xmlContent: string): string {
  return xmlContent.replace(/<[^>]*>/g, '').trim();
}

export function promptAsCodeCommandGenerator(filePath: string): SlashCommand {
  const fileContent = readFileContent(filePath);
  const { yamlHeader, xmlFooter } = extractYamlHeaderAndXmlFooter(fileContent);
  const customCommand = generateCustomCommand(yamlHeader, xmlFooter);
  return {
    name: customCommand.name,
    description: customCommand.description,
    run: async function* ({ input, llm, history, ide }) {
      let userInput = input;
      if (userInput.startsWith(`/${customCommand.name}`)) {
        userInput = userInput
          .slice(customCommand.name.length + 1, userInput.length)
          .trimStart();
      }

      const promptUserInput = await renderTemplatedString(
        customCommand.prompt,
        ide.readFile.bind(ide),
        { input: userInput },
      );

      const messages = [...history];
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
