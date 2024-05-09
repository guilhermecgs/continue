import { Config, CustomCommand, SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";
import { renderTemplatedString } from "../../llm/llms";
import * as fs from 'fs';

export function promptAsCodeCommandGenerator(file: any): SlashCommand {
    

    // very important! the .prompt file must be in the format defined here
    // https://docs.humanloop.com/docs/prompt-file-format
    // There is a yaml header with some properties
    // a divider ---
    // and a footer with XML syntax
    // so... you need to create a parser for this file format

    const [name,description,prompt]: string[] = file.split("\n");

    let customCommand: CustomCommand = {
        name: name,
        prompt: prompt,
        description: description
    }
    
    return {
    name: name,
    description: description,
    run: async function* ({ input, llm, history, ide }) {

        // not sure of whats going on here, but i will take a look on another time.

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
    
   }
    

}