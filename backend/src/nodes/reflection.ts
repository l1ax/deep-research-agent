/**
 * @file 根据web_search得到的信息进行反思
 */

import {globalState} from '../state/globalState';
import {RunnableConfig} from '@langchain/core/runnables';
import {Command, END} from '@langchain/langgraph';
import {generateReflectionInstructions} from '../prompts';
import { z } from 'zod';
import {llm} from '../llm';
import {AIMessage} from '@langchain/core/messages';

const ReflectionSchema = z.object({
    is_sufficient: z.boolean().describe('Whether the web search summary is sufficient to answer the user\'s question'),
    knowledge_gap: z.string().describe('What information is missing or needs clarification'),
    follow_up_queries: z.array(z.string()).describe('What questions to address this gap'),
    answer: z.string().describe('The answer to the research topic'),
});

const reflection = async (state: typeof globalState.State, config: RunnableConfig) => {
    const {webSearchSummary, researchTopic} = state;

    const MAX_RESEARCH_LOOP_COUNT = 2;
    
    const instructions = generateReflectionInstructions(researchTopic, webSearchSummary, MAX_RESEARCH_LOOP_COUNT, state.researchLoopCount);

    const structuredLLM = llm.withStructuredOutput(ReflectionSchema);

    const result = await structuredLLM.invoke(instructions);

    if (result.is_sufficient || state.researchLoopCount >= MAX_RESEARCH_LOOP_COUNT) {
        return new Command({
            goto: END,
            update: {
                messages: [
                    new AIMessage({
                        content: result.answer
                    })
                ]
            }
        })
    } else {
        return new Command({
            goto: 'webSearch',
            update: {
                queries: result.follow_up_queries,
                researchLoopCount: state.researchLoopCount + 1
            }
        })
    }
}

export default reflection;