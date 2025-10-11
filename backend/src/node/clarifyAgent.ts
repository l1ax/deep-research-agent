import {clarifyWithUserInstructions} from '../prompt/clarify';
import {GlobalState} from '../state/globalState';
import dayjs from 'dayjs';
import {AIMessage, BaseMessage, HumanMessage} from '@langchain/core/messages';
import {llm} from '../llm';
import {z} from 'zod';
import {Command, END} from '@langchain/langgraph';

const ClarifyOutput = z.object({
    need_clarification: z.boolean().describe('Whether the user needs to be asked a clarifying question.'),
    question: z.string().describe('A question to ask the user to clarify the report scope'),
    verification: z.string().describe('Verify message that we will start research after the user has provided the necessary information.')
})

const clarifyAgent = async (state: typeof GlobalState.State) => {
    const messages: BaseMessage[] = state.messages;

    const prompt = clarifyWithUserInstructions(messages, dayjs().format('YYYY-MM-DD'));

    const wrappedLlm = llm.withStructuredOutput(ClarifyOutput);

    const response = await wrappedLlm.invoke([new HumanMessage(prompt)]);

    if (response.need_clarification) {
        return new Command({
            goto: END,
            update: {
                messages: [new AIMessage(response.question)]
            }
        })
    } else {
        return new Command({
            // TODO: goto research brief node
            goto: END,
            update: {
                messages: [new AIMessage(response.verification)]
            }
        })
    }
}

export {clarifyAgent};