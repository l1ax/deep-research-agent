import {BaseMessage, HumanMessage, SystemMessage} from '@langchain/core/messages';
import {GlobalState} from '../state/globalState';
import {generateResearchTopic} from '../prompt/generateResearchTopic';
import dayjs from 'dayjs';
import {z} from 'zod';
import {llm} from '../llm';
import {Command, END} from '@langchain/langgraph';
import supervisorSystemPrompt from '../prompt/supervisorSystemPrompt';

const ResearchBriefOutput = z.object({
    researchBrief: z.string().describe('A research question that will be used to guide the research.'),
});

const researchBriefAgent = async (state: typeof GlobalState.State) => {
    const today = dayjs().format('YYYY-MM-DD');

    const messages: BaseMessage[] = state.messages;

    const messagesString = messages.map(message => message.content).join('\n');

    const prompt = generateResearchTopic(messagesString, today);

    const wrappedLlm = llm.withStructuredOutput(ResearchBriefOutput);

    const response = await wrappedLlm.invoke([new HumanMessage(prompt)]);

    const supervisorSystemPromptContent = supervisorSystemPrompt(today, 6, 2);

    return new Command({
        goto: 'supervisorAgent',
        update: {
            researchBrief: response.researchBrief,
            supervisorMessages: {
                value: [
                    new SystemMessage(supervisorSystemPromptContent),
                    new HumanMessage(response.researchBrief)
                ]
            }
        }
    });
}

export default researchBriefAgent;