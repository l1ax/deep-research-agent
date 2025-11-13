/**
 * @file 根据用户query生成查询语句
 */

import {llm} from '../llm';
import { globalState } from '../state/globalState';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { generateQueryWriterInstructions } from '../prompts';
import {getCurrentDate} from '../utils';
import {AIMessage, HumanMessage} from '@langchain/core/messages';
import {Command} from '@langchain/langgraph';

const SearchQuerySchema = z.object({
    query: z.array(z.string()).describe('a list of search queries to be used for web search'),
    rationale: z.string().describe('A brief explanation of why these queries are relevant to the research topic.'),
});

const generateQuery = async (state: typeof globalState.State, config: RunnableConfig) => {
    let initialSearchQueryCount: number = 3;

    const {messages} = state;

    const getResearchTopic = () => {
        let researchTopic = '';
        if (messages.length === 1) {
            researchTopic = messages[0].content as string;
            return researchTopic;
        }

        for (const message of messages) {
            if (message instanceof HumanMessage) {
                researchTopic += `User: ${message.content}\n`;
            } else if (message instanceof AIMessage) {
                researchTopic += `Assistant: ${message.content}\n`;
            }
        }

        return researchTopic;
    }

    const structuredLLM = llm.withStructuredOutput(SearchQuerySchema);

    const instructions = generateQueryWriterInstructions(initialSearchQueryCount, getCurrentDate(), getResearchTopic());

    const result = await structuredLLM.invoke(
        instructions,
    );

    return new Command({
        goto: 'webSearch',
        update: {
            queries: result.query,
            researchTopic: getResearchTopic()
        }
    })

}

export default generateQuery;