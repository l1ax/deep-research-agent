import { BaseMessage } from "@langchain/core/messages";
import {Annotation, messagesStateReducer} from '@langchain/langgraph';
import {TavilySearchResponse} from '@tavily/core';
import { z } from 'zod';

export const globalState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => []
    }),
    queries: Annotation<string[]>({
        default: () => [],
        reducer: (a: string[], b: string[]) => b
    }),
    queryResults: Annotation<TavilySearchResponse[]>({
        default: () => [],
        reducer: (a: TavilySearchResponse[], b: TavilySearchResponse[]) => [...a, ...b]
    }),
    researchTopic: Annotation<string>({
        default: () => '',
        reducer: (a: string, b: string) => b
    }),
    webSearchSummary: Annotation<string>({
        default: () => '',
        reducer: (a: string, b: string) => b
    }),
    researchLoopCount: Annotation<number>({
        default: () => 0,
        reducer: (a: number, b: number) => b
    }),
});
