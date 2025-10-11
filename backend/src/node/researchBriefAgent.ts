import {AIMessage, BaseMessage, HumanMessage} from '@langchain/core/messages';
import {GlobalState} from '../state/globalState';
import {generateResearchTopic} from '../prompt/generateResearchTopic';
import dayjs from 'dayjs';
import {z} from 'zod';
import {llm} from '../llm';
import {Command, END} from '@langchain/langgraph';

const ResearchBriefOutput = z.object({
    research_brief: z.string().describe('A research question that will be used to guide the research.'),
});

const researchBriefAgent = async (state: typeof GlobalState.State) => {
    const messages: BaseMessage[] = state.messages;

    const prompt = generateResearchTopic(messages, dayjs().format('YYYY-MM-DD'));

    const wrappedLlm = llm.withStructuredOutput(ResearchBriefOutput);

    const response = await wrappedLlm.invoke([new HumanMessage(prompt)]);

    return new Command({
        goto: END,
        update: {
            messages: [new AIMessage(response.research_brief)]
        }
    });
}

export {researchBriefAgent};