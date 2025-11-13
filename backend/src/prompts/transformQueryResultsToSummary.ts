import {TavilySearchResponse} from '@tavily/core';

export const transformQueryResultsToSummary = (researchTopic: string, queryResults: TavilySearchResponse[]) => `
Based on the research topic "${researchTopic}", the researcher has split the research topic into multiple queries and performed web search for each query. The following are the results:
${queryResults.map((result, index) => (`
    * Query ${index + 1}: ${result.query}
    * Results:
    * ${result.results.map((res, idx) => (`
        * Result ${idx + 1}: 
        * Title: ${res.title}
        * Content: ${res.content}
    `)).join('\n')}
`)).join('\n')}
`;