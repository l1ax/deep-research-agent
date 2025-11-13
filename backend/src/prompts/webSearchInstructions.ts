/**
 * @file 网络搜索提示词
 */

export const generateWebSearchInstructions = (query: string, researchTopic: string) => `
Your goal is to search the web for the most relevant information based on the given queries.

Instructions:
- Search the web for the most relevant information based on the given queries.
- Return the most relevant information based on the given queries.

The following is the query and research topic:
Query: ${query}
Research Topic: ${researchTopic}
`;