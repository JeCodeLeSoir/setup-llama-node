/* JeCodeLeSoir - 2023 */
import fs from "fs";
import path from "path";
import readline from "readline";

import { LLMError } from "llama-node/dist/llm/type.js";
import { LLamaCpp, type LoadConfig } from "llama-node/dist/llm/llama-cpp.js";
import {
    type Generate
} from "@llama-node/llama-cpp";
import { LLM } from "llama-node";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


const Run = async (model_name: string) => {
    const model = path.resolve(process.cwd(), "./" + model_name);
    const llama = new LLM(LLamaCpp);

    const config: LoadConfig = {
        modelPath: model,
        enableLogging: false,
        nCtx: 1024,
        seed: 0,
        f16Kv: false,
        logitsAll: false,
        vocabOnly: false,
        useMlock: false,
        embedding: false,
        useMmap: true,
        nGpuLayers: 4
    };

    await llama.load(config);

    let context = "A chat between a user and an assistant. The user is a human and the assistant is a computer.\n"
        + "The assistant obeys the following rules:\n"
        + "- The assistant speak french.\n";

    const Say = (user_msg: string) => {
        return new Promise<boolean>(async (resolve, reject) => {

            const prompt = context + "USER:" + user_msg + "\nASSISTANT:";
            const params: Generate = {
                nThreads: 4,
                nTokPredict: 2048,
                topK: 40,
                topP: 0.1,
                temp: 0.2,
                repeatPenalty: 1,
                prompt,
            };

            let allText = ""
            let abort = false;

            const abortController = new AbortController();

            try {
                await llama.createCompletion(params, (e) => {
                    if (allText.includes("USER:")) {
                        abort = true;
                        allText = allText.replace("USER:", "");
                        abortController.abort();
                    }
                    else {
                        if (!abort)
                            allText += e.token;
                    }
                }, abortController.signal);
            }
            catch (baseError: any) {
                if (baseError instanceof Error) {
                    try {
                        let error = baseError as LLMError;
                        if (error.type !== "Aborted") {
                            reject(error);
                        }
                        else {
                            console.log("Aborted")
                        }
                    }
                    catch (e) {
                        reject(baseError);
                    }
                }
            };

            allText = allText.replace("\n", "");
            context += "USER: " + user_msg + "\n";
            context += "ASSISTANT: " + allText + "\n";

            console.log("ASSISTANT>: " + allText);

            resolve(true);
        })
    }



    const ask = () => {
        rl.question('User >: ', (answer) => {
            if (answer === "dc") {
                console.log(context);
                ask();
                return;
            }
            if (answer === "exit") {
                rl.close();
                return;
            }
            Say(answer).then(() => {
                ask();
            });
        });
    }

    ask();
}


const ask = () => {

    let files: Array<string> = [];

    fs.readdirSync(process.cwd()).forEach(file => {
        if (file.includes(".bin")) {
            console.log("Found model -> ID " + files.length + " : " + file);
            files.push(file);
        }
    });

    if (files.length > 0) {

        rl.question('Select model :', (answer) => {
            /* answer is number */
            let index = parseInt(answer);

            if (index > files.length) {
                console.log("Invalid model");
                ask();
                return;
            }

            console.log(`Selected model: ${files[index]}`);

            Run(files[index]);
        });
    }
    else {
        console.log("No model found");
        ask();
    }
}

ask();