/**
 * @file 网络搜索节点
 */

import {globalState} from '../state/globalState';
import {RunnableConfig} from '@langchain/core/runnables';
import { tavily } from '@tavily/core';
import {generateWebSearchInstructions, transformQueryResultsToSummary} from '../prompts';
import {Command, END} from '@langchain/langgraph';

const webSearch = async (state: typeof globalState.State, config: RunnableConfig) => {
    const {queries, researchTopic} = state;

    const tvly = tavily({
        apiKey: process.env.TAVILY_API_KEY,
    });

    const asyncTasks = queries.map(async (query) => {
        const instructions = generateWebSearchInstructions(query, researchTopic);
        const response = await tvly.search(query);
        return response;
    });

    const queryResults = await Promise.all(asyncTasks);

    const summary = transformQueryResultsToSummary(researchTopic, [...state.queryResults, ...queryResults]);

    return new Command({
        goto: 'reflection',
        update: {
            webSearchSummary: summary,
            queryResults: queryResults
        }
    })
}

export default webSearch;